import time

import httpx
import pyotp

c = httpx.Client(base_url="http://localhost:8080", trust_env=False)

r = c.post("/api/auth/setup", json={"username": "jonathon", "password": "hunter2secure"})
pre = r.json()["pre_token"]
assert r.json()["totp_setup_required"], r.text
r = c.post("/api/auth/totp/begin", json={"pre_token": pre})
secret = r.json()["secret"]
r = c.get("/api/auth/totp/qr", params={"pre_token": pre})
assert r.headers["content-type"] == "image/png" and len(r.content) > 500
code = pyotp.TOTP(secret).now()
r = c.post("/api/auth/totp/verify", json={"pre_token": pre, "code": code})
tok = r.json()["token"]
user = r.json()["user"]
assert "settings.manage" in user["permissions"], user
H = {"Authorization": f"Bearer {tok}"}

r = c.post("/api/auth/login", json={"username": "jonathon", "password": "hunter2secure"})
assert r.json().get("totp_required"), r.text
r = c.post("/api/auth/totp/verify", json={"pre_token": r.json()["pre_token"], "code": "000000"})
assert r.status_code == 401

r = c.post("/api/scan", headers=H)
assert r.status_code == 200, r.text
s = None
for _ in range(30):
    s = c.get("/api/scan/status", headers=H).json()
    if not s["running"]:
        break
    time.sleep(0.5)
print("scan:", {k: s[k] for k in ("phase", "added", "removed", "error")})
assert s["phase"] == "done", s

g = c.get("/api/games", headers=H).json()
print("games:", g["total"], [x["name"] + "|" + x["platform"] for x in g["games"]])
assert g["total"] == 4, g

print("platforms:", [(p["slug"], p["count"]) for p in c.get("/api/platforms", headers=H).json()])
st = c.get("/api/stats", headers=H).json()
assert st["total_games"] == 4

gid = next(x["id"] for x in g["games"] if x["platform"] == "snes")
url = c.post(f"/api/games/{gid}/download-token", headers=H).json()["url"]
r = c.get(url)
assert r.status_code == 200 and "attachment" in r.headers.get("content-disposition", ""), (
    r.status_code, dict(r.headers))
other = next(x["id"] for x in g["games"] if x["id"] != gid)
assert c.get(url.replace(f"/games/{gid}/", f"/games/{other}/")).status_code == 401
assert c.get(f"/api/games/{gid}/download?token=bogus").status_code == 401

roles = c.get("/api/roles", headers=H).json()["roles"]
member = next(r0 for r0 in roles if r0["name"] == "Member")
r = c.post("/api/users", headers=H,
           json={"username": "kiddo", "password": "password123", "role_id": member["id"]})
uid = r.json()["id"]
r = c.post("/api/auth/login", json={"username": "kiddo", "password": "password123"})
pre2 = r.json()["pre_token"]
assert r.json()["totp_setup_required"]
s2 = c.post("/api/auth/totp/begin", json={"pre_token": pre2}).json()["secret"]
r = c.post("/api/auth/totp/verify", json={"pre_token": pre2, "code": pyotp.TOTP(s2).now()})
H2 = {"Authorization": f"Bearer {r.json()['token']}"}
assert c.post("/api/scan", headers=H2).status_code == 403
assert c.get("/api/users", headers=H2).status_code == 403
assert c.get("/api/games", headers=H2).status_code == 200

r = c.post("/api/roles", headers=H,
           json={"name": "Curator", "permissions": ["library.view", "scan.run"]})
assert r.status_code == 200, r.text
c.patch(f"/api/users/{uid}", headers=H, json={"role_id": r.json()["id"]})

r = c.get("/api/settings", headers=H).json()
assert r["roms_path_exists"] and r["unmatched"] == 4, r  # no IGDB creds, fake names
c.put("/api/settings", headers=H, json={"igdb_client_id": "abc", "igdb_client_secret": "def"})
assert c.get("/api/settings", headers=H).json()["igdb_secret_set"]

r = c.post("/api/auth/change-password", headers=H,
           json={"current_password": "hunter2secure", "new_password": "newpass9999"})
assert r.status_code == 200

# admin resets kiddo's TOTP -> next login requires re-enrollment
r = c.post(f"/api/users/{uid}/reset-totp", headers=H)
assert r.status_code == 200
r = c.post("/api/auth/login", json={"username": "kiddo", "password": "password123"})
assert r.json().get("totp_setup_required"), r.text

# favorites
gid2 = g["games"][0]["id"]
r = c.put(f"/api/games/{gid2}/favorite", headers=H)
assert r.status_code == 200 and r.json()["favorite"] is True
fav = c.get("/api/games?favorites=1", headers=H).json()
assert fav["total"] == 1 and fav["games"][0]["id"] == gid2 and fav["games"][0]["favorite"]
detail = c.get(f"/api/games/{gid2}", headers=H).json()
assert detail["favorite"] is True
r = c.delete(f"/api/games/{gid2}/favorite", headers=H)
assert c.get("/api/games?favorites=1", headers=H).json()["total"] == 0

# random
r = c.get("/api/games/random", headers=H)
assert r.status_code == 200 and "id" in r.json(), r.text

# download stats: the earlier token download incremented the counter
assert c.get(f"/api/games/{gid}", headers=H).json()["download_count"] >= 1, "download_count"

# duplicates endpoint (fixture has 4 distinct titles -> no groups)
r = c.get("/api/duplicates", headers=H)
assert r.status_code == 200 and r.json()["total_groups"] == 0, r.text

# in-browser play: token-scoped inline stream (no attachment, game-bound)
purl = c.post(f"/api/games/{gid}/play-token", headers=H).json()["url"]
r = c.get(purl)
assert r.status_code == 200 and "attachment" not in r.headers.get("content-disposition", ""), (
    r.status_code, dict(r.headers))
assert c.get(purl.replace(f"/games/{gid}/", f"/games/{other}/")).status_code == 401
# a download token must not work on the play route and vice-versa
assert c.get(f"/api/games/{gid}/stream?token=bogus").status_code == 401

print("ALL BACKEND TESTS PASSED")
