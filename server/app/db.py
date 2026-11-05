from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from fastapi import HTTPException
from pymongo import ASCENDING, MongoClient

from .config import settings

_client = None


def get_client():
    global _client
    if _client is None:
        if settings.MONGODB_URI.startswith("mongomock"):
            import mongomock  # test-only dependency

            _client = mongomock.MongoClient(tz_aware=True)
        else:
            _client = MongoClient(settings.MONGODB_URI, serverSelectionTimeoutMS=5000, tz_aware=True)
    return _client


def get_db():
    return get_client()[settings.MONGODB_DB]


def now() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def oid(value: Any) -> ObjectId:
    if isinstance(value, ObjectId):
        return value
    try:
        return ObjectId(str(value))
    except Exception:
        raise HTTPException(status_code=404, detail="Not found")


def serialize(value: Any) -> Any:
    """Convert Mongo documents to JSON-friendly structures. `_id` becomes `id`."""
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, datetime):
        return as_utc(value).isoformat().replace("+00:00", "Z")
    if isinstance(value, list):
        return [serialize(v) for v in value]
    if isinstance(value, dict):
        out = {}
        for k, v in value.items():
            if k == "_id":
                out["id"] = serialize(v)
            elif k in ("password_hash", "embedding"):
                continue
            else:
                out[k] = serialize(v)
        return out
    return value


def ensure_indexes(db) -> None:
    db.users.create_index([("email", ASCENDING)], unique=True)
    db.profiles.create_index([("user_id", ASCENDING)], unique=True)
    db.jobs.create_index([("recruiter_id", ASCENDING)])
    db.jobs.create_index([("status", ASCENDING)])
    db.applications.create_index([("job_id", ASCENDING), ("candidate_id", ASCENDING)], unique=True)
    db.applications.create_index([("status", ASCENDING)])
    db.interviews.create_index([("application_id", ASCENDING)])
    db.interviews.create_index([("interviewer_key", ASCENDING), ("start", ASCENDING)])
    db.interviews.create_index([("candidate_id", ASCENDING), ("start", ASCENDING)])
    db.notifications.create_index([("user_id", ASCENDING), ("created_at", ASCENDING)])
    db.revoked_tokens.create_index([("jti", ASCENDING)], unique=True)
