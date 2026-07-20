import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import GameModal from "./GameModal";

export default function Layout({ children }) {
  const { user, can, logout } = useAuth();
  const [platforms, setPlatforms] = useState([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [randomGame, setRandomGame] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const avatarRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const activePlatform = location.pathname === "/library" ? params.get("platform") : null;
  const showingFavs = location.pathname === "/library" && params.get("favorites") === "1";

  const rollDice = async () => {
    try {
      setRandomGame(await api("/api/games/random"));
    } catch (e) {
      alert(e.message);
    }
  };

  useEffect(() => {
    api("/api/platforms").then(setPlatforms).catch(() => {});
  }, [location.key]);

  useEffect(() => { setOpen(false); setMenuOpen(false); }, [location]);

  useEffect(() => {
    const onDoc = (e) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const initials = (user.username || "?").trim().slice(0, 2).toUpperCase();

  const submitSearch = (e) => {
    e.preventDefault();
    navigate(`/library?search=${encodeURIComponent(search)}`);
  };

  const item = ({ isActive }) => "nav-item" + (isActive ? " active" : "");

  return (
    <div className="layout">
      <aside className={"sidebar" + (open ? " open" : "")}>
        <div className="logo">Rom<span>Repo</span></div>
        <NavLink to="/" className={item} end>Dashboard</NavLink>
        <NavLink to="/library" end
          className={() => "nav-item" + (location.pathname === "/library" && !activePlatform && !showingFavs ? " active" : "")}>
          All Games
        </NavLink>
        <NavLink to="/library?favorites=1"
          className={() => "nav-item" + (showingFavs ? " active" : "")}>
          ♥ Favorites
        </NavLink>

        {platforms.length > 0 && <div className="nav-section">Platforms</div>}
        {platforms.map((p) => (
          <NavLink key={p.slug} to={`/library?platform=${p.slug}`}
            className={() => "nav-item" + (activePlatform === p.slug ? " active" : "")}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {p.name}
            </span>
            <span className="nav-count">{p.count}</span>
          </NavLink>
        ))}

        {(can("users.manage") || can("roles.manage") || can("settings.manage") || can("scan.run")) && (
          <>
            <div className="nav-section admin">⚙ Admin</div>
            <div className="nav-admin-group">
              {can("users.manage") && <NavLink to="/users" className={item}>Users</NavLink>}
              {can("roles.manage") && <NavLink to="/roles" className={item}>Roles</NavLink>}
              {can("scan.run") && <NavLink to="/duplicates" className={item}>Duplicates</NavLink>}
              {can("settings.manage") && <NavLink to="/settings" className={item}>Settings</NavLink>}
            </div>
          </>
        )}

        <div style={{ flex: 1 }} />
      </aside>

      {open && <div onClick={() => setOpen(false)}
        style={{ position: "fixed", inset: 0, zIndex: 35, background: "rgba(0,0,0,.4)" }} />}

      <div className="main">
        <div className="topbar">
          <button className="btn btn-ghost btn-sm hamburger" onClick={() => setOpen(!open)}>
            ☰
          </button>
          <form className="search" onSubmit={submitSearch}>
            <input placeholder="Search games…" value={search}
              onChange={(e) => setSearch(e.target.value)} />
          </form>
          <button className="btn btn-ghost btn-sm dice-btn" onClick={rollDice}
            title="Surprise me — random game">
            🎲
          </button>
          <div className="avatar-wrap" ref={avatarRef}>
            <button className="avatar" onClick={() => setMenuOpen((o) => !o)}
              title={`${user.username} · ${user.role}`} aria-label="Account menu">
              {initials}
            </button>
            {menuOpen && (
              <div className="avatar-menu">
                <div className="avatar-head">
                  <div className="avatar-name">{user.username}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{user.role}</div>
                </div>
                <button className="avatar-item" onClick={() => navigate("/profile")}>
                  ⚙ Profile & appearance
                </button>
                <button className="avatar-item danger" onClick={logout}>
                  ⎋ Sign out
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="content">{children}</div>
      </div>

      {randomGame && (
        <GameModal gameId={randomGame.id} onClose={() => setRandomGame(null)} />
      )}
    </div>
  );
}
