from datetime import datetime, timedelta, timezone

from app.db import get_db
from app.services.chunks import embed_chunks
from app.services.normalize import canonical
from app.services.parsing import postprocess
from app.services.verify import verify_excerpt

RAW = """Aisha Khan aisha@x.com +92 300 1112233
Skills: Python, Django, Postgres, Docker
Senior Backend Developer at Arbisoft: built Django REST APIs on Postgres, containerized with docker-compose
Project Clinic API: Django, Postgres, Docker booking service
BS Computer Science, FAST 2020"""

PARSED = {
    "contact": {"name": "Aisha Khan", "email": "aisha@x.com", "phone": "", "location": "Lahore", "links": []},
    "summary": "",
    "skills": [{"name": n, "excerpt": "Skills: Python, Django, Postgres, Docker"} for n in
               ["Python", "Django", "Postgres", "Docker"]] + [{"name": "AWS", "excerpt": "Led AWS migration"}],
    "education": [{"degree": "BS Computer Science", "institution": "FAST", "year": "2020",
                   "excerpt": "BS Computer Science, FAST 2020"}],
    "experience": [{"title": "Senior Backend Developer", "company": "Arbisoft", "start": "2021", "end": "Present",
                    "years": 4, "description": "built Django REST APIs on Postgres",
                    "excerpt": "built Django REST APIs on Postgres"}],
    "projects": [{"name": "Clinic API", "description": "Django, Postgres, Docker booking service",
                  "technologies": ["Django", "Postgres", "Docker"], "excerpt": "Django, Postgres, Docker booking service"}],
    "certifications": [],
    "total_years_experience": 4,
}

JOB = {
    "title": "Backend Developer", "department": "Engineering", "location": "Lahore", "type": "full_time",
    "salary_min": 100, "salary_max": 200, "currency": "PKR",
    "description": "Backend developer with Python, Django, PostgreSQL and Docker experience required.",
    "required_skills": [{"name": "Python", "importance": "critical"}, {"name": "Django", "importance": "critical"},
                        {"name": "PostgreSQL", "importance": "important"}, {"name": "Docker", "importance": "important"}],
    "preferred_skills": [], "min_experience_years": 2, "qualifications": ["Bachelor's in Computer Science"],
}


def register(client, email, role, name="Test User"):
    r = client.post("/api/auth/register", json={"name": name, "email": email, "password": "Passw0rd!", "role": role})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}, r.json()["user"]


def give_profile(user_id):
    from bson import ObjectId

    parsed = postprocess({k: (v.copy() if isinstance(v, dict) else [dict(i) for i in v] if isinstance(v, list) else v)
                          for k, v in PARSED.items()}, RAW)
    get_db().profiles.insert_one({"user_id": ObjectId(user_id), "resume": {"parse_status": "parsed", "raw_text": RAW},
                                  "parsed": parsed, "chunks": embed_chunks(parsed), "talent_pool_opt_in": True})


def setup_flow(client):
    rh, _ = register(client, "rec@x.com", "recruiter", "Rec One")
    ch, cu = register(client, "cand@x.com", "candidate", "Aisha Khan")
    job = client.post("/api/jobs", json=JOB, headers=rh).json()
    give_profile(cu["id"])
    r = client.post("/api/applications", json={"job_id": job["id"]}, headers=ch)
    assert r.status_code == 201, r.text
    return rh, ch, job, r.json()


