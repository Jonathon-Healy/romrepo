"""Library scanner: walks ROMS_PATH (one folder per platform), indexes files,
then matches metadata/art via IGDB in a background thread."""
import json
import logging
import re
import threading

from ..config import ART_PATH, ROMS_PATH
from ..database import SessionLocal
from ..models import Game, get_setting
from . import platforms
from .igdb import IGDBClient, download_image

log = logging.getLogger("romrepo.scanner")

MULTIDISC_HINT = re.compile(r"\((disc|disk|cd)\s*\d+\)", re.I)

status = {
    "running": False,
    "phase": "idle",       # idle | scanning | matching | done | error
    "total": 0,
    "done": 0,
    "current": "",
    "added": 0,
    "removed": 0,
    "matched": 0,
    "error": None,
}
_lock = threading.Lock()


def clean_name(filename: str) -> str:
    name = filename.rsplit(".", 1)[0]
    name = re.sub(r"[\(\[][^\)\]]*[\)\]]", " ", name)      # (USA) [!] etc.
    name = re.sub(r"\bv\d+(\.\d+)*\b", " ", name, flags=re.I)
    name = name.replace("_", " ").replace(".", " ")
    name = re.sub(r"\s+", " ", name).strip(" -")
    # "Legend of Zelda, The - A Link to the Past" -> "The Legend of Zelda - ..."
    m = re.match(r"^(.*?),\s*(The|A|An)(\s*[-:].*)?$", name, flags=re.I)
    if m:
        name = f"{m.group(2)} {m.group(1)}{m.group(3) or ''}"
    return name or filename


def _walk_library():
    """Yield (relative_path, platform_slug, size, filename)."""
    if not ROMS_PATH.exists():
        return
    for entry in sorted(ROMS_PATH.iterdir()):
        if not entry.is_dir() or entry.name.startswith("."):
            continue
        slug, info = platforms.resolve(entry.name)
        allowed = platforms.allowed_extensions(info)
        for f in sorted(entry.rglob("*")):
            if not f.is_file() or f.name.startswith("."):
                continue
            ext = f.suffix.lower()
            if allowed and ext not in allowed:
                continue
            if not allowed and ext not in platforms.COMMON_EXT:
                continue
            # skip .bin files that belong to a .cue pair
            if ext == ".bin" and f.with_suffix(".cue").exists():
                continue
            yield str(f.relative_to(ROMS_PATH)), slug, f.stat().st_size, f.name


def _scan(db):
    status.update(phase="scanning", added=0, removed=0, matched=0, done=0, total=0)
    seen = set()
    existing = {g.path: g for g in db.query(Game).all()}
    for rel, slug, size, filename in _walk_library():
        seen.add(rel)
        status["current"] = rel
        if rel in existing:
            g = existing[rel]
            if g.size != size:
                g.size = size
        else:
            db.add(Game(
                path=rel, filename=filename, platform=slug, size=size,
                name=clean_name(filename),
            ))
            status["added"] += 1
    # remove games whose files vanished
    for path, g in existing.items():
        if path not in seen:
            if g.cover_file:
                (ART_PATH / g.cover_file).unlink(missing_ok=True)
            db.delete(g)
            status["removed"] += 1
    db.commit()


def _match_metadata(db):
    client_id = get_setting(db, "igdb_client_id")
    client_secret = get_setting(db, "igdb_client_secret")
    if not client_id or not client_secret:
        log.info("IGDB credentials not set; skipping metadata pass")
        return
    client = IGDBClient(client_id, client_secret)
    pending = db.query(Game).filter(
        Game.matched.is_(False), Game.match_failed.is_(False)
    ).all()
    status.update(phase="matching", total=len(pending), done=0)
    for g in pending:
        status["current"] = g.name
        try:
            _match_one(client, g)
            db.commit()
        except Exception as e:
            log.warning("match failed for %s: %s", g.name, e)
            db.rollback()
        status["done"] += 1


def _match_one(client: IGDBClient, g: Game):
    info = platforms.PLATFORMS.get(g.platform)
    igdb_platform = info["igdb"] if info else None
    query = MULTIDISC_HINT.sub("", g.name).strip()
    result = client.search(query, igdb_platform)
    if not result:
        g.match_failed = True
        return
    g.igdb_id = result.get("id")
    g.name = result.get("name") or g.name
    g.summary = result.get("summary")
    if result.get("first_release_date"):
        import datetime
        g.release_year = datetime.datetime.fromtimestamp(
            result["first_release_date"], datetime.timezone.utc
        ).year
    g.genres = ", ".join(x["name"] for x in result.get("genres", []) if x.get("name")) or None
    g.rating = round(result["total_rating"], 1) if result.get("total_rating") else None
    cover = client.cover_url(result)
    if cover:
        fname = f"{g.id}_cover.jpg"
        if download_image(cover, ART_PATH / fname):
            g.cover_file = fname
    g.screenshots_json = json.dumps(client.screenshot_urls(result))
    g.matched = True
    status["matched"] += 1


def _run():
    db = SessionLocal()
    try:
        _scan(db)
        _match_metadata(db)
        status.update(phase="done", current="")
    except Exception as e:
        log.exception("scan failed")
        status.update(phase="error", error=str(e))
    finally:
        status["running"] = False
        db.close()


def start_scan() -> bool:
    with _lock:
        if status["running"]:
            return False
        status.update(running=True, error=None)
    threading.Thread(target=_run, daemon=True).start()
    return True


def retry_unmatched(db):
    db.query(Game).filter(Game.match_failed.is_(True)).update({"match_failed": False})
    db.commit()
    return start_scan()
