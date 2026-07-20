"""Platform registry: folder-name -> platform info.

Scanner matches first-level folder names under ROMS_PATH (case-insensitive)
against slugs and aliases. Unknown folders still index; they just get the
folder name as the platform label and no IGDB platform filter.
"""

COMMON_EXT = {".zip", ".7z", ".chd", ".iso", ".bin", ".cue", ".rvz", ".wbfs", ".pkg"}

PLATFORMS = {
    "nes":          {"name": "Nintendo Entertainment System", "igdb": 18,  "ext": {".nes", ".fds", ".unf"}},
    "snes":         {"name": "Super Nintendo",                "igdb": 19,  "ext": {".sfc", ".smc"}},
    "n64":          {"name": "Nintendo 64",                   "igdb": 4,   "ext": {".n64", ".z64", ".v64"}},
    "gamecube":     {"name": "GameCube",                      "igdb": 21,  "ext": {".gcm", ".rvz", ".iso"}},
    "wii":          {"name": "Wii",                           "igdb": 5,   "ext": {".wbfs", ".rvz", ".iso", ".wad"}},
    "wiiu":         {"name": "Wii U",                         "igdb": 41,  "ext": {".wud", ".wux", ".rpx"}},
    "switch":       {"name": "Nintendo Switch",               "igdb": 130, "ext": {".nsp", ".xci"}},
    "gb":           {"name": "Game Boy",                      "igdb": 33,  "ext": {".gb"}},
    "gbc":          {"name": "Game Boy Color",                "igdb": 22,  "ext": {".gbc"}},
    "gba":          {"name": "Game Boy Advance",              "igdb": 24,  "ext": {".gba"}},
    "nds":          {"name": "Nintendo DS",                   "igdb": 20,  "ext": {".nds"}},
    "3ds":          {"name": "Nintendo 3DS",                  "igdb": 37,  "ext": {".3ds", ".cia"}},
    "virtualboy":   {"name": "Virtual Boy",                   "igdb": 87,  "ext": {".vb"}},
    "psx":          {"name": "PlayStation",                   "igdb": 7,   "ext": {".bin", ".cue", ".chd", ".iso", ".pbp"}},
    "ps2":          {"name": "PlayStation 2",                 "igdb": 8,   "ext": {".iso", ".chd", ".cso"}},
    "ps3":          {"name": "PlayStation 3",                 "igdb": 9,   "ext": {".iso", ".pkg"}},
    "psp":          {"name": "PSP",                           "igdb": 38,  "ext": {".iso", ".cso", ".pbp"}},
    "psvita":       {"name": "PS Vita",                       "igdb": 46,  "ext": {".vpk"}},
    "xbox":         {"name": "Xbox",                          "igdb": 11,  "ext": {".iso", ".xiso"}},
    "xbox360":      {"name": "Xbox 360",                      "igdb": 12,  "ext": {".iso", ".xex"}},
    "genesis":      {"name": "Sega Genesis / Mega Drive",     "igdb": 29,  "ext": {".md", ".gen", ".smd", ".bin"}},
    "segacd":       {"name": "Sega CD",                       "igdb": 78,  "ext": {".iso", ".bin", ".cue", ".chd"}},
    "sega32x":      {"name": "Sega 32X",                      "igdb": 30,  "ext": {".32x"}},
    "saturn":       {"name": "Sega Saturn",                   "igdb": 32,  "ext": {".iso", ".bin", ".cue", ".chd"}},
    "dreamcast":    {"name": "Dreamcast",                     "igdb": 23,  "ext": {".gdi", ".cdi", ".chd"}},
    "mastersystem": {"name": "Sega Master System",            "igdb": 64,  "ext": {".sms"}},
    "gamegear":     {"name": "Game Gear",                     "igdb": 35,  "ext": {".gg"}},
    "atari2600":    {"name": "Atari 2600",                    "igdb": 59,  "ext": {".a26"}},
    "atari7800":    {"name": "Atari 7800",                    "igdb": 60,  "ext": {".a78"}},
    "lynx":         {"name": "Atari Lynx",                    "igdb": 61,  "ext": {".lnx"}},
    "jaguar":       {"name": "Atari Jaguar",                  "igdb": 62,  "ext": {".j64", ".jag"}},
    "pcengine":     {"name": "PC Engine / TurboGrafx-16",     "igdb": 86,  "ext": {".pce"}},
    "neogeo":       {"name": "Neo Geo",                       "igdb": 80,  "ext": {".neo"}},
    "arcade":       {"name": "Arcade",                        "igdb": 52,  "ext": set()},
    "dos":          {"name": "MS-DOS",                        "igdb": 13,  "ext": {".exe", ".com", ".img"}},
    "amiga":        {"name": "Amiga",                         "igdb": 16,  "ext": {".adf", ".ipf", ".hdf"}},
    "c64":          {"name": "Commodore 64",                  "igdb": 15,  "ext": {".d64", ".t64", ".tap", ".prg"}},
    "wonderswan":   {"name": "WonderSwan",                    "igdb": 57,  "ext": {".ws", ".wsc"}},
    "3do":          {"name": "3DO",                           "igdb": 50,  "ext": {".iso", ".chd", ".cue"}},
}

