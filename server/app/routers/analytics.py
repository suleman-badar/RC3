from collections import Counter

from fastapi import APIRouter, Depends

from ..constants import STATUS_LABELS, STATUSES
from ..db import as_utc, get_db, now, oid
from ..deps import require_recruiter

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/summary")
def summary(job_id: str | None = None, user: dict = Depends(require_recruiter), db=Depends(get_db)):
    job_q = {"_id": oid(job_id)} if job_id else {}
    jobs = list(db.jobs.find(job_q))
    job_ids = [j["_id"] for j in jobs]
    apps = list(db.applications.find({"job_id": {"$in": job_ids}}))

    def reached(app, status):
        return any(h["to"] == status for h in app.get("status_history") or [])

    shortlisted_ever = [a for a in apps if reached(a, "shortlisted")]
    durations = []
    for a in apps:
        first = next((h for h in a.get("status_history") or [] if h["to"] in ("shortlisted", "rejected")), None)
        if first:
            durations.append((as_utc(first["at"]) - as_utc(a["submitted_at"])).total_seconds() / 3600)
    by_stage_counter = Counter(a["status"] for a in apps)
    gaps = Counter()
    assessed = 0
    for a in apps:
        asm = a.get("assessment") or {}
        if not asm:
            continue
        assessed += 1
        for g in asm.get("gaps") or []:
            if g.get("required"):
                gaps[g["skill"]] += 1
    upcoming = db.interviews.count_documents({"status": "scheduled", "start": {"$gte": now()},
                                              "job_id": {"$in": job_ids}})
    return {
        "kpis": {
            "active_jobs": sum(1 for j in jobs if j["status"] == "open"),
            "applications": len(apps),
            "shortlisted": sum(1 for a in apps if a["status"] == "shortlisted"),
            "shortlisted_ever": len(shortlisted_ever),
            "pending_reviews": sum(1 for a in apps if a["status"] in ("ai_assessed", "recruiter_review")),
            "interviews": upcoming,
            "shortlist_rate": round(len(shortlisted_ever) / len(apps), 3) if apps else 0,
            "avg_processing_hours": round(sum(durations) / len(durations), 1) if durations else None,
        },
        "by_job": [{
            "job_id": str(j["_id"]), "title": j["title"], "status": j["status"],
            "applications": sum(1 for a in apps if a["job_id"] == j["_id"]),
            "shortlisted": sum(1 for a in shortlisted_ever if a["job_id"] == j["_id"]),
        } for j in jobs],
        "by_stage": [{"status": s, "label": STATUS_LABELS[s], "count": by_stage_counter.get(s, 0)} for s in STATUSES],
        "skill_gaps": [{"skill": s, "count": c, "share": round(c / assessed, 3) if assessed else 0}
                       for s, c in gaps.most_common(8)],
    }
