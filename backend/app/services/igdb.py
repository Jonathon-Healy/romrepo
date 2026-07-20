"""IGDB metadata client (Twitch client-credentials OAuth)."""
import difflib
import logging
import re
import time

import httpx

log = logging.getLogger("romrepo.igdb")

TOKEN_URL = "https://id.twitch.tv/oauth2/token"
API_URL = "https://api.igdb.com/v4/games"
COVER_URL = "https://images.igdb.com/igdb/image/upload/t_cover_big/{}.jpg"
SCREEN_URL = "https://images.igdb.com/igdb/image/upload/t_screenshot_big/{}.jpg"


class IGDBClient:
    def __init__(self, client_id: str, client_secret: str):
        self.client_id = client_id
        self.client_secret = client_secret
        self._token = None
        self._token_exp = 0
        self._last_request = 0.0

    def _get_token(self) -> str:
        if self._token and time.time() < self._token_exp - 60:
            return self._token
        r = httpx.post(TOKEN_URL, params={
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "grant_type": "client_credentials",
        }, timeout=15)
        r.raise_for_status()
        data = r.json()
        self._token = data["access_token"]
        self._token_exp = time.time() + data.get("expires_in", 3600)
        return self._token

    def _throttle(self):
        # IGDB free tier: 4 req/s. Stay under it.
        wait = 0.3 - (time.time() - self._last_request)
        if wait > 0:
            time.sleep(wait)
        self._last_request = time.time()

    def test(self) -> bool:
        self._get_token()
        return True

    def _query(self, name: str, igdb_platform: int | None):
        self._throttle()
        token = self._get_token()
        where = f"where platforms = ({igdb_platform});" if igdb_platform else ""
        body = (
            f'search "{name}"; '
            "fields name,summary,first_release_date,total_rating,"
            "genres.name,cover.image_id,screenshots.image_id,"
            "alternative_names.name; "
            f"{where} limit 10;"
        )
        r = httpx.post(API_URL, content=body, headers={
            "Client-ID": self.client_id,
            "Authorization": f"Bearer {token}",
        }, timeout=15)
        if r.status_code == 429:
            time.sleep(2)
            return self._query(name, igdb_platform)
        r.raise_for_status()
        return r.json()

    @staticmethod
    def _score(query: str, game: dict) -> float:
        names = [game.get("name", "")]
        names += [a.get("name", "") for a in game.get("alternative_names", [])]
        q = query.lower()
        return max(
            difflib.SequenceMatcher(None, q, n.lower()).ratio()
            for n in names if n
        ) if any(names) else 0.0

    def search(self, name: str, igdb_platform: int | None):
        """Multi-pass search: exact w/ platform, w/o platform, then with
        the subtitle stripped. Scores against alternative titles too."""
        attempts = [(name, igdb_platform), (name, None)]
        short = re.split(r"\s+[-:]\s+", name)[0].strip()
        if short and short.lower() != name.lower():
            attempts.append((short, igdb_platform))
        best, best_score = None, 0.0
        for query, plat in attempts:
            for g in self._query(query, plat) or []:
                s = self._score(query, g)
                if s > best_score:
                    best, best_score = g, s
            if best_score >= 0.85:
                break  # confident hit, stop early
        return best if best_score >= 0.55 else None

    @staticmethod
    def cover_url(game: dict) -> str | None:
        img = (game.get("cover") or {}).get("image_id")
        return COVER_URL.format(img) if img else None

    @staticmethod
    def screenshot_urls(game: dict, limit=4) -> list:
        shots = game.get("screenshots") or []
        return [SCREEN_URL.format(s["image_id"]) for s in shots[:limit] if s.get("image_id")]


def download_image(url: str, dest_path) -> bool:
    try:
        r = httpx.get(url, timeout=30, follow_redirects=True)
        r.raise_for_status()
        dest_path.write_bytes(r.content)
        return True
    except Exception as e:
        log.warning("art download failed %s: %s", url, e)
        return False
