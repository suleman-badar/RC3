from fastapi import APIRouter, Depends, HTTPException

from ..db import get_db, oid
from ..deps import require_recruiter
from ..schemas import SearchIn
from ..services import gemini
from ..services.search import search_profiles

router = APIRouter(prefix="/search", tags=["search"])


@router.post("/talent")
def talent_search(body: SearchIn, user: dict = Depends(require_recruiter), db=Depends(get_db)):
    app_q = {"job_id": oid(body.job_id)} if body.job_id else {}
    apps = list(db.applications.find(app_q, {"_id": 1, "candidate_id": 1, "job_id": 1}))
    by_candidate: dict = {}
    for a in apps:
        by_candidate.setdefault(a["candidate_id"], []).append(a)
    # Only applicants (recruiters may see them) who allow talent-pool use
    profiles = list(db.profiles.find({"user_id": {"$in": list(by_candidate)}, "talent_pool_opt_in": {"$ne": False}}))
    try:
        hits = search_profiles(body.query, profiles, body.limit)
    except gemini.AIError as exc:
        raise HTTPException(status_code=502, detail=f"Search failed: {exc}")
    users = {u["_id"]: u for u in db.users.find({"_id": {"$in": [h["profile"]["user_id"] for h in hits]}})}
    jobs = {j["_id"]: j for j in db.jobs.find({"_id": {"$in": [a["job_id"] for a in apps]}})}
    out = []
    for h in hits:
        uid = h["profile"]["user_id"]
        out.append({
            "candidate": {"id": str(uid), "name": users.get(uid, {}).get("name", "")},
            "relevance": h["relevance"],
            "evidence": h["evidence"],
            "applications": [{"id": str(a["_id"]), "job_title": jobs.get(a["job_id"], {}).get("title", "")}
                             for a in by_candidate.get(uid, [])],
        })
    return out
