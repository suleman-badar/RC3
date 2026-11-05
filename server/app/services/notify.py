"""Simulated notifications (in-app inbox), as permitted by the problem statement."""
from ..db import now


def notify(db, user_id, kind: str, message: str, link: str = "") -> None:
    db.notifications.insert_one({
        "user_id": user_id, "type": kind, "message": message, "link": link,
        "read": False, "created_at": now(),
    })