ALIASES = {
    "nintendoentertainmentsystem": "nes",
    "supernintendoentertainmentsystem": "snes",
    "playstation1": "psx", "psone": "psx", "playstationone": "psx",
    "playstationportable": "psp", "playstationvita": "psvita",
    "megadrive2": "genesis", "genesismegadrive": "genesis",
    "turbografx16pcengine": "pcengine",
    "famicom": "nes", "nintendo": "nes",
    "sfc": "snes", "superfamicom": "snes", "supernintendo": "snes",
    "n64dd": "n64", "nintendo64": "n64",
    "ngc": "gamecube", "gc": "gamecube",
    "gameboy": "gb", "gameboycolor": "gbc", "gameboyadvance": "gba",
    "ds": "nds", "nintendods": "nds", "nintendo3ds": "3ds",
    "ps1": "psx", "playstation": "psx", "playstation2": "ps2",
    "playstation3": "ps3", "vita": "psvita",
    "x360": "xbox360", "360": "xbox360",
    "megadrive": "genesis", "md": "genesis", "smd": "genesis",
    "sms": "mastersystem", "gg": "gamegear",
    "tg16": "pcengine", "turbografx": "pcengine", "turbografx16": "pcengine", "pce": "pcengine",
    "mame": "arcade", "fbneo": "arcade", "fba": "arcade",
    "neogeocd": "neogeo", "vb": "virtualboy",
    "atarilynx": "lynx", "atarijaguar": "jaguar",
    "commodore64": "c64", "msdos": "dos", "pc": "dos",
}


VENDOR_PREFIXES = [
    "sony", "nintendo", "sega", "microsoft", "atari", "nec", "snk",
    "bandai", "commodore", "panasonic", "sinclair",
]


def normalize(folder: str) -> str:
    return "".join(c for c in folder.lower() if c.isalnum())


def _lookup(key: str):
    if key in PLATFORMS:
        return key, PLATFORMS[key]
    if key in ALIASES:
        slug = ALIASES[key]
        return slug, PLATFORMS[slug]
    return None


def resolve(folder: str):
    """Return (slug, info|None) for a folder name.

    Tries the name as-is, then with vendor prefixes stripped
    (e.g. "Sony PlayStation 2" -> "playstation2" -> ps2).
    """
    key = normalize(folder)
    hit = _lookup(key)
    if hit:
        return hit
    for vendor in VENDOR_PREFIXES:
        if key.startswith(vendor) and len(key) > len(vendor):
            hit = _lookup(key[len(vendor):])
            if hit:
                return hit
    return folder.lower(), None


def allowed_extensions(info) -> set:
    if info is None:
        return set()  # unknown platform: accept COMMON_EXT only
    return set(info["ext"]) | COMMON_EXT


def display_name(slug: str) -> str:
    if slug in PLATFORMS:
        return PLATFORMS[slug]["name"]
    return slug.replace("_", " ").replace("-", " ").title()
