"""The single entry point for application status changes: validation, audit trail and notifications."""
from fastapi import HTTPException

from ..constants import STATUS_LABELS, TRANSITIONS
from ..db import now
from .notify import notify

NOTIFY_ON = {"recruiter_review", "shortlisted", "interview", "selected", "rejected", "ai_assessed"}


def transition(db, app: dict, to: str, actor: dict | None, note: str | None = None, job_title: str = "") -> dict:
    frm = app["status"]
    if to not in TRANSITIONS.get(frm, []):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status change: {STATUS_LABELS.get(frm, frm)} → {STATUS_LABELS.get(to, to)}",
        )
    entry = {
        "from": frm,
        "to": to,
        "by": str(actor["_id"]) if actor else "system",
        "by_name": actor["name"] if actor else "System",
        "by_role": actor["role"] if actor else "system",
        "at": now(),
        "note": (note or "").strip() or None,
    }
    res = db.applications.update_one(
        {"_id": app["_id"], "status": frm},
        {"$set": {"status": to, "updated_at": entry["at"]}, "$push": {"status_history": entry}},
    )
    if res.modified_count == 0:
        raise HTTPException(status_code=409, detail="This application was changed by someone else. Refresh and retry.")
    app["status"] = to
    app.setdefault("status_history", []).append(entry)
    if to in NOTIFY_ON:
        title = job_title or "your application"
        notify(db, app["candidate_id"], "status",
               f"Your application for {title} is now: {STATUS_LABELS[to]}", "/c")
    return app
