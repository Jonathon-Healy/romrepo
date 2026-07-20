import os
import secrets
from pathlib import Path

ROMS_PATH = Path(os.environ.get("ROMS_PATH", "/roms"))
DATA_PATH = Path(os.environ.get("DATA_PATH", "/data"))
ART_PATH = DATA_PATH / "art"
DB_PATH = DATA_PATH / "romrepo.db"

DATA_PATH.mkdir(parents=True, exist_ok=True)
ART_PATH.mkdir(parents=True, exist_ok=True)


def _secret_key() -> str:
    env = os.environ.get("SECRET_KEY")
    if env:
        return env
    f = DATA_PATH / "secret.key"
    if f.exists():
        return f.read_text().strip()
    key = secrets.token_hex(32)
    f.write_text(key)
    try:
        f.chmod(0o600)
    except OSError:
        pass
    return key


SECRET_KEY = _secret_key()
TOKEN_TTL_HOURS = int(os.environ.get("TOKEN_TTL_HOURS", "12"))
APP_NAME = "Rom Repo"
