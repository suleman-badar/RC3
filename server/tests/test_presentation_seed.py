from copy import deepcopy

import mongomock
import pytest

from app.services import gemini
from app.services.chunks import embed_chunks
from app.services.parsing import postprocess
from seed import presentation as seed
from seed.demo_data import CANDIDATES, JOBS, PACK, email, resume_sections


@pytest.fixture
def demo_seed(monkeypatch, tmp_path):
    monkeypatch.setattr(seed, "ASSETS", tmp_path)
    monkeypatch.setattr(seed, "REPORT", tmp_path / "report.json")
    for row in CANDIDATES:
        (tmp_path / f"{row[0]}_resume.pdf").write_bytes(b"mocked test upload")
    monkeypatch.setattr(seed, "hash_password", lambda _: "hashed-demo-password")

    def parse(db, user, filename, data):
        candidate = next(c for c in CANDIDATES if email(c[0]) == user["email"])
        _, name, role, years, skills, project = candidate
        raw = "\n".join(body for _, body in resume_sections(candidate))
        parsed = postprocess({"contact": {"name": name}, "skills": [
            {"name": s, "excerpt": ", ".join(skills)} for s in skills],
            "projects": [{"name": project, "description": raw, "technologies": skills, "excerpt": project}],
            "total_years_experience": years}, raw)
        doc = {"user_id": user["_id"], "resume": {"parse_status": "parsed"},
               "parsed": parsed, "chunks": embed_chunks(parsed), "talent_pool_opt_in": True}
        doc["_id"] = db.profiles.insert_one(doc).inserted_id
        return doc

    def generate(prompt, schema, temperature=0.2):
        if schema.__name__ == "ExplainOut":
            return schema(summary="Test narrative from supplied evidence.", learning_suggestions=[])
        if schema.__name__ == "XQuestions":
            return schema(questions=[{"difficulty": "intermediate", "category": "role",
                "question": "Explain your approach to testing.", "guideline": "Concrete evidence."}])
        raise AssertionError(schema.__name__)

    monkeypatch.setattr(seed, "process_resume", parse)
    monkeypatch.setattr(gemini, "generate_json", generate)
    return mongomock.MongoClient(tz_aware=True).demo


def test_seed_is_additive_repeatable_and_preserves_rehearsals(demo_seed):
    db = demo_seed
    original = {"email": "existing@example.org", "role": "candidate", "name": "Existing User"}
    original["_id"] = db.users.insert_one(original).inserted_id
    first = seed.seed_database(db, delay=0)
    assert first["demo_counts"] == {"users": 15, "jobs": 6, "profiles": 12, "applications": 24, "interviews": 3}
    assert first["ready_assessments"] == first["complete_narratives"] == 24
    assert db.profiles.count_documents({"user_id": db.users.find_one({"email": email('live')})["_id"]}) == 0
    assert db.users.find_one({"_id": original["_id"]}) == original
    app = db.applications.find_one({"status": "shortlisted"})
    db.applications.update_one({"_id": app["_id"]}, {"$set": {"status": "interview", "notes": [{"text": "rehearsal note"}]}})
    snapshots = {c: list(db[c].find()) for c in seed.COLLECTIONS}
    seed.seed_database(db, delay=0)
    assert {c: list(db[c].find()) for c in seed.COLLECTIONS} == snapshots


def test_reserved_email_collision_is_not_overwritten(demo_seed):
    demo_seed.users.insert_one({"email": email("lead"), "name": "Keep me", "role": "recruiter"})
    with pytest.raises(RuntimeError, match="Reserved demo email"):
        seed.seed_database(demo_seed, delay=0)
    assert demo_seed.users.count_documents({}) == 1
    assert demo_seed.jobs.count_documents({}) == 0
