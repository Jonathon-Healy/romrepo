from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ..config import ROMS_PATH
from ..database import get_db
from ..models import Favorite, Game, User
from ..security import decode_token, make_token, require
from ..services import platforms

router = APIRouter(prefix="/api", tags=["games"])

SORTS = {
    "name": Game.name.asc(),
    "name_desc": Game.name.desc(),
    "added": Game.added_at.desc(),
    "year": Game.release_year.desc(),
    "rating": Game.rating.desc(),
    "size": Game.size.desc(),
}


def _fav_ids(db: Session, user: User) -> set:
    return {gid for (gid,) in db.query(Favorite.game_id).filter_by(user_id=user.id)}


def _game_out(g: Game, detail=False, fav_ids=frozenset()):
    out = {
        "id": g.id,
        "name": g.name,
        "filename": g.filename,
        "platform": g.platform,
        "platform_name": platforms.display_name(g.platform),
        "size": g.size,
        "release_year": g.release_year,
        "rating": g.rating,
        "cover": f"/api/art/{g.cover_file}" if g.cover_file else None,
        "matched": g.matched,
        "favorite": g.id in fav_ids,
    }
    if detail:
        out.update({
            "summary": g.summary,
            "genres": g.genres,
            "screenshots": g.screenshots,
            "path": g.path,
            "igdb_id": g.igdb_id,
            "match_failed": g.match_failed,
            "download_count": g.download_count or 0,
            "added_at": g.added_at.isoformat() if g.added_at else None,
        })
    return out


@router.get("/games")
def list_games(
    db: Session = Depends(get_db),
    user: User = Depends(require("library.view")),
    platform: str | None = None,
    search: str | None = None,
    sort: str = "name",
    favorites: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(60, ge=1, le=200),
):
    fav_ids = _fav_ids(db, user)
    q = db.query(Game)
    if platform:
        q = q.filter(Game.platform == platform)
    if favorites:
        q = q.filter(Game.id.in_(fav_ids or {-1}))
    if search:
        like = f"%{search}%"
        q = q.filter(or_(Game.name.ilike(like), Game.filename.ilike(like)))
    total = q.count()
    order = SORTS.get(sort, SORTS["name"])
    rows = q.order_by(order, Game.id).offset((page - 1) * page_size).limit(page_size).all()
    return {"total": total, "page": page, "page_size": page_size,
            "games": [_game_out(g, fav_ids=fav_ids) for g in rows]}


@router.get("/games/random")
def random_game(db: Session = Depends(get_db),
                user: User = Depends(require("library.view")),
                platform: str | None = None):
    q = db.query(Game)
    if platform:
        q = q.filter(Game.platform == platform)
    g = q.order_by(func.random()).first()
    if not g:
        raise HTTPException(404, "Library is empty")
    return _game_out(g, detail=True, fav_ids=_fav_ids(db, user))


@router.get("/games/{game_id}")
def game_detail(game_id: int, db: Session = Depends(get_db),
                user: User = Depends(require("library.view"))):
    g = db.get(Game, game_id)
    if not g:
        raise HTTPException(404, "Game not found")
    return _game_out(g, detail=True, fav_ids=_fav_ids(db, user))


@router.put("/games/{game_id}/favorite")
def add_favorite(game_id: int, db: Session = Depends(get_db),
                 user: User = Depends(require("library.view"))):
    if not db.get(Game, game_id):
        raise HTTPException(404, "Game not found")
    if not db.get(Favorite, (user.id, game_id)):
        db.add(Favorite(user_id=user.id, game_id=game_id))
        db.commit()
    return {"favorite": True}


@router.delete("/games/{game_id}/favorite")
def remove_favorite(game_id: int, db: Session = Depends(get_db),
                    user: User = Depends(require("library.view"))):
    fav = db.get(Favorite, (user.id, game_id))
    if fav:
        db.delete(fav)
        db.commit()
    return {"favorite": False}


@router.get("/platforms")
def list_platforms(db: Session = Depends(get_db),
                   user: User = Depends(require("library.view"))):
    rows = (db.query(Game.platform, func.count(Game.id), func.sum(Game.size))
            .group_by(Game.platform).all())
    return sorted(
        ({"slug": slug, "name": platforms.display_name(slug),
          "count": count, "size": size or 0} for slug, count, size in rows),
        key=lambda p: p["name"])


