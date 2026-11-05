from fastapi import APIRouter, Depends, HTTPException

from ..db import get_db, oid, serialize
from ..deps import get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
def list_notifications(user: dict = Depends(get_current_user), db=Depends(get_db)):
    items = list(db.notifications.find({"user_id": user["_id"]}).sort("created_at", -1).limit(30))
    data = serialize(items)
    for d in data:
        d.pop("user_id", None)
    return data


@router.patch("/{notification_id}/read")
def mark_read(notification_id: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    res = db.notifications.update_one({"_id": oid(notification_id), "user_id": user["_id"]}, {"$set": {"read": True}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"ok": True}


@router.post("/read-all")
def mark_all_read(user: dict = Depends(get_current_user), db=Depends(get_db)):
    db.notifications.update_many({"user_id": user["_id"], "read": False}, {"$set": {"read": True}})
    return {"ok": True}
