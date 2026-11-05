from datetime import datetime, timezone

from disposable_email_domains import blocklist
from fastapi import APIRouter, Depends, HTTPException, Response
from pymongo.errors import DuplicateKeyError

from ..db import get_db, now
from ..deps import get_current_user
from ..schemas import LoginIn, RegisterIn
from ..security import create_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


def public_user(u: dict) -> dict:
    return {"id": str(u["_id"]), "name": u["name"], "email": u["email"], "role": u["role"]}


@router.post("/register", status_code=201)
def register(body: RegisterIn, db=Depends(get_db)):
    domain = body.email.rsplit("@", 1)[1].lower()
    labels = domain.split(".")
    if any(".".join(labels[i:]) in blocklist for i in range(len(labels))):
        raise HTTPException(
            status_code=400,
            detail="Disposable email addresses are not allowed. Please use a permanent email.",
        )
    doc = {
        "name": body.name.strip(),
        "email": body.email.lower(),
        "password_hash": hash_password(body.password),
        "role": body.role,
        "created_at": now(),
    }
    try:
        res = db.users.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    doc["_id"] = res.inserted_id
    return {"token": create_token(str(doc["_id"]), doc["role"]), "user": public_user(doc)}


@router.post("/login")
def login(body: LoginIn, db=Depends(get_db)):
    user = db.users.find_one({"email": body.email.lower()})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {"token": create_token(str(user["_id"]), user["role"]), "user": public_user(user)}


@router.post("/logout", status_code=204)
def logout(user: dict = Depends(get_current_user), db=Depends(get_db)):
    exp = user.get("_exp")
    db.revoked_tokens.update_one(
        {"jti": user["_jti"]},
        {"$set": {"jti": user["_jti"],
                  "expires_at": datetime.fromtimestamp(exp, tz=timezone.utc) if exp else now()}},
        upsert=True,
    )
    return Response(status_code=204)


@router.get("/me")
def me(user: dict = Depends(get_current_user)):
    return public_user(user)
