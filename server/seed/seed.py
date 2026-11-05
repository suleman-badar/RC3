"""Seed the Page-4 demo scenario through the REAL pipeline (PyMuPDF + Gemini).

Usage (from the server/ folder):
    python -m seed.seed --reset            # users, job, resume PDFs parsed (no applications)
    python -m seed.seed --reset --apply    # ...and all three candidates apply (assessed by AI)
"""
import argparse
import pathlib
import sys
import time

import fitz  # PyMuPDF

from app.config import settings
from app.db import ensure_indexes, get_client, get_db, now
from app.routers.applications import create_application
from app.routers.profile import process_resume
from app.security import hash_password

HERE = pathlib.Path(__file__).parent
PASSWORD = "Demo@12345"

USERS = [
    ("Rida Recruiter", "recruiter@evident.demo", "recruiter"),
    ("Hamza HR", "hr2@evident.demo", "recruiter"),
    ("Aisha Khan", "aisha@evident.demo", "candidate"),
    ("Bilal Ahmed", "bilal@evident.demo", "candidate"),
    ("Sara Malik", "sara@evident.demo", "candidate"),
]

JOB = {
    "title": "Backend Developer",
    "department": "Engineering",
    "location": "Lahore / Remote",
    "type": "full_time",
    "salary_min": 150000,
    "salary_max": 250000,
    "currency": "PKR",
    "description": (
        "We are hiring a Backend Developer to build and scale our APIs. You must have strong Python and Django "
        "experience, design schemas and queries in PostgreSQL, and ship services in Docker containers. Experience "
        "designing REST APIs is a plus. Minimum 2 years of professional backend experience. A Bachelor's degree in "
        "Computer Science or a related field is required."
    ),
    "required_skills": [
        {"name": "Python", "importance": "critical"},
        {"name": "Django", "importance": "critical"},
        {"name": "PostgreSQL", "importance": "important"},
        {"name": "Docker", "importance": "important"},
    ],
    "preferred_skills": [{"name": "REST APIs", "importance": "nice"}],
    "min_experience_years": 2,
    "qualifications": ["Bachelor's in Computer Science or related"],
}


def text_to_pdf(text: str, out: pathlib.Path) -> bytes:
    doc = fitz.open()
    page = doc.new_page()
    rect = fitz.Rect(50, 50, page.rect.width - 50, page.rect.height - 50)
    page.insert_textbox(rect, text, fontsize=10, fontname="helv")
    data = doc.tobytes()
    doc.close()
    out.write_bytes(data)
    return data


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="drop the database first")
    parser.add_argument("--apply", action="store_true", help="also apply all candidates to the job")
    args = parser.parse_args()

    if not settings.generation_api_key.strip():
        sys.exit(f"{settings.AI_PROVIDER.upper()}_API_KEY is missing in server/.env.")
    if not settings.GEMINI_API_KEY:
        sys.exit("GEMINI_API_KEY is missing in server/.env — the seed uses the real AI pipeline.")
    if args.reset:
        get_client().drop_database(settings.MONGODB_DB)
        print(f"Dropped database '{settings.MONGODB_DB}'")
    db = get_db()
    ensure_indexes(db)

    users = {}
    for name, email, role in USERS:
        u = db.users.find_one({"email": email})
        if not u:
            u = {"name": name, "email": email, "password_hash": hash_password(PASSWORD), "role": role,
                 "created_at": now()}
            u["_id"] = db.users.insert_one(u).inserted_id
        users[email] = u
    print(f"Users ready (password for all: {PASSWORD})")

    recruiter = users["recruiter@evident.demo"]
    job = db.jobs.find_one({"title": JOB["title"], "recruiter_id": recruiter["_id"]})
    if not job:
        job = {**JOB, "recruiter_id": recruiter["_id"], "status": "open", "created_at": now(),
               "updated_at": now(), "closed_at": None}
        job["_id"] = db.jobs.insert_one(job).inserted_id
    print(f"Job ready: {job['title']} ({job['_id']})")

    pdf_dir = HERE / "pdfs"
    pdf_dir.mkdir(exist_ok=True)
    for key in ("aisha", "bilal", "sara"):
        user = users[f"{key}@evident.demo"]
        text = (HERE / "resumes" / f"{key}.txt").read_text(encoding="utf-8")
        pdf = text_to_pdf(text, pdf_dir / f"{key}_resume.pdf")
        t0 = time.time()
        prof = process_resume(db, user, f"{key}_resume.pdf", pdf)
        status = prof["resume"]["parse_status"]
        skills = [s["name"] for s in (prof.get("parsed") or {}).get("skills", [])]
        print(f"  {user['name']}: parse={status} in {time.time() - t0:.1f}s, skills={skills}")
        if status != "parsed":
            print(f"    error: {prof['resume'].get('parse_error')}")
            continue
        if args.apply and not db.applications.find_one({"job_id": job["_id"], "candidate_id": user["_id"]}):
            app = create_application(db, user, str(job["_id"]))
            score = (app.get("assessment") or {}).get("score")
            print(f"    applied → status={app['status']} score={score} assessment={app['assessment_status']}")
    print(f"\nDone. Resume PDFs for live upload are in {pdf_dir}")


if __name__ == "__main__":
    main()
