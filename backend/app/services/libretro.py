"""libretro-thumbnails cover art scraper.

No API key or account needed. Art is keyed by No-Intro/Redump names, so
properly named rom sets match extremely well. https://thumbnails.libretro.com
"""
import logging
import re
from urllib.parse import quote

import httpx

log = logging.getLogger("romrepo.libretro")

BASE = "https://thumbnails.libretro.com"

SYSTEMS = {
    "nes": "Nintendo - Nintendo Entertainment System",
    "snes": "Nintendo - Super Nintendo Entertainment System",
    "n64": "Nintendo - Nintendo 64",
    "gamecube": "Nintendo - GameCube",
    "wii": "Nintendo - Wii",
    "wiiu": "Nintendo - Wii U",
    "gb": "Nintendo - Game Boy",
    "gbc": "Nintendo - Game Boy Color",
    "gba": "Nintendo - Game Boy Advance",
    "nds": "Nintendo - Nintendo DS",
    "3ds": "Nintendo - Nintendo 3DS",
    "virtualboy": "Nintendo - Virtual Boy",
    "psx": "Sony - PlayStation",
    "ps2": "Sony - PlayStation 2",
    "ps3": "Sony - PlayStation 3",
    "psp": "Sony - PlayStation Portable",
    "psvita": "Sony - PlayStation Vita",
    "genesis": "Sega - Mega Drive - Genesis",
    "segacd": "Sega - Mega-CD - Sega CD",
    "sega32x": "Sega - 32X",
    "saturn": "Sega - Saturn",
    "dreamcast": "Sega - Dreamcast",
    "mastersystem": "Sega - Master System - Mark III",
    "gamegear": "Sega - Game Gear",
    "xbox": "Microsoft - Xbox",
    "xbox360": "Microsoft - Xbox 360",
    "atari2600": "Atari - 2600",
    "atari7800": "Atari - 7800",
    "lynx": "Atari - Lynx",
    "jaguar": "Atari - Jaguar",
    "pcengine": "NEC - PC Engine - TurboGrafx 16",
    "neogeo": "SNK - Neo Geo",
    "wonderswan": "Bandai - WonderSwan",
    "c64": "Commodore - 64",
    "amiga": "Commodore - Amiga",
    "3do": "The 3DO Company - 3DO",
    "dos": "DOS",
    "arcade": "MAME",
}

# libretro replaces these filename chars with underscores
_FORBIDDEN = re.compile(r"[&*/:`<>?\\|\"]")


def _sanitize(name: str) -> str:
    return _FORBIDDEN.sub("_", name).strip()


def fetch_cover(platform_slug: str, filename: str, clean_name: str, dest_path) -> bool:
    """Try to download box art. Returns True on success."""
    system = SYSTEMS.get(platform_slug)
    if not system:
        return False
    stem = filename.rsplit(".", 1)[0]
    candidates = [stem]
    if clean_name and clean_name != stem:
        candidates.append(clean_name)
    for name in candidates:
        url = f"{BASE}/{quote(system)}/Named_Boxarts/{quote(_sanitize(name))}.png"
        try:
            r = httpx.get(url, timeout=20, follow_redirects=True)
            if r.status_code == 200 and r.content[:4] == b"\x89PNG":
                dest_path.write_bytes(r.content)
                return True
        except Exception as e:
            log.debug("libretro fetch failed %s: %s", url, e)
    return False
