import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";

export default function Layout({ children }) {
  const { user, can, logout } = useAuth();
  const [platforms, setPlatforms] = useState([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const activePlatform = location.pathname === "/library" ? params.get("platform") : null;

  useEffect(() => {
    api("/api/platforms").then(setPlatforms).catch(() => {});
  }, [location.key]);

  useEffect(() => setOpen(false), [location]);

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
          className={() => "nav-item" + (location.pathname === "/library" && !activePlatform ? " active" : "")}>
          All Games
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

        {(can("users.manage") || can("settings.manage")) && (
          <div className="nav-section">Admin</div>
        )}
        {can("users.manage") && <NavLink to="/users" className={item}>Users</NavLink>}
        {can("roles.manage") && <NavLink to="/roles" className={item}>Roles</NavLink>}
        {can("settings.manage") && <NavLink to="/settings" className={item}>Settings</NavLink>}

        <div style={{ flex: 1 }} />
        <NavLink to="/profile" className={item}>
          {user.username} · {user.role}
        </NavLink>
        <button className="btn btn-ghost btn-sm" onClick={logout} style={{ margin: "8px 10px" }}>
          Sign out
        </button>
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
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
