import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .db import get_db, oid
from .security import decode_token

bearer = HTTPBearer(auto_error=False)


def get_token_payload(creds: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict:
    if not creds:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        return decode_token(creds.credentials)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired, please log in again")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


def get_current_user(payload: dict = Depends(get_token_payload), db=Depends(get_db)) -> dict:
    if db.revoked_tokens.find_one({"jti": payload.get("jti")}):
        raise HTTPException(status_code=401, detail="Session ended, please log in again")
    user = db.users.find_one({"_id": oid(payload.get("sub"))})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    user["_jti"] = payload.get("jti")
    user["_exp"] = payload.get("exp")
    return user


def require_role(role: str):
    def dependency(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] != role:
            raise HTTPException(status_code=403, detail=f"Only {role}s can access this resource")
        return user

    return dependency


require_recruiter = require_role("recruiter")
require_candidate = require_role("candidate")
