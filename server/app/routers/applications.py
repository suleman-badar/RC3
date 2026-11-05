import copy
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pymongo.errors import DuplicateKeyError

from ..constants import EXCLUDED_ATTRIBUTES, STATUS_LABELS, SYSTEM_ONLY, TRANSITIONS
from ..db import get_db, now, oid, serialize
from ..deps import get_current_user, require_candidate, require_recruiter
from ..schemas import (ApplyIn, CompareIn, DecisionIn, GenerateQuestionsIn, NoteIn, QuestionUpdateIn,
                       ScoreOverrideIn, SkillOverridesIn, StatusIn)
from ..services import gemini, questions as qgen
from ..services.matching import assess, full_assessment, scoring_view
from ..services.normalize import canonical
from ..services.notify import notify
from ..services.pipeline import transition
from .jobs import get_job_or_404
from .profile import profile_out

router = APIRouter(tags=["applications"])


# ---------- helpers ----------
def effective_score(app: dict):
    if app.get("override"):
        return app["override"]["score"]
    return (app.get("assessment") or {}).get("score")


def get_app_or_404(db, app_id) -> dict:
    app = db.applications.find_one({"_id": oid(app_id)})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return app


def _profile(db, candidate_id) -> dict:
    prof = db.profiles.find_one({"user_id": candidate_id})
    if not prof or not prof.get("parsed"):
        raise HTTPException(status_code=400, detail="Candidate has no parsed resume")
    return prof


def run_assessment(db, app: dict, job: dict, profile: dict) -> dict:
    try:
        assessment = full_assessment(job, profile, app.get("skill_overrides"), app.get("assessment"))
        db.applications.update_one({"_id": app["_id"]}, {"$set": {
            "assessment": assessment, "assessment_status": "ready", "assessment_error": None, "updated_at": now()}})
        app.update(assessment=assessment, assessment_status="ready", assessment_error=None)
        if app["status"] == "parsed":
            transition(db, app, "ai_assessed", None, note="AI assessment completed", job_title=job["title"])
    except gemini.AIError as exc:
        db.applications.update_one({"_id": app["_id"]}, {"$set": {
            "assessment_status": "failed", "assessment_error": str(exc), "updated_at": now()}})
        app.update(assessment_status="failed", assessment_error=str(exc))
    return app


def candidate_view(app: dict, job: dict | None) -> dict:
    return {
        "id": str(app["_id"]),
        "job": {"id": str(job["_id"]), "title": job["title"], "department": job["department"],
                "location": job["location"]} if job else None,
        "status": app["status"],
        "status_label": STATUS_LABELS[app["status"]],
        "status_history": [{"to": h["to"], "at": serialize(h["at"])} for h in app.get("status_history") or []],
        "submitted_at": serialize(app["submitted_at"]),
    }


def allowed_next(app: dict, job: dict, user: dict) -> list[str]:
    nxt = [s for s in TRANSITIONS[app["status"]] if s not in SYSTEM_ONLY]
    if app["status"] == "interview" and str(job["recruiter_id"]) != str(user["_id"]):
        return []  # final decision: job owner only
    return nxt


def recruiter_view(db, app: dict, user: dict) -> dict:
    job = db.jobs.find_one({"_id": app["job_id"]})
    cand = db.users.find_one({"_id": app["candidate_id"]}) or {}
    prof = db.profiles.find_one({"user_id": app["candidate_id"]})
    data = serialize(app)
    data["status_label"] = STATUS_LABELS[app["status"]]
    data["effective_score"] = effective_score(app)
    data["job"] = {
        "id": str(job["_id"]), "title": job["title"], "department": job["department"], "status": job["status"],
        "is_owner": str(job["recruiter_id"]) == str(user["_id"]),
        "required_skills": job.get("required_skills", []), "preferred_skills": job.get("preferred_skills", []),
        "min_experience_years": job.get("min_experience_years", 0), "qualifications": job.get("qualifications", []),
    }
    data["candidate"] = {"id": str(app["candidate_id"]), "name": cand.get("name", ""), "email": cand.get("email", "")}
    data["profile"] = profile_out(prof) if prof else None
    data["interviews"] = serialize(list(db.interviews.find({"application_id": app["_id"]}).sort("start", 1)))
    data["allowed_transitions"] = allowed_next(app, job, user)
    return data


