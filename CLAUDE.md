# RomRepo — agent handoff notes

Self-hosted rom/ISO library manager (think Jellyfin for emulation). FastAPI + SQLite backend, React (Vite) frontend, single Docker image, deployed on the owner's unraid server. Everything below is current as of 2026-07-19 (v1.3).

## What's new in v1.3

- **Account avatar menu.** The old bottom-of-sidebar profile link (easy to miss) is gone; the topbar now has a circular initials avatar (`.avatar` in styles.css, markup in Layout.jsx) that opens a dropdown with username/role, "Profile & appearance", and "Sign out". Closes on outside-click / route change.
- **In-browser GBA play (EmulatorJS).** "▶ Play" in GameModal for playable platforms (`CORES` map in GamePlayer.jsx: gba/gbc/gb → mGBA-family cores). GamePlayer.jsx renders a full-screen `.player-overlay` hosting an **iframe → `/play.html`** (static loader in `frontend/public/`, copied to dist root by Vite, served by the SPA catch-all since it `is_file()`). The iframe boots EmulatorJS from `cdn.emulatorjs.org/stable/data/` (needs client internet) with `EJS_core`, `EJS_gameUrl`, stable `EJS_gameName=romrepo-<id>`. Saves (battery + save states) persist in the browser's IndexedDB — same-origin iframe so durable across sessions. Gamepad works out of the box; remapping is in EmulatorJS's own ⚙ → Controls (keyboard AND gamepad). Isolating in an iframe = clean teardown on exit (no WASM/global leakage into the SPA).
- **ROM streaming endpoints.** `POST /api/games/{id}/play-token` (gated `library.download`, 10-min JWT scope `play:<id>`) → `GET /api/games/{id}/stream?token=` serves bytes **inline** (no attachment, does NOT increment `download_count`, unlike `/download`). Token is game-bound like the download token.

## What's new in v1.2

- **Sidebar Admin block** is visually segmented from the platform list (accent-tinted group with a top divider + left rule; see `.nav-section.admin` / `.nav-admin-group` in styles.css, markup in Layout.jsx).
- **10 themes total.** Added synthwave, gameboy, amber (CRT), matrix, nord, dracula, gruvbox to dark/oled/light. Each is a `[data-theme=…]` CSS-var block in styles.css; the picker in ProfilePage.jsx renders a mini colour-swatch tile per theme.
- **Per-user pop-up scaling + grid density.** ProfilePage sliders write `rr_modal_scale` (0.8–1.6) and `rr_card_w` (120–240px) to localStorage, applied as `--modal-scale` / `--card-w` on `<html>` (bootstrapped in main.jsx). The modal reads `--modal-scale` via `.modal` max-width and `.modal-cover` width. Scaling has a live mini-modal preview.
- **Manual match fixer.** Admin-only "🎯 Fix match" in GameModal → searches IGDB (`GET /api/games/{id}/match-candidates?q=`), pick a candidate → `POST /api/games/{id}/apply-match {igdb_id}`. Both gated on `scan.run`, need IGDB creds. Field/art application refactored into `scanner.apply_result(client, game, result)` (shared with the auto-matcher); IGDB client gained `raw_search()` and `by_id()`.
- **Duplicate finder.** `GET /api/duplicates` (gated `scan.run`) groups games whose titles collapse to the same base (clean_name minus disc/region/version cruft), across regions/formats/platforms. New DuplicatesPage.jsx at `/duplicates`, linked in the Admin block.
- **Download stats.** `Game.download_count` incremented on successful download; surfaced in the modal (⬇ N) and a Dashboard "Downloads" stat (`stats.downloads`). Added via the new startup migration runner (see below).

## Repo layout

