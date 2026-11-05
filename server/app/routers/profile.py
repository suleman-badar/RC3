import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from ..config import settings
from ..db import get_db, now, serialize
from ..deps import require_candidate
from ..schemas import ProfileUpdateIn
from ..services import gemini
from ..services.chunks import embed_chunks
from ..services.normalize import canonical
from ..services.parsing import ParseFailure, UnsupportedFile, extract_text, parse_resume, unverified_claims

router = APIRouter(prefix="/profile", tags=["profile"])

EMPTY_PARSED = {"contact": {"name": "", "email": "", "phone": "", "location": "", "links": []}, "summary": "",
                "skills": [], "education": [], "experience": [], "projects": [], "certifications": [],
                "total_years_experience": 0}


def get_or_create_profile(db, user: dict) -> dict:
    prof = db.profiles.find_one({"user_id": user["_id"]})
    if not prof:
        prof = {"user_id": user["_id"], "resume": {"parse_status": "none"}, "parsed": None, "chunks": [],
                "talent_pool_opt_in": True, "updated_at": now()}
        prof["_id"] = db.profiles.insert_one(prof).inserted_id
    return prof


def profile_out(prof: dict) -> dict:
    data = serialize(prof)
    resume = dict(data.get("resume") or {})
    resume["has_text"] = bool(resume.pop("raw_text", None))
    data["resume"] = resume
    data["chunk_count"] = len(data.pop("chunks", []) or [])
    data["unverified_claims"] = unverified_claims(prof.get("parsed") or {})
    return data


def _run_ai(db, prof: dict, raw_text: str) -> dict:
    """Parse + embed; updates the stored profile with the outcome (parsed or failed)."""
    try:
        parsed = parse_resume(raw_text)
        chunks = embed_chunks(parsed)
        update = {"parsed": parsed, "chunks": chunks, "resume.parse_status": "parsed",
                  "resume.parse_error": None, "updated_at": now()}
    except gemini.AIError as exc:
        update = {"resume.parse_status": "failed", "resume.parse_error": str(exc), "updated_at": now()}
    db.profiles.update_one({"_id": prof["_id"]}, {"$set": update})
    return db.profiles.find_one({"_id": prof["_id"]})


def process_resume(db, user: dict, filename: str, data: bytes) -> dict:
    """Shared by the upload endpoint and the seed script."""
    if len(data) > settings.MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File too large (max {settings.MAX_UPLOAD_MB} MB)")
    if not data:
        raise HTTPException(status_code=400, detail="The uploaded file is empty")
    prof = get_or_create_profile(db, user)
    meta = {"filename": filename, "size": len(data), "uploaded_at": now()}
    try:
        text = extract_text(data, filename)
    except UnsupportedFile as exc:
        raise HTTPException(status_code=415, detail=str(exc))
    except ParseFailure as exc:
        db.profiles.update_one({"_id": prof["_id"]}, {"$set": {"resume": {
            **meta, "raw_text": "", "parse_status": "failed", "parse_error": str(exc)}}})
        return db.profiles.find_one({"_id": prof["_id"]})
    if len(text.strip()) < 50:
        db.profiles.update_one({"_id": prof["_id"]}, {"$set": {"resume": {
            **meta, "raw_text": text, "parse_status": "empty",
            "parse_error": "No readable text found. Is this a scanned image? Please upload a text-based PDF."}}})
        return db.profiles.find_one({"_id": prof["_id"]})
    db.profiles.update_one({"_id": prof["_id"]}, {"$set": {"resume": {
        **meta, "raw_text": text, "parse_status": "parsing", "parse_error": None}}})
    return _run_ai(db, prof, text)


@router.get("/me")
def get_me(user: dict = Depends(require_candidate), db=Depends(get_db)):
    return profile_out(get_or_create_profile(db, user))


