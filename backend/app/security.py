import base64
import hashlib
import hmac
import os
import time

import jwt
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .config import SECRET_KEY, TOKEN_TTL_HOURS
from .database import get_db
from .models import User

_SCRYPT = {"n": 2 ** 14, "r": 8, "p": 1}


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.scrypt(password.encode(), salt=salt, dklen=32, **_SCRYPT)
    return "scrypt$" + base64.b64encode(salt).decode() + "$" + base64.b64encode(dk).decode()


def verify_password(password: str, stored: str) -> bool:
    try:
        _, salt_b64, dk_b64 = stored.split("$")
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(dk_b64)
        dk = hashlib.scrypt(password.encode(), salt=salt, dklen=32, **_SCRYPT)
        return hmac.compare_digest(dk, expected)
    except Exception:
        return False


def make_token(user_id: int, scope: str = "full", ttl_seconds: int | None = None) -> str:
    now = int(time.time())
    exp = now + (ttl_seconds if ttl_seconds else TOKEN_TTL_HOURS * 3600)
    return jwt.encode(
        {"sub": str(user_id), "scope": scope, "iat": now, "exp": exp},
        SECRET_KEY,
        algorithm="HS256",
    )


def decode_token(token: str, scope: str = "full") -> int:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid or expired token")
    if payload.get("scope") != scope:
        raise HTTPException(401, "Wrong token scope")
    return int(payload["sub"])


def _extract_token(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    raise HTTPException(401, "Not authenticated")


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    user_id = decode_token(_extract_token(request))
    user = db.get(User, user_id)
    if not user or user.disabled:
        raise HTTPException(401, "Account unavailable")
    return user


def require(permission: str):
    def dep(user: User = Depends(current_user)) -> User:
        if permission not in user.permissions:
            raise HTTPException(403, f"Missing permission: {permission}")
        return user

    return dep