```
backend/app/
  main.py            app assembly, role seeding, SPA static serving (backend/static in Docker)
  config.py          env config: ROMS_PATH, DATA_PATH, SECRET_KEY (auto-persisted to /data/secret.key), TOKEN_TTL_HOURS
  database.py        SQLAlchemy engine/session (SQLite at DATA_PATH/romrepo.db)
  models.py          User, Role, Game, Favorite, Setting + ALL_PERMISSIONS list
  security.py        scrypt password hashing (stdlib, no passlib), JWT (PyJWT HS256), require(permission) dependency
  routers/auth.py    setup/login/TOTP flows, /me, change-password, QR PNG endpoint
  routers/games.py   list/detail/platforms/stats/random, favorites PUT/DELETE, download tokens + download
  routers/admin.py   users CRUD, roles CRUD, scan trigger/status, settings (IGDB creds), test-igdb
  services/platforms.py  platform registry: slugs, IGDB ids, extensions, aliases, vendor-prefix resolution
  services/scanner.py    background scan thread + metadata/art matching pipeline
  services/igdb.py       IGDB client (Twitch client-credentials), multi-pass fuzzy search
  services/libretro.py   libretro-thumbnails cover scraper (no API key)
backend/tests/smoke_test.py  end-to-end API test (see Testing)
frontend/src/       React SPA: api.js, AuthContext, components/{Layout,GameCard,GameModal}, pages/{AuthPage,Dashboard,Library,UsersPage,RolesPage,SettingsPage,ProfilePage}, styles.css (all theming)
templates/romrepo.xml   unraid Docker template (+ icon.png)
.github/workflows/docker.yml  builds ghcr.io/jonathon-healy/romrepo:latest on push to main
Dockerfile          multi-stage: node:20-alpine builds frontend → python:3.12-slim, dist copied to ./static
```

## Architecture decisions (don't re-litigate without reason)

- **SQLite on purpose.** Fine for 100k+ games; do not add Postgres. Scan slowness is IGDB rate limiting (~3 req/s throttle in igdb.py), not the DB.
- **Auth**: password (scrypt, stdlib hashlib) → short-lived "pre" JWT (scope=pre, 10 min) → TOTP verify → full JWT (12h, Bearer header). TOTP is mandatory for every account: login returns `totp_setup_required` until enrolled. QR is server-rendered PNG (`/api/auth/totp/qr?pre_token=`), secret via `/api/auth/totp/begin`.
- **Downloads** use single-purpose JWTs (scope=`dl:<game_id>`, 5 min) passed as `?token=` so plain `<a>` navigation works cross-network. Tokens are game-bound and permission-checked at redemption.
- **Roles**: permission strings in `ALL_PERMISSIONS` (library.view, library.download, scan.run, users.manage, roles.manage, settings.manage). Built-in roles Admin/Member/Viewer are seeded in main.py and non-editable (`builtin` flag). First-visit `/api/auth/setup` creates the admin when user count is 0.
- **Scanner** (services/scanner.py): rglob walk of ROMS_PATH; platform resolved per file from ancestor folders **deepest-first** via `platforms.resolve()` which also strips vendor prefixes ("Sony PlayStation 2" → ps2). Nested layouts like `Sony/PS2/...` work; that's the owner's actual layout. Unknown top folders still index (folder name = platform slug) but only COMMON_EXT files. `.bin` skipped when sibling `.cue` exists. Runs in a daemon thread; progress in module-level `status` dict polled via `/api/scan/status`.
- **Metadata pipeline** (per unmatched game): IGDB multi-pass search (with platform → without → subtitle stripped; scores vs alternative names; accept ≥0.55, early-exit ≥0.85) → on miss, mark `match_failed` → **either way**, if no cover yet, try libretro-thumbnails keyed on the raw filename stem (No-Intro naming), fallback to cleaned name. Runs even with no IGDB creds (art-only mode). "Retry unmatched" (Settings) clears match_failed flags and rescans.
- **Frontend**: no UI framework, custom CSS with variables. Themes (dark/oled/light), accent color, CRT scanline toggle — all client-side in localStorage (rr_theme, rr_accent, rr_crt), applied as `data-*` attrs on `<html>` in main.jsx. Platform-colored elements use `--phue` (hash of slug, `platformHue()` in api.js). Card tilt/shine is vanilla mousemove in GameCard.jsx setting transform + `--mx/--my`.

## Gotchas / sharp edges