@router.post("/resume")
def upload_resume(file: UploadFile = File(...), user: dict = Depends(require_candidate), db=Depends(get_db)):
    # sync endpoint: runs in a worker thread so the AI call doesn't block other requests
    data = file.file.read(settings.MAX_UPLOAD_MB * 1024 * 1024 + 1)
    return profile_out(process_resume(db, user, file.filename or "", data))


@router.post("/resume/reparse")
def reparse(user: dict = Depends(require_candidate), db=Depends(get_db)):
    prof = get_or_create_profile(db, user)
    raw = (prof.get("resume") or {}).get("raw_text")
    if not raw or len(raw.strip()) < 50:
        raise HTTPException(status_code=400, detail="No readable resume text to re-parse. Upload a resume first.")
    return profile_out(_run_ai(db, prof, raw))


# ---------- Candidate corrections ----------
SECTION_FIELDS = {
    "skills": ["name"],
    "education": ["degree", "institution", "year"],
    "experience": ["title", "company", "start", "end", "years", "description"],
    "projects": ["name", "description", "technologies"],
    "certifications": ["name"],
}


def _merge(section: str, incoming: list[dict], existing: list[dict]) -> list[dict]:
    by_id = {it["id"]: it for it in existing or [] if it.get("id")}
    out, seen_skills = [], set()
    for raw in incoming:
        item = {k: raw.get(k) for k in SECTION_FIELDS[section]}
        if section == "skills":
            item["name"] = canonical((item.get("name") or "").strip())
            if not item["name"] or item["name"].lower() in seen_skills:
                continue
            seen_skills.add(item["name"].lower())
        if section == "projects":
            item["technologies"] = [canonical(t) for t in item.get("technologies") or [] if t]
        if section == "experience":
            try:
                item["years"] = max(0.0, float(item.get("years") or 0))
            except (TypeError, ValueError):
                item["years"] = 0.0
        if not any(str(v or "").strip() for v in item.values()):
            continue
        prev = by_id.get(raw.get("id"))
        if prev and all(prev.get(k) == item.get(k) for k in SECTION_FIELDS[section]):
            out.append(prev)
            continue
        item.update(id=raw.get("id") or f"u_{uuid.uuid4().hex[:8]}",
                    excerpt=(prev or {}).get("excerpt", ""), verified=True, source="candidate")
        if section == "skills":
            item["raw"] = raw.get("name", "")
        out.append(item)
    return out


@router.put("/me")
def update_me(body: ProfileUpdateIn, user: dict = Depends(require_candidate), db=Depends(get_db)):
    prof = get_or_create_profile(db, user)
    old = prof.get("parsed") or EMPTY_PARSED
    contact = {k: str(body.contact.get(k, old["contact"].get(k, "")) or "")
               for k in ("name", "email", "phone", "location")}
    contact["links"] = [str(x) for x in body.contact.get("links", old["contact"].get("links", [])) or []]
    parsed = {"contact": contact, "summary": body.summary}
    for section in SECTION_FIELDS:
        parsed[section] = _merge(section, getattr(body, section), old.get(section, []))
    parsed["total_years_experience"] = (
        body.total_years_experience if body.total_years_experience is not None
        else round(sum(e.get("years") or 0 for e in parsed["experience"]), 1))
    update = {"parsed": parsed, "talent_pool_opt_in": body.talent_pool_opt_in, "updated_at": now()}
    if (prof.get("resume") or {}).get("parse_status") in (None, "none", "empty", "failed"):
        update["resume.parse_status"] = "parsed"  # manually entered profile counts as structured data
        update["resume.parse_error"] = None
    warning = None
    try:
        update["chunks"] = embed_chunks(parsed)
    except gemini.AIError as exc:
        warning = f"Saved, but semantic indexing failed ({exc}). Save again to retry."
    db.profiles.update_one({"_id": prof["_id"]}, {"$set": update})
    out = profile_out(db.profiles.find_one({"_id": prof["_id"]}))
    out["warning"] = warning
    return out
