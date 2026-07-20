import io
import json

import pyotp
import qrcode
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..config import APP_NAME
from ..database import get_db
from ..models import ALL_PERMISSIONS, Role, User
from ..security import (current_user, decode_token, hash_password, make_token,
                        verify_password)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class Credentials(BaseModel):
    username: str
    password: str


class TotpVerify(BaseModel):
    pre_token: str
    code: str


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


def _user_out(user: User):
    return {
        "id": user.id,
        "username": user.username,
        "role": user.role.name,
        "permissions": user.permissions,
    }


def _pre_token_user(pre_token: str, db: Session) -> User:
    user = db.get(User, decode_token(pre_token, scope="pre"))
    if not user or user.disabled:
        raise HTTPException(401, "Account unavailable")
    return user


@router.get("/status")
def status(db: Session = Depends(get_db)):
    return {"needs_setup": db.query(User).count() == 0}


@router.post("/setup")
def setup(creds: Credentials, db: Session = Depends(get_db)):
    if db.query(User).count() > 0:
        raise HTTPException(403, "Already set up")
    if len(creds.username) < 3 or len(creds.password) < 8:
        raise HTTPException(400, "Username min 3 chars, password min 8")
    admin_role = db.query(Role).filter_by(name="Admin").first()
    if not admin_role:
        admin_role = Role(name="Admin", builtin=True)
        admin_role.permissions = ALL_PERMISSIONS
        db.add(admin_role)
        db.flush()
    user = User(username=creds.username,
                password_hash=hash_password(creds.password),
                role_id=admin_role.id)
    db.add(user)
    db.commit()
    return {"pre_token": make_token(user.id, scope="pre", ttl_seconds=600),
            "totp_setup_required": True}


@router.post("/login")
def login(creds: Credentials, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(username=creds.username).first()
    if not user or not verify_password(creds.password, user.password_hash):
        raise HTTPException(401, "Invalid username or password")
    if user.disabled:
        raise HTTPException(403, "Account disabled")
    pre = make_token(user.id, scope="pre", ttl_seconds=600)
    if not user.totp_enabled:
        return {"pre_token": pre, "totp_setup_required": True}
    return {"pre_token": pre, "totp_required": True}


@router.post("/totp/begin")
def totp_begin(body: dict, db: Session = Depends(get_db)):
    """Start TOTP enrollment: generate a secret for this user."""
    user = _pre_token_user(body.get("pre_token", ""), db)
    if user.totp_enabled:
        raise HTTPException(400, "TOTP already enabled")
    user.totp_secret = pyotp.random_base32()
    db.commit()
    uri = pyotp.totp.TOTP(user.totp_secret).provisioning_uri(
        name=user.username, issuer_name=APP_NAME)
    return {"secret": user.totp_secret, "otpauth_uri": uri}


@router.get("/totp/qr")
def totp_qr(pre_token: str, db: Session = Depends(get_db)):
    user = _pre_token_user(pre_token, db)
    if not user.totp_secret:
        raise HTTPException(400, "Enrollment not started")
    uri = pyotp.totp.TOTP(user.totp_secret).provisioning_uri(
        name=user.username, issuer_name=APP_NAME)
    img = qrcode.make(uri, box_size=8, border=2)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return Response(buf.getvalue(), media_type="image/png")


@router.post("/totp/verify")
def totp_verify(body: TotpVerify, db: Session = Depends(get_db)):
    """Verify a TOTP code — completes both enrollment and normal login."""
    user = _pre_token_user(body.pre_token, db)
    if not user.totp_secret:
        raise HTTPException(400, "TOTP not configured")
    if not pyotp.TOTP(user.totp_secret).verify(body.code, valid_window=1):
        raise HTTPException(401, "Invalid code")
    if not user.totp_enabled:
        user.totp_enabled = True
        db.commit()
    return {"token": make_token(user.id), "user": _user_out(user)}


@router.get("/me")
def me(user: User = Depends(current_user)):
    return _user_out(user)


@router.post("/change-password")
def change_password(body: PasswordChange, user: User = Depends(current_user),
                    db: Session = Depends(get_db)):
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(401, "Current password is incorrect")
    if len(body.new_password) < 8:
        raise HTTPException(400, "Password min 8 chars")
    user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"ok": True}