- **`Base.metadata.create_all` does NOT migrate.** Adding columns to existing tables silently no-ops against the owner's live DB in /data. Adding a *new table* is fine (that's how Favorite shipped). There is now a `_migrate()` runner in main.py: a PRAGMA-guarded additive-column list (`ALTER TABLE … ADD COLUMN`) that runs at startup — that's how `download_count` reaches the live DB. **Add future columns to that list**, don't rely on create_all.
- **GHCR image name must stay lowercase** (`ghcr.io/jonathon-healy/romrepo`) — `github.repository` is `Jonathon-Healy/romrepo` and breaks docker tags; the workflow hardcodes lowercase.
- **The GHCR package is not public yet.** No Actions build has succeeded (GitHub Actions had an outage during setup — runs showed "Startup failure"). After the first green build: repo → Packages → romrepo → Package settings → Change visibility → Public. Until then `docker pull ghcr.io/...` returns `denied`.
- `/api/games/random` must stay declared **before** `/api/games/{game_id}` in games.py.
- Frontend build artifacts are served by FastAPI from `backend/static` (Docker copies `frontend/dist` there); a catch-all route serves index.html for SPA paths. `/api/art` is a StaticFiles mount of DATA_PATH/art (unauthenticated by design — image tags need it).
- IGDB creds live in the settings table (client id + secret from a free Twitch dev app), not env vars. `igdb_secret_set` is returned instead of the secret.

## Deployment reality (owner's setup)

- unraid server "Tower". Roms at `/mnt/user/Main/Emulation/ROMs` (**nested vendor folders**, e.g. `Sony/...`), mounted read-only at `/roms`. Appdata at `/mnt/user/appdata/romrepo` → `/data`. Host port **8989 was taken (Sonarr)** — owner uses a different host port; container listens on 8080.
- Actions/GHCR wasn't working at handoff, so the owner **builds locally**: source cloned at `/mnt/user/appdata/romrepo-src`, `git pull && docker build -t romrepo:latest .`, container Repository field = `romrepo:latest`. Once GHCR works and the package is public, switch the Repository back to `ghcr.io/jonathon-healy/romrepo:latest` for auto-updates.
- unraid template lives in `templates/romrepo.xml`; owner installed it by wget-ing the raw file into `/boot/config/plugins/dockerMan/templates-user/`. If you change the XML, tell them to re-wget.
- GitHub: https://github.com/Jonathon-Healy/romrepo (public). Pushes were made with a fine-grained PAT that needed **Repository permissions → Workflows: Read and write** (plain contents:write gets rejected for workflow files). Owner's account has email privacy on — commit with `jonathon-healy@users.noreply.github.com`.

## Testing

`backend/tests/smoke_test.py` is a full end-to-end run: setup → TOTP enroll (pyotp) → login/bad-code → scan fake library → assertions on games/platforms/stats → download token issuance + cross-game rejection → users/roles/permissions → favorites → random → settings → password change → TOTP reset. Run it:

```
mkdir -p /tmp/roms/snes /tmp/rrdata   # build a fake library first (see script asserts: expects 4 games)
cd backend && ROMS_PATH=/tmp/roms DATA_PATH=/tmp/rrdata python3 -m uvicorn app.main:app --port 8080 &
python3 tests/smoke_test.py
```

Fixture used originally: `snes/Super Mario World (USA).sfc`, `snes/Legend of Zelda, The - A Link to the Past (USA).smc`, `psx/Gran Turismo (USA) (Disc 1).bin+.cue`, `weirdsys/Cool Game v1.2.iso`. The script asserts `unmatched == 4` (no IGDB creds, fake names). Frontend check is just `npm run build`.

## Backlog (proposed to owner, not yet accepted)

Collections/tags (custom shelves), hash-based identification (CRC32 vs No-Intro DAT files for exact matches). ScreenScraper/TheGamesDB scrapers were skipped because both require dev API keys. **Shipped in v1.2:** manual match fixer, duplicate finder, download stats.

## Owner context

Jonathon (jonathon@healymail.com). Wants: visual showcase + organization of his collection, "fun" distinctive UI (retro/arcade direction was well received — lean into it, don't regress to generic dashboard styling), MFA on everything, downloads that work over the internet. Communicates tersely; prefers concise replies.
