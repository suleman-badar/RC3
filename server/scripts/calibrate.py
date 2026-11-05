"""Print best cosine similarity per job skill for each seeded candidate to tune SEM_THRESHOLD.

Run after `python -m seed.seed --reset`:  python -m scripts.calibrate
"""
from app.db import get_db
from app.services import gemini

if __name__ == "__main__":
    db = get_db()
    job = db.jobs.find_one({"title": "Backend Developer"})
    skills = [s["name"] for s in job["required_skills"] + job.get("preferred_skills", [])]
    qv = gemini.embed([f"Skill: {s}" for s in skills])
    print(f"{'candidate':<14}" + "".join(f"{s[:12]:>14}" for s in skills))
    for prof in db.profiles.find({}):
        user = db.users.find_one({"_id": prof["user_id"]})
        chunks = [c for c in prof.get("chunks") or [] if c.get("embedding")]
        if not chunks:
            continue
        sims = gemini.cosine_matrix(qv, [c["embedding"] for c in chunks])
        print(f"{user['name'][:13]:<14}" + "".join(f"{float(row.max()):>14.3f}" for row in sims))
    print("\nSet SEM_THRESHOLD in .env between the values of true matches and non-matches (default 0.72).")
