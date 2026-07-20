from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..config import ROMS_PATH
from ..database import get_db
from ..models import ALL_PERMISSIONS, Game, Role, User, get_setting, set_setting
from ..security import hash_password, require
from ..services import scanner
from ..services.igdb import IGDBClient

router = APIRouter(prefix="/api", tags=["admin"])


# ---------- users ----------

class UserCreate(BaseModel):
    username: str
    password: str
    role_id: int


class UserPatch(BaseModel):
    role_id: int | None = None
    disabled: bool | None = None
    password: str | None = None


def _user_out(u: User):
    return {"id": u.id, "username": u.username, "role_id": u.role_id,
            "role": u.role.name, "disabled": u.disabled,
            "totp_enabled": u.totp_enabled,
            "created_at": u.created_at.isoformat() if u.created_at else None}


@router.get("/users")
def list_users(db: Session = Depends(get_db), _=Depends(require("users.manage"))):
    return [_user_out(u) for u in db.query(User).order_by(User.username).all()]


@router.post("/users")
def create_user(body: UserCreate, db: Session = Depends(get_db),
                _=Depends(require("users.manage"))):
    if len(body.username) < 3 or len(body.password) < 8:
        raise HTTPException(400, "Username min 3 chars, password min 8")
    if db.query(User).filter_by(username=body.username).first():
        raise HTTPException(409, "Username taken")
    if not db.get(Role, body.role_id):
        raise HTTPException(400, "Unknown role")
    u = User(username=body.username, password_hash=hash_password(body.password),
             role_id=body.role_id)
    db.add(u)
    db.commit()
    return _user_out(u)


@router.patch("/users/{user_id}")
def patch_user(user_id: int, body: UserPatch, db: Session = Depends(get_db),
               admin: User = Depends(require("users.manage"))):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "User not found")
    if body.role_id is not None:
        if not db.get(Role, body.role_id):
            raise HTTPException(400, "Unknown role")
        if u.id == admin.id:
            raise HTTPException(400, "Cannot change your own role")
        u.role_id = body.role_id
    if body.disabled is not None:
        if u.id == admin.id:
            raise HTTPException(400, "Cannot disable yourself")
        u.disabled = body.disabled
    if body.password:
        if len(body.password) < 8:
            raise HTTPException(400, "Password min 8 chars")
        u.password_hash = hash_password(body.password)
    db.commit()
    return _user_out(u)


@router.post("/users/{user_id}/reset-totp")
def reset_totp(user_id: int, db: Session = Depends(get_db),
               _=Depends(require("users.manage"))):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "User not found")
    u.totp_secret = None
    u.totp_enabled = False
    db.commit()
    return {"ok": True}


@router.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db),
                admin: User = Depends(require("users.manage"))):
    if user_id == admin.id:
        raise HTTPException(400, "Cannot delete yourself")
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "User not found")
    db.delete(u)
    db.commit()
    return {"ok": True}


# ---------- roles ----------

class RoleBody(BaseModel):
    name: str
    permissions: list[str]


def _role_out(r: Role, db: Session):
    return {"id": r.id, "name": r.name, "permissions": r.permissions,
            "builtin": r.builtin,
            "user_count": db.query(User).filter_by(role_id=r.id).count()}


@router.get("/roles")
def list_roles(db: Session = Depends(get_db), _=Depends(require("users.manage"))):
    return {"permissions": ALL_PERMISSIONS,
            "roles": [_role_out(r, db) for r in db.query(Role).order_by(Role.id)]}


@router.post("/roles")
def create_role(body: RoleBody, db: Session = Depends(get_db),
                _=Depends(require("roles.manage"))):
    if db.query(Role).filter_by(name=body.name).first():
        raise HTTPException(409, "Role name taken")
    r = Role(name=body.name)
    r.permissions = body.permissions
    db.add(r)
    db.commit()
    return _role_out(r, db)


@router.patch("/roles/{role_id}")
def patch_role(role_id: int, body: RoleBody, db: Session = Depends(get_db),
               _=Depends(require("roles.manage"))):
    r = db.get(Role, role_id)
    if not r:
        raise HTTPException(404, "Role not found")
    if r.builtin:
        raise HTTPException(400, "Built-in roles cannot be edited")
    r.name = body.name
    r.permissions = body.permissions
    db.commit()
    return _role_out(r, db)


