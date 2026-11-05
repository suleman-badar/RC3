from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse

from ..db import as_utc, get_db, now, oid, serialize
from ..deps import require_recruiter
from ..schemas import FeedbackIn, InterviewIn, InterviewPatchIn
from ..services.notify import notify
from ..services.pipeline import transition
from .applications import get_app_or_404

router = APIRouter(prefix="/interviews", tags=["interviews"])


def _row(db, iv: dict) -> dict:
    cand = db.users.find_one({"_id": iv["candidate_id"]}) or {}
    job = db.jobs.find_one({"_id": iv["job_id"]}) or {}
    data = serialize(iv)
    data["candidate"] = {"id": str(iv["candidate_id"]), "name": cand.get("name", "")}
    data["job"] = {"id": str(iv["job_id"]), "title": job.get("title", "")}
    data["has_feedback"] = bool(iv.get("feedback"))
    return data


@router.get("")
def list_interviews(frm: datetime | None = Query(None, alias="from"), to: datetime | None = None,
                    user: dict = Depends(require_recruiter), db=Depends(get_db)):
    q: dict = {}
    if frm or to:
        q["start"] = {}
        if frm:
            q["start"]["$gte"] = as_utc(frm)
        if to:
            q["start"]["$lte"] = as_utc(to)
    return [_row(db, iv) for iv in db.interviews.find(q).sort("start", 1)]


@router.post("", status_code=201)
def schedule(body: InterviewIn, user: dict = Depends(require_recruiter), db=Depends(get_db)):
    app = get_app_or_404(db, body.application_id)
    if app["status"] not in ("shortlisted", "interview"):
        raise HTTPException(status_code=400, detail="Only shortlisted candidates can be scheduled for interviews")
    start = as_utc(body.start)
    if start <= now():
        raise HTTPException(status_code=422, detail="Interview time must be in the future")
    end = start + timedelta(minutes=body.duration_min)
    key = body.interviewer_name.strip().lower()
    clashes = list(db.interviews.find({
        "status": "scheduled",
        "$or": [{"interviewer_key": key}, {"candidate_id": app["candidate_id"]}],
        "start": {"$lt": end},
        "end": {"$gt": start},
    }))
    if clashes and not body.force:
        conflicts = []
        for c in clashes:
            cand = db.users.find_one({"_id": c["candidate_id"]}) or {}
            conflicts.append({
                "id": str(c["_id"]), "start": serialize(c["start"]), "end": serialize(c["end"]),
                "interviewer_name": c["interviewer_name"], "candidate_name": cand.get("name", ""),
                "reason": "interviewer" if c["interviewer_key"] == key else "candidate",
            })
        return JSONResponse(status_code=409, content={"detail": {"message": "Scheduling conflict", "conflicts": conflicts}})
    job = db.jobs.find_one({"_id": app["job_id"]})
    doc = {
        "application_id": app["_id"], "job_id": app["job_id"], "candidate_id": app["candidate_id"],
        "recruiter_id": user["_id"], "interviewer_name": body.interviewer_name.strip(), "interviewer_key": key,
        "interviewer_email": body.interviewer_email, "type": body.type, "start": start, "end": end,
        "duration_min": body.duration_min, "location_or_link": body.location_or_link, "status": "scheduled",
        "conflict_overridden": bool(clashes), "feedback": None, "created_at": now(),
    }
    doc["_id"] = db.interviews.insert_one(doc).inserted_id
    if app["status"] == "shortlisted":
        transition(db, app, "interview", user, note=f"Interview scheduled ({body.type})", job_title=job["title"])
    local = start.astimezone(timezone.utc).strftime("%d %b %Y %H:%M UTC")
    notify(db, app["candidate_id"], "interview", f"Interview for {job['title']} scheduled on {local} ({body.type})", "/c")
    return _row(db, doc)


@router.patch("/{interview_id}")
def patch_interview(interview_id: str, body: InterviewPatchIn, user: dict = Depends(require_recruiter),
                    db=Depends(get_db)):
    iv = db.interviews.find_one({"_id": oid(interview_id)})
    if not iv:
        raise HTTPException(status_code=404, detail="Interview not found")
    db.interviews.update_one({"_id": iv["_id"]}, {"$set": {"status": body.status}})
    return _row(db, db.interviews.find_one({"_id": iv["_id"]}))


@router.put("/{interview_id}/feedback")
def feedback(interview_id: str, body: FeedbackIn, user: dict = Depends(require_recruiter), db=Depends(get_db)):
    iv = db.interviews.find_one({"_id": oid(interview_id)})
    if not iv:
        raise HTTPException(status_code=404, detail="Interview not found")
    if iv["status"] == "cancelled":
        raise HTTPException(status_code=400, detail="Cannot add feedback to a cancelled interview")
    fb = {**body.model_dump(), "by": str(user["_id"]), "by_name": user["name"], "at": now()}
    db.interviews.update_one({"_id": iv["_id"]}, {"$set": {"feedback": fb, "status": "completed"}})
    return _row(db, db.interviews.find_one({"_id": iv["_id"]}))