def list_row(app: dict, cand: dict | None) -> dict:
    a = app.get("assessment") or {}
    skills = a.get("skills") or []
    return {
        "id": str(app["_id"]),
        "candidate": {"id": str(app["candidate_id"]), "name": (cand or {}).get("name", "")},
        "status": app["status"],
        "status_label": STATUS_LABELS[app["status"]],
        "assessment_status": app.get("assessment_status"),
        "effective_score": effective_score(app),
        "ai_score": a.get("score"),
        "overridden": bool(app.get("override")),
        "breakdown": a.get("breakdown"),
        "skills": [{"skill": s["skill"], "state": s["state"], "required": s["required"]} for s in skills],
        "top_matched": [s["skill"] for s in skills if s["state"] in ("matched", "semantic")][:5],
        "gap_count": len([g for g in a.get("gaps") or [] if g.get("required")]),
        "unverified_count": len(a.get("unverified_claims") or []),
        "submitted_at": serialize(app["submitted_at"]),
    }


# ---------- candidate ----------
def create_application(db, user: dict, job_id: str) -> dict:
    job = get_job_or_404(db, job_id)
    if job["status"] != "open":
        raise HTTPException(status_code=400, detail="This job is closed and no longer accepts applications")
    prof = db.profiles.find_one({"user_id": user["_id"]})
    if not prof or not prof.get("parsed") or (prof.get("resume") or {}).get("parse_status") != "parsed":
        raise HTTPException(status_code=400, detail="Upload a resume and let it be parsed before applying")
    t = now()
    app = {
        "job_id": job["_id"], "candidate_id": user["_id"], "status": "submitted",
        "status_history": [{"from": None, "to": "submitted", "by": str(user["_id"]), "by_name": user["name"],
                            "by_role": "candidate", "at": t, "note": None}],
        "assessment_status": "pending", "assessment": None, "assessment_error": None, "override": None,
        "skill_overrides": [], "notes": [], "questions": [], "decision": None,
        "submitted_at": t, "updated_at": t,
    }
    try:
        app["_id"] = db.applications.insert_one(app).inserted_id
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="You have already applied to this job")
    transition(db, app, "parsed", None, note="Structured resume data attached", job_title=job["title"])
    run_assessment(db, app, job, prof)
    notify(db, job["recruiter_id"], "application", f"New application for {job['title']} from {user['name']}",
           f"/r/applications/{app['_id']}")
    return app


@router.post("/applications", status_code=201)
def apply(body: ApplyIn, user: dict = Depends(require_candidate), db=Depends(get_db)):
    app = create_application(db, user, body.job_id)
    return candidate_view(app, db.jobs.find_one({"_id": app["job_id"]}))


@router.get("/applications/mine")
def my_applications(user: dict = Depends(require_candidate), db=Depends(get_db)):
    apps = list(db.applications.find({"candidate_id": user["_id"]}).sort("submitted_at", -1))
    jobs = {j["_id"]: j for j in db.jobs.find({"_id": {"$in": [a["job_id"] for a in apps]}})}
    return [candidate_view(a, jobs.get(a["job_id"])) for a in apps]


