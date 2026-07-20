# Rom Repo

Self-hosted rom/ISO library manager — like Jellyfin, but for your emulation collection. Scans a folder-per-platform library, pulls box art and metadata from IGDB, and serves a clean web UI with per-user accounts, roles, and mandatory TOTP MFA. Downloads work from any device on your LAN or over the internet.

## Features

Library scanning with per-platform subfolders (snes, ps2, gba, …, 35+ platforms plus unknown-folder fallback), IGDB metadata and box art with fuzzy matching, background scans with live progress, search/sort/filter, game detail view with screenshots, authenticated downloads (short-lived tokenized URLs, safe to expose through a reverse proxy), admin/user accounts with custom roles and granular permissions, mandatory TOTP MFA for every account, dark/OLED/light themes with accent color customization.

## Quick start (unraid)

The image is auto-built by GitHub Actions and published to `ghcr.io/jonathon-healy/romrepo:latest` on every push to `main`.

1. In unraid, go to **Docker → Template Repositories** (bottom of the Docker tab) and add:

   ```
   https://github.com/jonathon-healy/romrepo
   ```

2. Click **Add Container** and pick **RomRepo** from the template dropdown. The template pre-fills the image, port 8080, `/roms` (your library, read-only) and `/data` (appdata) mappings — adjust paths and apply.

   Manual alternative: add a container with repository `ghcr.io/jonathon-healy/romrepo:latest`, port `8080`, `/roms` → your rom share, `/data` → `/mnt/user/appdata/romrepo`. Or use the included `docker-compose.yml`.

3. Open `http://SERVER-IP:8080`. The first visit walks you through creating the admin account and enrolling TOTP (scan the QR with any authenticator app).

4. In **Settings**, add IGDB credentials — create a free app at https://dev.twitch.tv/console (any name, OAuth redirect can be `http://localhost`), copy the Client ID and Secret. Then hit **Scan library**.

## Library layout

```
/roms/
  snes/Super Mario World (USA).sfc
  ps2/Gran Turismo 4.iso
  gba/...
```

Folder names are matched case-insensitively with aliases (`ps1`/`psx`, `megadrive`/`genesis`, `mame`/`arcade`, …). Unknown folders still index, using the folder name as the platform. `.cue`+`.bin` pairs show as one entry.

## Remote access

The app is a single HTTP service on port 8080 — put it behind your usual reverse proxy (Nginx Proxy Manager, SWAG, Traefik, Cloudflare Tunnel) with HTTPS. Every API call requires a bearer token obtained via password + TOTP; downloads use 5-minute single-purpose tokens, so links are safe to click from anywhere. Increase proxy timeouts/body limits if you serve very large ISOs.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `ROMS_PATH` | `/roms` | Library root (one subfolder per platform) |
| `DATA_PATH` | `/data` | Database, art cache, secret key |
| `PORT` | `8080` | Listen port |
| `TOKEN_TTL_HOURS` | `12` | Session length |
| `SECRET_KEY` | auto-generated | JWT signing key (persisted in `/data/secret.key`) |

## Roles & permissions

Built-in roles: **Admin** (everything), **Member** (view + download), **Viewer** (view only). Create custom roles with any combination of: view library, download, run scans, manage users, manage roles, manage settings. Admins can reset a user's TOTP if they lose their device.

## Development

```
# backend
cd backend && pip install -r requirements.txt
ROMS_PATH=./roms DATA_PATH=./data uvicorn app.main:app --port 8080 --reload

# frontend (proxies /api to :8080)
cd frontend && npm install && npm run dev
```