@router.get("/stats")
def stats(db: Session = Depends(get_db),
          user: User = Depends(require("library.view"))):
    total = db.query(func.count(Game.id)).scalar() or 0
    size = db.query(func.sum(Game.size)).scalar() or 0
    matched = db.query(func.count(Game.id)).filter(Game.matched.is_(True)).scalar() or 0
    platform_count = db.query(func.count(func.distinct(Game.platform))).scalar() or 0
    downloads = db.query(func.sum(Game.download_count)).scalar() or 0
    recent = (db.query(Game).order_by(Game.added_at.desc(), Game.id.desc())
              .limit(12).all())
    return {"total_games": total, "total_size": size, "matched": matched,
            "platforms": platform_count, "downloads": downloads,
            "recent": [_game_out(g) for g in recent]}


@router.get("/duplicates")
def duplicates(db: Session = Depends(get_db),
               user: User = Depends(require("scan.run"))):
    """Group games whose titles collapse to the same base name (ignoring
    region/format/disc/version cruft) so the owner can spot redundant copies
    across regions, formats, or platforms."""
    import re
    from ..services.scanner import MULTIDISC_HINT, clean_name

    def norm(g: Game) -> str:
        base = MULTIDISC_HINT.sub("", clean_name(g.filename))
        return re.sub(r"[^a-z0-9]", "", base.lower())

    fav_ids = _fav_ids(db, user)
    groups: dict[str, list[Game]] = {}
    for g in db.query(Game).all():
        key = norm(g)
        if key:
            groups.setdefault(key, []).append(g)
    dupes = [
        {
            "title": max((g.name for g in gs), key=len),
            "count": len(gs),
            "platforms": sorted({g.platform for g in gs}),
            "total_size": sum(g.size or 0 for g in gs),
            "games": [_game_out(g, detail=True, fav_ids=fav_ids) for g in gs],
        }
        for gs in groups.values() if len(gs) > 1
    ]
    dupes.sort(key=lambda d: (-d["count"], d["title"].lower()))
    return {"groups": dupes, "total_groups": len(dupes)}


@router.post("/games/{game_id}/download-token")
def download_token(game_id: int, db: Session = Depends(get_db),
                   user: User = Depends(require("library.download"))):
    g = db.get(Game, game_id)
    if not g:
        raise HTTPException(404, "Game not found")
    token = make_token(user.id, scope=f"dl:{game_id}", ttl_seconds=300)
    return {"url": f"/api/games/{game_id}/download?token={token}"}


@router.get("/games/{game_id}/download")
def download(game_id: int, token: str, db: Session = Depends(get_db)):
    user_id = decode_token(token, scope=f"dl:{game_id}")
    user = db.get(User, user_id)
    if not user or user.disabled or "library.download" not in user.permissions:
        raise HTTPException(403, "Download not allowed")
    g = db.get(Game, game_id)
    if not g:
        raise HTTPException(404, "Game not found")
    file_path = (ROMS_PATH / g.path).resolve()
    if not str(file_path).startswith(str(ROMS_PATH.resolve())) or not file_path.is_file():
        raise HTTPException(404, "File missing on disk")
    g.download_count = (g.download_count or 0) + 1
    db.commit()
    return FileResponse(file_path, filename=g.filename,
                        media_type="application/octet-stream")


# ---------- in-browser play (emulator streams ROM bytes) ----------

@router.post("/games/{game_id}/play-token")
def play_token(game_id: int, db: Session = Depends(get_db),
               user: User = Depends(require("library.download"))):
    g = db.get(Game, game_id)
    if not g:
        raise HTTPException(404, "Game not found")
    token = make_token(user.id, scope=f"play:{game_id}", ttl_seconds=600)
    return {"url": f"/api/games/{game_id}/stream?token={token}"}


@router.get("/games/{game_id}/stream")
def stream(game_id: int, token: str, db: Session = Depends(get_db)):
    """Serve ROM bytes inline for the in-browser emulator. Unlike /download
    this does not force an attachment and does not count as a download."""
    user_id = decode_token(token, scope=f"play:{game_id}")
    user = db.get(User, user_id)
    if not user or user.disabled or "library.download" not in user.permissions:
        raise HTTPException(403, "Play not allowed")
    g = db.get(Game, game_id)
    if not g:
        raise HTTPException(404, "Game not found")
    file_path = (ROMS_PATH / g.path).resolve()
    if not str(file_path).startswith(str(ROMS_PATH.resolve())) or not file_path.is_file():
        raise HTTPException(404, "File missing on disk")
    return FileResponse(file_path, media_type="application/octet-stream")
