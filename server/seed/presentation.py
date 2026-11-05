"""Add a presentation dataset without resetting or overwriting existing records.

python -m seed.presentation --inventory
python -m seed.presentation --assets-only
python -m seed.presentation --apply
"""
import argparse
import json
import logging
import time
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

import fitz

from app.config import settings
from app.db import ensure_indexes, get_db, now
from app.routers.applications import add_note, create_application, generate_questions, run_assessment
from app.routers.interviews import schedule
from app.routers.profile import process_resume
from app.schemas import GenerateQuestionsIn, InterviewIn, JobIn, NoteIn
from app.security import hash_password
from app.services import gemini
from app.services.pipeline import transition
from seed.demo_data import CANDIDATES, JOBS, LIVE_CANDIDATE, PACK, PASSWORD, RECRUITERS, email, job_body, resume_sections

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "output" / "pdf" / "demo-resumes"
REPORT = ROOT / "DEMO_SEED_REPORT.json"
COLLECTIONS = ("users", "jobs", "profiles", "applications", "interviews", "notifications")


def counts(db):
    return {name: db[name].count_documents({}) for name in COLLECTIONS}


def create_assets():
    ASSETS.mkdir(parents=True, exist_ok=True)
    for candidate in [*CANDIDATES, LIVE_CANDIDATE]:
        key, name, role, *_ = candidate
        with fitz.open() as doc:
            page = doc.new_page(width=595, height=842)
            page.draw_rect(fitz.Rect(0, 0, 595, 133), color=None, fill=(0.06, 0.16, 0.22))
            page.insert_text((45, 49), name, fontsize=23, fontname="hebo", color=(1, 1, 1))
            page.insert_text((45, 75), role, fontsize=12, color=(0.6, 0.9, 0.85))
            page.insert_text((45, 101), f"{email(key)} | Lahore, Pakistan", fontsize=10, color=(1, 1, 1))
            y = 166
            for title, body in resume_sections(candidate):
                page.insert_text((45, y), title, fontsize=10, fontname="hebo", color=(0.05, 0.4, 0.4))
                y += 12
                spare = page.insert_textbox(fitz.Rect(45, y, 550, y+86), body, fontsize=11, lineheight=1.4)
                if spare < 0:
                    raise RuntimeError(f"Resume layout overflow: {key} / {title}")
                y += 100
            page.insert_text((45, 805), "FICTIONAL DEMO RESUME | Created for software testing and presentation", fontsize=8, color=(0.4, 0.4, 0.4))
            path = ASSETS / f"{key}_resume.pdf"
            doc.save(path)
        with fitz.open(path) as check:
            text = check[0].get_text()
            if name not in text or "EDUCATION" not in text:
                raise RuntimeError(f"Unreadable resume: {key}")
    print(f"Resume assets ready: {len(CANDIDATES)+1}", flush=True)


def ensure_user(db, key, name, role):
    found = db.users.find_one({"email": email(key)})
    if found:
        if found.get("demo_pack") != PACK or found["role"] != role:
            raise RuntimeError(f"Reserved demo email already used by another record: {email(key)}")
        return found
    doc = {"email": email(key), "name": name, "role": role, "password_hash": hash_password(PASSWORD),
           "created_at": now(), "demo_pack": PACK}
    doc["_id"] = db.users.insert_one(doc).inserted_id
    return doc


def ensure_profile(db, user, key, delay):
    existing = db.profiles.find_one({"user_id": user["_id"]})
    if existing and existing.get("demo_pack") != PACK:
        raise RuntimeError(f"Existing non-seed profile preserved for {key}; review manually.")
    if existing and existing.get("resume", {}).get("parse_status") == "parsed" and existing.get("chunks"):
        return existing
    path = ASSETS / f"{key}_resume.pdf"
    profile = process_resume(db, user, path.name, path.read_bytes())
    db.profiles.update_one({"_id": profile["_id"]}, {"$set": {"demo_pack": PACK}})
    time.sleep(delay)
    if profile["resume"]["parse_status"] != "parsed" or not profile.get("chunks"):
        raise RuntimeError(f"AI parsing/indexing failed for {key}; resolve provider access and rerun to resume.")
    return profile