# ---------- recruiter ----------
@router.get("/jobs/{job_id}/applications")
def job_applications(job_id: str, status: str | None = None, min_score: int | None = Query(None, ge=0, le=100),
                     skill: str | None = None, sort: str = Query("score", pattern="^(score|date)$"),
                     user: dict = Depends(require_recruiter), db=Depends(get_db)):
    job = get_job_or_404(db, job_id)
    q = {"job_id": job["_id"]}
    if status:
        q["status"] = {"$in": [s.strip() for s in status.split(",") if s.strip()]}
    apps = list(db.applications.find(q))
    users = {u["_id"]: u for u in db.users.find({"_id": {"$in": [a["candidate_id"] for a in apps]}})}
    rows = [list_row(a, users.get(a["candidate_id"])) for a in apps]
    if min_score is not None:
        rows = [r for r in rows if (r["effective_score"] or 0) >= min_score]
    if skill:
        key = canonical(skill).lower()
        rows = [r for r in rows if any(canonical(s["skill"]).lower() == key and s["state"] in ("matched", "semantic")
                                       for s in r["skills"])]
    if sort == "score":
        rows.sort(key=lambda r: (r["effective_score"] is None, -(r["effective_score"] or 0)))
    else:
        rows.sort(key=lambda r: r["submitted_at"], reverse=True)
    for i, r in enumerate(rows, 1):
        r["rank"] = i
    return rows


@router.post("/applications/compare")
def compare(body: CompareIn, user: dict = Depends(require_recruiter), db=Depends(get_db)):
    apps = [get_app_or_404(db, i) for i in body.ids]
    if len({a["job_id"] for a in apps}) != 1:
        raise HTTPException(status_code=400, detail="Select applications for the same job to compare")
    job = db.jobs.find_one({"_id": apps[0]["job_id"]})
    skills = [s["name"] for s in job.get("required_skills", []) + job.get("preferred_skills", [])]
    out = []
    for a in apps:
        cand = db.users.find_one({"_id": a["candidate_id"]}) or {}
        prof = db.profiles.find_one({"user_id": a["candidate_id"]}) or {}
        asm = a.get("assessment") or {}
        by_name = {s["skill"]: {"state": s["state"], "similarity": s.get("similarity"), "evidence": s.get("evidence")}
                   for s in asm.get("skills") or []}
        missing_info = []
        parsed = prof.get("parsed") or {}
        for section, label in (("projects", "No projects listed"), ("education", "No education listed"),
                               ("experience", "No work experience listed")):
            if not parsed.get(section):
                missing_info.append(label)
        out.append({
            "id": str(a["_id"]), "name": cand.get("name", ""), "status": a["status"],
            "status_label": STATUS_LABELS[a["status"]], "effective_score": effective_score(a),
            "ai_score": asm.get("score"), "breakdown": asm.get("breakdown"), "skills_by_name": by_name,
            "total_years": parsed.get("total_years_experience", 0), "gaps": asm.get("gaps") or [],
            "unverified_claims": asm.get("unverified_claims") or [], "missing_info": missing_info,
            "summary": asm.get("summary"),
        })
    return {"job": {"id": str(job["_id"]), "title": job["title"]}, "skills": skills, "candidates": out}


