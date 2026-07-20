import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import APP_NAME, ART_PATH
from .database import Base, engine
from .routers import admin, auth, games

logging.basicConfig(level=logging.INFO)

Base.metadata.create_all(bind=engine)


def _seed_roles():
    from .database import SessionLocal
    from .models import ALL_PERMISSIONS, Role
    db = SessionLocal()
    try:
        defaults = [
            ("Admin", ALL_PERMISSIONS, True),
            ("Member", ["library.view", "library.download"], True),
            ("Viewer", ["library.view"], True),
        ]
        for name, perms, builtin in defaults:
            if not db.query(Role).filter_by(name=name).first():
                r = Role(name=name, builtin=builtin)
                r.permissions = perms
                db.add(r)
        db.commit()
    finally:
        db.close()


_seed_roles()

app = FastAPI(title=APP_NAME)
app.include_router(auth.router)
app.include_router(games.router)
app.include_router(admin.router)

app.mount("/api/art", StaticFiles(directory=str(ART_PATH)), name="art")

FRONTEND_DIST = Path(__file__).resolve().parent.parent / "static"
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")),
              name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        candidate = FRONTEND_DIST / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(FRONTEND_DIST / "index.html")