def seed_database(db, delay=2):
    ensure_indexes(db)
    before = counts(db)
    users = {key: ensure_user(db, key, name, "recruiter") for key, name in RECRUITERS}
    for key, name, *_ in [*CANDIDATES, LIVE_CANDIDATE]:
        users[key] = ensure_user(db, key, name, "candidate")
    jobs = {}
    for item in JOBS:
        key, _, _, _, _, owner, _ = item
        job = db.jobs.find_one({"demo_pack": PACK, "demo_key": key})
        if not job:
            job = JobIn(**job_body(item)).model_dump()
            job.update(recruiter_id=users[owner]["_id"], status="open", created_at=now(), updated_at=now(),
                       closed_at=None, demo_pack=PACK, demo_key=key)
            job["_id"] = db.jobs.insert_one(job).inserted_id
        jobs[key] = job
    for key, *_ in CANDIDATES:
        print(f"Profile: {key}", flush=True)
        ensure_profile(db, users[key], key, delay)
    for job_index, item in enumerate(JOBS):
        key, _, _, _, _, owner, applicants = item
        job, recruiter = jobs[key], users[owner]
        for candidate, target in applicants:
            print(f"Application: {candidate} / {key} -> {target}", flush=True)
            user = users[candidate]
            app = db.applications.find_one({"job_id": job["_id"], "candidate_id": user["_id"]})
            if app and app.get("demo_complete"):
                continue  # Never rewind a rehearsal or alter completed seed records.
            if app and app.get("demo_pack") != PACK:
                raise RuntimeError("Existing non-seed application preserved; review manually.")
            if not app:
                if job["status"] != "open":
                    raise RuntimeError(f"Seed job {key} was closed; preserved its status. Reopen to resume.")
                app = create_application(db, user, str(job["_id"]))
                db.applications.update_one({"_id": app["_id"]}, {"$set": {"demo_pack": PACK}})
            elif app.get("assessment_status") != "ready" or (app.get("assessment") or {}).get("explain_error"):
                run_assessment(db, app, job, db.profiles.find_one({"user_id": user["_id"]}))
            time.sleep(delay)
            if app.get("assessment_status") != "ready" or (app.get("assessment") or {}).get("explain_error"):
                raise RuntimeError(f"Assessment/narrative incomplete for {candidate}/{key}; rerun after resolving API access.")
            if target != "ai_assessed" and app["status"] == "ai_assessed":
                transition(db, app, "recruiter_review", recruiter, "Fictional demo review", job["title"])
            if target in ("shortlisted", "interview") and app["status"] == "recruiter_review":
                transition(db, app, "shortlisted", recruiter, "Demo shortlist for interview practice", job["title"])
            if target == "rejected" and app["status"] == "recruiter_review":
                transition(db, app, "rejected", recruiter, "Demo outcome: required experience does not match this role", job["title"])
            if target == "interview":
                iv = db.interviews.find_one({"application_id": app["_id"]})
                if not iv:
                    # 10:00 Pakistan time, on different future days; UTC storage.
                    start = (now() + timedelta(days=job_index+2)).replace(hour=5, minute=0, second=0, microsecond=0)
                    result = schedule(InterviewIn(application_id=str(app["_id"]), start=start, duration_min=45,
                        interviewer_name="Demo Technical Panel", type="technical", location_or_link="Demo meeting room"), user=recruiter, db=db)
                    if not isinstance(result, dict):
                        raise RuntimeError("Unexpected interview conflict; existing schedule preserved.")
                    db.interviews.update_one({"application_id": app["_id"]}, {"$set": {"demo_pack": PACK}})
                current = db.applications.find_one({"_id": app["_id"]})
                if not current.get("questions"):
                    generate_questions(str(app["_id"]), GenerateQuestionsIn(), user=recruiter, db=db)
                    time.sleep(delay)
            if not app.get("notes"):
                add_note(str(app["_id"]), NoteIn(text="Fictional presentation scenario. Review evidence before recording any decision."), user=recruiter, db=db)
            db.applications.update_one({"_id": app["_id"]}, {"$set": {"demo_complete": True}})
    report = make_report(db, before)
    REPORT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2), flush=True)
    return report


def make_report(db, before=None):
    apps = list(db.applications.find({"demo_pack": PACK}))
    return {
        "pack": PACK, "generated_at_utc": now().isoformat(), "before": before, "after": counts(db),
        "demo_counts": {name: db[name].count_documents({"demo_pack": PACK}) for name in COLLECTIONS if name != "notifications"},
        "application_stages": dict(Counter(a["status"] for a in apps)),
        "ready_assessments": sum(a.get("assessment_status") == "ready" for a in apps),
        "complete_narratives": sum(bool((a.get("assessment") or {}).get("summary")) for a in apps),
        "jobs": [{"title": j["title"], "url": f"http://localhost:5173/r/jobs/{j['_id']}"} for j in db.jobs.find({"demo_pack": PACK})],
        "accounts": [{"name": u["name"], "email": u["email"], "role": u["role"]} for u in db.users.find({"demo_pack": PACK})],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--inventory", action="store_true")
    mode.add_argument("--assets-only", action="store_true")
    mode.add_argument("--apply", action="store_true")
    parser.add_argument("--delay", type=float, default=2)
    args = parser.parse_args()
    if args.delay < 0:
        parser.error("--delay must be nonnegative")
    if args.assets_only:
        create_assets()
        return
    db = get_db()
    db.command("ping")
    if args.inventory:
        print(json.dumps(make_report(db), indent=2))
        return
    # Bound SDK retries for this batch; the shared adapter still retries transient failures.
    from google import genai
    from google.genai import types
    from scripts.check_connections import _check_ai, _configured
    if not _configured(settings.generation_api_key) or not _configured(settings.GEMINI_API_KEY):
        raise RuntimeError("Configure generation and embedding API keys before seeding.")
    if not all((ASSETS / f"{c[0]}_resume.pdf").exists() for c in [*CANDIDATES, LIVE_CANDIDATE]):
        raise RuntimeError("Run --assets-only first.")
    gemini._client = genai.Client(api_key=settings.GEMINI_API_KEY,
        http_options=types.HttpOptions(timeout=25000, retry_options=types.HttpRetryOptions(attempts=1)))
    try:
        if not _check_ai():
            raise RuntimeError("AI preflight failed; no demo records were added.")
        seed_database(db, args.delay)
    finally:
        gemini._client.close()
        gemini._client = None


if __name__ == "__main__":
    logging.getLogger("evident.gemini").disabled = True
    try:
        main()
    except Exception as exc:
        # Application/provider failures may contain connection details. Print only
        # our own safe RuntimeError messages, not raw network/authentication errors.
        print(f"Seed stopped: {str(exc) if type(exc) is RuntimeError else type(exc).__name__}. Existing records were not reset.", flush=True)
        raise SystemExit(1)