@router.get("/applications/{app_id}")
def get_application(app_id: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    app = get_app_or_404(db, app_id)
    if user["role"] == "candidate":
        if app["candidate_id"] != user["_id"]:
            raise HTTPException(status_code=404, detail="Application not found")
        return candidate_view(app, db.jobs.find_one({"_id": app["job_id"]}))
    if app["status"] == "ai_assessed":
        job = db.jobs.find_one({"_id": app["job_id"]})
        try:
            transition(db, app, "recruiter_review", user, note="Opened for review", job_title=job["title"])
        except HTTPException:
            app = get_app_or_404(db, app_id)
    return recruiter_view(db, app, user)


@router.patch("/applications/{app_id}/status")
def change_status(app_id: str, body: StatusIn, user: dict = Depends(require_recruiter), db=Depends(get_db)):
    app = get_app_or_404(db, app_id)
    job = db.jobs.find_one({"_id": app["job_id"]})
    final = app["status"] == "interview" and body.status in ("selected", "rejected")
    if final:
        if str(job["recruiter_id"]) != str(user["_id"]):
            raise HTTPException(status_code=403, detail="Only the recruiter who owns this job can record final decisions")
        db.applications.update_one({"_id": app["_id"]}, {"$set": {"decision": {
            "outcome": body.status, "reason": body.note or "", "by": str(user["_id"]), "by_name": user["name"],
            "at": now()}}})
    transition(db, app, body.status, user, note=body.note, job_title=job["title"])
    return recruiter_view(db, get_app_or_404(db, app_id), user)


@router.post("/applications/{app_id}/decision")
def decision(app_id: str, body: DecisionIn, user: dict = Depends(require_recruiter), db=Depends(get_db)):
    app = get_app_or_404(db, app_id)
    job = db.jobs.find_one({"_id": app["job_id"]})
    if str(job["recruiter_id"]) != str(user["_id"]):
        raise HTTPException(status_code=403, detail="Only the recruiter who owns this job can record final decisions")
    if app["status"] != "interview":
        raise HTTPException(status_code=400, detail="A final decision can only be recorded after the interview stage")
    db.applications.update_one({"_id": app["_id"]}, {"$set": {"decision": {
        "outcome": body.outcome, "reason": body.reason, "by": str(user["_id"]), "by_name": user["name"],
        "at": now()}}})
    transition(db, app, body.outcome, user, note=f"Final decision: {body.reason}", job_title=job["title"])
    return recruiter_view(db, get_app_or_404(db, app_id), user)


@router.post("/applications/{app_id}/notes", status_code=201)
def add_note(app_id: str, body: NoteIn, user: dict = Depends(require_recruiter), db=Depends(get_db)):
    app = get_app_or_404(db, app_id)
    note = {"id": f"n_{uuid.uuid4().hex[:8]}", "author_id": str(user["_id"]), "author_name": user["name"],
            "text": body.text, "at": now()}
    db.applications.update_one({"_id": app["_id"]}, {"$push": {"notes": note}, "$set": {"updated_at": now()}})
    return serialize(note)


@router.post("/applications/{app_id}/reassess")
def reassess(app_id: str, user: dict = Depends(require_recruiter), db=Depends(get_db)):
    app = get_app_or_404(db, app_id)
    job = db.jobs.find_one({"_id": app["job_id"]})
    run_assessment(db, app, job, _profile(db, app["candidate_id"]))
    return recruiter_view(db, get_app_or_404(db, app_id), user)


@router.put("/applications/{app_id}/skill-overrides")
def skill_overrides(app_id: str, body: SkillOverridesIn, user: dict = Depends(require_recruiter), db=Depends(get_db)):
    app = get_app_or_404(db, app_id)
    current = {canonical(o["skill"]).lower(): o for o in app.get("skill_overrides") or []}
    for o in body.overrides:
        key = canonical(o.skill).lower()
        if o.state is None:
            current.pop(key, None)
        else:
            current[key] = {"skill": canonical(o.skill), "state": o.state, "by": str(user["_id"]),
                            "by_name": user["name"], "at": now()}
    overrides = list(current.values())
    db.applications.update_one({"_id": app["_id"]}, {"$set": {"skill_overrides": overrides, "updated_at": now()}})
    app["skill_overrides"] = overrides
    job = db.jobs.find_one({"_id": app["job_id"]})
    run_assessment(db, app, job, _profile(db, app["candidate_id"]))
    return recruiter_view(db, get_app_or_404(db, app_id), user)


@router.put("/applications/{app_id}/override")
def score_override(app_id: str, body: ScoreOverrideIn, user: dict = Depends(require_recruiter), db=Depends(get_db)):
    app = get_app_or_404(db, app_id)
    value = None if body.clear else {"score": body.score, "reason": body.reason.strip(), "by": str(user["_id"]),
                                     "by_name": user["name"], "at": now()}
    db.applications.update_one({"_id": app["_id"]}, {"$set": {"override": value, "updated_at": now()}})
    return recruiter_view(db, get_app_or_404(db, app_id), user)


@router.post("/applications/{app_id}/questions/generate")
def generate_questions(app_id: str, body: GenerateQuestionsIn, user: dict = Depends(require_recruiter),
                       db=Depends(get_db)):
    app = get_app_or_404(db, app_id)
    job = db.jobs.find_one({"_id": app["job_id"]})
    prof = _profile(db, app["candidate_id"])
    existing = app.get("questions") or []
    try:
        if body.question_id:
            target = next((q for q in existing if q["id"] == body.question_id), None)
            if not target:
                raise HTTPException(status_code=404, detail="Question not found")
            new_q = qgen.regenerate_one(job, prof, existing, target)
            result = [new_q if q["id"] == target["id"] else q for q in existing]
        else:
            result = qgen.generate_all(job, prof)
    except gemini.AIError as exc:
        raise HTTPException(status_code=502, detail=f"Question generation failed: {exc}")
    db.applications.update_one({"_id": app["_id"]}, {"$set": {"questions": result, "updated_at": now()}})
    return result


@router.put("/applications/{app_id}/questions/{qid}")
def update_question(app_id: str, qid: str, body: QuestionUpdateIn, user: dict = Depends(require_recruiter),
                    db=Depends(get_db)):
    app = get_app_or_404(db, app_id)
    qs = app.get("questions") or []
    target = next((q for q in qs if q["id"] == qid), None)
    if not target:
        raise HTTPException(status_code=404, detail="Question not found")
    target.update(question=body.question.strip(), guideline=body.guideline.strip(), difficulty=body.difficulty,
                  edited=True)
    db.applications.update_one({"_id": app["_id"]}, {"$set": {"questions": qs, "updated_at": now()}})
    return target


@router.delete("/applications/{app_id}/questions/{qid}", status_code=204)
def delete_question(app_id: str, qid: str, user: dict = Depends(require_recruiter), db=Depends(get_db)):
    app = get_app_or_404(db, app_id)
    qs = app.get("questions") or []
    if not any(q["id"] == qid for q in qs):
        raise HTTPException(status_code=404, detail="Question not found")
    db.applications.update_one({"_id": app["_id"]}, {"$set": {
        "questions": [q for q in qs if q["id"] != qid], "updated_at": now()}})
    return Response(status_code=204)


@router.post("/applications/{app_id}/fairness-check")
def fairness_check(app_id: str, user: dict = Depends(require_recruiter), db=Depends(get_db)):
    """Counterfactual test: change protected / irrelevant attributes and confirm the score does not move."""
    app = get_app_or_404(db, app_id)
    job = db.jobs.find_one({"_id": app["job_id"]})
    prof = _profile(db, app["candidate_id"])
    changed = {"name": "Alex Morgan", "email": "alex.morgan@example.org", "phone": "+00 000 000 0000",
               "location": "A different city", "gender": "female", "age": 58, "nationality": "other",
               "marital_status": "married"}
    cf = copy.deepcopy(prof)
    cf_parsed = cf["parsed"]
    cf_parsed["contact"] = {"name": changed["name"], "email": changed["email"], "phone": changed["phone"],
                            "location": changed["location"], "links": []}
    cf_parsed.update(gender=changed["gender"], age=changed["age"], nationality=changed["nationality"],
                     marital_status=changed["marital_status"])
    try:
        original = assess(job, scoring_view(prof), app.get("skill_overrides"))
        counter = assess(job, scoring_view(cf), app.get("skill_overrides"))
    except gemini.AIError as exc:
        raise HTTPException(status_code=502, detail=f"Fairness check failed: {exc}")
    return {
        "original_score": original["score"],
        "counterfactual_score": counter["score"],
        "delta": counter["score"] - original["score"],
        "breakdown_identical": original["breakdown"] == counter["breakdown"],
        "changed_attributes": changed,
        "excluded_attributes": EXCLUDED_ATTRIBUTES,
    }