def test_auth_register_duplicate_and_login(client):
    register(client, "a@x.com", "candidate")
    r = client.post("/api/auth/register", json={"name": "B", "email": "a@x.com", "password": "Passw0rd!", "role": "candidate"})
    assert r.status_code in (409, 422)
    assert client.post("/api/auth/login", json={"email": "a@x.com", "password": "wrong"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": "a@x.com", "password": "Passw0rd!"}).status_code == 200
    assert get_db().users.find_one({"email": "a@x.com"})["password_hash"].startswith("$2")


def test_logout_revokes_token(client):
    h, _ = register(client, "l@x.com", "candidate")
    assert client.get("/api/auth/me", headers=h).status_code == 200
    assert client.post("/api/auth/logout", headers=h).status_code == 204
    assert client.get("/api/auth/me", headers=h).status_code == 401


def test_candidate_cannot_access_recruiter_routes(client):
    rh, ch, job, _ = setup_flow(client)
    assert client.post("/api/jobs", json=JOB, headers=ch).status_code == 403
    assert client.get(f"/api/jobs/{job['id']}/applications", headers=ch).status_code == 403
    assert client.get("/api/analytics/summary", headers=ch).status_code == 403


def test_candidate_view_hides_private_data(client):
    rh, ch, job, app = setup_flow(client)
    client.post(f"/api/applications/{app['id']}/notes", json={"text": "secret note"}, headers=rh)
    mine = client.get("/api/applications/mine", headers=ch).json()
    assert mine and all(k not in mine[0] for k in ("notes", "assessment", "questions", "override"))
    assert "secret" not in str(mine)


def test_normalization():
    assert canonical("JS") == "JavaScript"
    assert canonical("postgres") == "PostgreSQL"
    assert canonical("py") == "Python"
    assert canonical("DRF") == "Django REST Framework"


def test_hallucination_flag():
    assert verify_excerpt("containerized with docker-compose", RAW)
    assert not verify_excerpt("Led AWS migration", RAW)
    parsed = postprocess({**PARSED, "skills": [dict(s) for s in PARSED["skills"]]}, RAW)
    aws = next(s for s in parsed["skills"] if s["name"] == "AWS")
    assert aws["verified"] is False


def test_assessment_weights_and_evidence(client):
    rh, ch, job, app = setup_flow(client)
    detail = client.get(f"/api/applications/{app['id']}", headers=rh).json()
    a = detail["assessment"]
    assert detail["status"] == "recruiter_review"
    total = sum(v["weighted"] for v in a["breakdown"].values())
    assert abs(total - a["score"]) <= 0.5
    assert {k: v["weight"] for k, v in a["breakdown"].items()} == {
        "skills": 0.5, "experience": 0.25, "projects": 0.15, "qualifications": 0.1}
    for s in a["skills"]:
        if s["state"] in ("matched", "semantic"):
            assert s["evidence"]["text"]
    assert any(c["item"] == "AWS" for c in a["unverified_claims"])


def test_duplicate_application(client):
    rh, ch, job, app = setup_flow(client)
    assert client.post("/api/applications", json={"job_id": job["id"]}, headers=ch).status_code == 409


def test_invalid_transition_and_audit(client):
    rh, ch, job, app = setup_flow(client)
    client.get(f"/api/applications/{app['id']}", headers=rh)
    r = client.patch(f"/api/applications/{app['id']}/status", json={"status": "selected"}, headers=rh)
    assert r.status_code == 400
    r = client.patch(f"/api/applications/{app['id']}/status", json={"status": "shortlisted"}, headers=rh)
    assert r.status_code == 200
    hist = [h["to"] for h in r.json()["status_history"]]
    assert hist == ["submitted", "parsed", "ai_assessed", "recruiter_review", "shortlisted"]


def test_skill_override_confirmed_absent(client):
    rh, ch, job, app = setup_flow(client)
    before = client.get(f"/api/applications/{app['id']}", headers=rh).json()["assessment"]["score"]
    r = client.put(f"/api/applications/{app['id']}/skill-overrides",
                   json={"overrides": [{"skill": "Docker", "state": "absent"}]}, headers=rh).json()
    docker = next(s for s in r["assessment"]["skills"] if s["skill"] == "Docker")
    assert docker["state"] == "confirmed_absent"
    assert r["assessment"]["score"] < before


def test_scheduling_conflict_and_final_decision(client):
    rh, ch, job, app = setup_flow(client)
    client.get(f"/api/applications/{app['id']}", headers=rh)
    client.patch(f"/api/applications/{app['id']}/status", json={"status": "shortlisted"}, headers=rh)
    start = (datetime.now(timezone.utc) + timedelta(days=1)).replace(microsecond=0)
    body = {"application_id": app["id"], "start": start.isoformat(), "duration_min": 60,
            "interviewer_name": "Omar", "type": "technical"}
    assert client.post("/api/interviews", json=body, headers=rh).status_code == 201
    body["start"] = (start + timedelta(minutes=30)).isoformat()
    r = client.post("/api/interviews", json=body, headers=rh)
    assert r.status_code == 409 and r.json()["detail"]["conflicts"]
    assert client.post("/api/interviews", json={**body, "force": True}, headers=rh).status_code == 201
    other, _ = register(client, "hr2@x.com", "recruiter", "HR Two")
    d = {"outcome": "selected", "reason": "Strong interview"}
    assert client.post(f"/api/applications/{app['id']}/decision", json=d, headers=other).status_code == 403
    r = client.post(f"/api/applications/{app['id']}/decision", json=d, headers=rh)
    assert r.status_code == 200 and r.json()["status"] == "selected"
    notes = client.get("/api/notifications", headers=ch).json()
    assert any("Selected" in n["message"] for n in notes)


def test_fairness_delta_zero(client):
    rh, ch, job, app = setup_flow(client)
    r = client.post(f"/api/applications/{app['id']}/fairness-check", headers=rh).json()
    assert r["delta"] == 0 and r["breakdown_identical"]


def test_analytics_and_search(client):
    rh, ch, job, app = setup_flow(client)
    client.get(f"/api/applications/{app['id']}", headers=rh)
    client.patch(f"/api/applications/{app['id']}/status", json={"status": "shortlisted"}, headers=rh)
    k = client.get("/api/analytics/summary", headers=rh).json()["kpis"]
    assert k["applications"] == 1 and k["shortlisted"] == 1 and k["shortlist_rate"] == 1.0
    res = client.post("/api/search/talent", json={"query": "Django Postgres developer"}, headers=rh).json()
    assert res and res[0]["evidence"]


def test_close_job_blocks_applications(client):
    rh, _ = register(client, "r2@x.com", "recruiter")
    ch, cu = register(client, "c2@x.com", "candidate")
    job = client.post("/api/jobs", json=JOB, headers=rh).json()
    assert job["required_skills"][2]["name"] == "PostgreSQL"
    client.patch(f"/api/jobs/{job['id']}/status", json={"status": "closed"}, headers=rh)
    give_profile(cu["id"])
    assert client.post("/api/applications", json={"job_id": job["id"]}, headers=ch).status_code == 400
    assert all(j["id"] != job["id"] for j in client.get("/api/jobs", headers=ch).json())
    bad = {**JOB, "salary_min": 500, "salary_max": 100}
    assert client.post("/api/jobs", json=bad, headers=rh).status_code == 422


def test_lexical_and_implied_evidence():
    from app.services.matching import assess, scoring_view
    raw = """Bilal Ahmed
Skills: Py, DRF, Postgres
Software Engineer at Systems: Containerized services with docker-compose for staging
BS Software Engineering, COMSATS 2022"""
    data = {"contact": {"name": "Bilal", "email": "", "phone": "", "location": "", "links": []}, "summary": "",
            "skills": [{"name": n, "excerpt": "Skills: Py, DRF, Postgres"} for n in ["Py", "DRF", "Postgres"]],
            "education": [], "certifications": [], "projects": [], "total_years_experience": 2.5,
            "experience": [{"title": "Software Engineer", "company": "Systems", "start": "", "end": "", "years": 2.5,
                            "description": "Containerized services with docker-compose for staging",
                            "excerpt": "Containerized services with docker-compose for staging"}]}
    parsed = postprocess(data, raw)
    prof = {"parsed": parsed, "chunks": embed_chunks(parsed)}
    result = assess(JOB, scoring_view(prof))
    states = {s["skill"]: s["state"] for s in result["skills"]}
    assert states == {"Python": "matched", "Django": "matched", "PostgreSQL": "matched", "Docker": "matched"}
    docker = next(s for s in result["skills"] if s["skill"] == "Docker")
    assert "docker-compose" in docker["evidence"]["text"]


def test_interview_questions_are_recruiter_only(client):
    """Spec 3.7: questions are generated, edited, removed and regenerated by recruiters only."""
    rh, ch, job, app = setup_flow(client)
    base = f"/api/applications/{app['id']}/questions"
    # A candidate can't generate, regenerate, edit or delete questions
    assert client.post(f"{base}/generate", json={}, headers=ch).status_code == 403
    assert client.post(f"{base}/generate", json={"question_id": "q_x"}, headers=ch).status_code == 403
    assert client.put(f"{base}/q_x", json={"question": "Edited question", "guideline": "", "difficulty": "beginner"},
                      headers=ch).status_code == 403
    assert client.delete(f"{base}/q_x", headers=ch).status_code == 403
    # Applying does not create questions; only an explicit recruiter action does
    detail = client.get(f"/api/applications/{app['id']}", headers=rh).json()
    assert detail["questions"] == []
    # Questions never appear in anything a candidate can read
    from app.db import get_db
    from bson import ObjectId
    get_db().applications.update_one({"_id": ObjectId(app["id"])}, {"$set": {"questions": [
        {"id": "q_1", "difficulty": "beginner", "category": "role", "question": "SECRET-QUESTION", "guideline": "SECRET-GUIDE", "edited": False}]}})
    for path in ("/api/applications/mine", f"/api/applications/{app['id']}"):
        body = client.get(path, headers=ch).text
        assert "SECRET-QUESTION" not in body and "SECRET-GUIDE" not in body and '"questions"' not in body