@router.delete("/roles/{role_id}")
def delete_role(role_id: int, db: Session = Depends(get_db),
                _=Depends(require("roles.manage"))):
    r = db.get(Role, role_id)
    if not r:
        raise HTTPException(404, "Role not found")
    if r.builtin:
        raise HTTPException(400, "Built-in roles cannot be deleted")
    if db.query(User).filter_by(role_id=r.id).count():
        raise HTTPException(400, "Role is in use")
    db.delete(r)
    db.commit()
    return {"ok": True}


# ---------- scan ----------

@router.post("/scan")
def start_scan(_=Depends(require("scan.run"))):
    if not scanner.start_scan():
        raise HTTPException(409, "Scan already running")
    return {"ok": True}


@router.post("/scan/retry-unmatched")
def retry_unmatched(db: Session = Depends(get_db), _=Depends(require("scan.run"))):
    if not scanner.retry_unmatched(db):
        raise HTTPException(409, "Scan already running")
    return {"ok": True}


@router.get("/scan/status")
def scan_status(_=Depends(require("library.view"))):
    return scanner.status


# ---------- manual match fixer ----------

class ApplyMatchBody(BaseModel):
    igdb_id: int


def _igdb_client(db: Session) -> IGDBClient:
    cid = get_setting(db, "igdb_client_id")
    secret = get_setting(db, "igdb_client_secret")
    if not cid or not secret:
        raise HTTPException(400, "IGDB credentials not set (Settings → IGDB).")
    return IGDBClient(cid, secret)


@router.get("/games/{game_id}/match-candidates")
def match_candidates(game_id: int, q: str | None = None, db: Session = Depends(get_db),
                     _=Depends(require("scan.run"))):
    import datetime
    from ..services import platforms
    g = db.get(Game, game_id)
    if not g:
        raise HTTPException(404, "Game not found")
    client = _igdb_client(db)
    info = platforms.PLATFORMS.get(g.platform)
    query = (q or g.name).strip()
    try:
        results = client.raw_search(query, info["igdb"] if info else None)
    except Exception as e:
        raise HTTPException(502, f"IGDB search failed: {e}")
    candidates = []
    for r in results:
        year = None
        if r.get("first_release_date"):
            year = datetime.datetime.fromtimestamp(
                r["first_release_date"], datetime.timezone.utc).year
        candidates.append({
            "igdb_id": r.get("id"),
            "name": r.get("name"),
            "year": year,
            "cover": client.cover_url(r),
            "summary": (r.get("summary") or "")[:200],
        })
    return {"query": query, "candidates": candidates}


@router.post("/games/{game_id}/apply-match")
def apply_match(game_id: int, body: ApplyMatchBody, db: Session = Depends(get_db),
                _=Depends(require("scan.run"))):
    g = db.get(Game, game_id)
    if not g:
        raise HTTPException(404, "Game not found")
    client = _igdb_client(db)
    try:
        result = client.by_id(body.igdb_id)
    except Exception as e:
        raise HTTPException(502, f"IGDB lookup failed: {e}")
    if not result:
        raise HTTPException(404, "IGDB game not found")
    scanner.apply_result(client, g, result)
    db.commit()
    return {"ok": True}


# ---------- settings ----------

class SettingsBody(BaseModel):
    igdb_client_id: str | None = None
    igdb_client_secret: str | None = None


@router.get("/settings")
def get_settings(db: Session = Depends(get_db), _=Depends(require("settings.manage"))):
    secret = get_setting(db, "igdb_client_secret")
    return {
        "roms_path": str(ROMS_PATH),
        "roms_path_exists": ROMS_PATH.exists(),
        "igdb_client_id": get_setting(db, "igdb_client_id") or "",
        "igdb_secret_set": bool(secret),
        "unmatched": db.query(Game).filter(Game.match_failed.is_(True)).count(),
    }


@router.put("/settings")
def put_settings(body: SettingsBody, db: Session = Depends(get_db),
                 _=Depends(require("settings.manage"))):
    if body.igdb_client_id is not None:
        set_setting(db, "igdb_client_id", body.igdb_client_id.strip())
    if body.igdb_client_secret:
        set_setting(db, "igdb_client_secret", body.igdb_client_secret.strip())
    return {"ok": True}


@router.post("/settings/test-igdb")
def test_igdb(db: Session = Depends(get_db), _=Depends(require("settings.manage"))):
    cid = get_setting(db, "igdb_client_id")
    secret = get_setting(db, "igdb_client_secret")
    if not cid or not secret:
        raise HTTPException(400, "IGDB credentials not set")
    try:
        IGDBClient(cid, secret).test()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(502, f"IGDB connection failed: {e}")
