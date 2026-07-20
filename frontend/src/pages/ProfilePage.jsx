import { useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";

const THEMES = [
  ["dark", "Dark"],
  ["oled", "OLED Black"],
  ["light", "Light"],
];

const ACCENTS = ["#7c5cff", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6"];

export default function ProfilePage() {
  const { user } = useAuth();
  const [theme, setThemeState] = useState(localStorage.getItem("rr_theme") || "dark");
  const [accent, setAccentState] = useState(localStorage.getItem("rr_accent") || "#7c5cff");
  const [crt, setCrtState] = useState(localStorage.getItem("rr_crt") === "1");

  const setCrt = (on) => {
    setCrtState(on);
    localStorage.setItem("rr_crt", on ? "1" : "0");
    document.documentElement.dataset.crt = on ? "1" : "0";
  };
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState(null);

  const setTheme = (t) => {
    setThemeState(t);
    localStorage.setItem("rr_theme", t);
    document.documentElement.dataset.theme = t;
  };

  const setAccent = (c) => {
    setAccentState(c);
    localStorage.setItem("rr_accent", c);
    document.documentElement.style.setProperty("--accent", c);
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setMsg(null);
    try {
      await api("/api/auth/change-password", {
        method: "POST",
        body: { current_password: current, new_password: next },
      });
      setCurrent("");
      setNext("");
      setMsg({ ok: true, text: "Password updated." });
    } catch (e2) {
      setMsg({ ok: false, text: e2.message });
    }
  };

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="page-title">Profile</div>
      <div className="page-sub">
        Signed in as <strong>{user.username}</strong> · {user.role}
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h3 style={{ marginBottom: 12 }}>Appearance</h3>
        <label>Theme</label>
        <div className="row" style={{ margin: "8px 0 16px" }}>
          {THEMES.map(([value, label]) => (
            <button key={value} type="button"
              className={"btn btn-sm" + (theme === value ? " btn-primary" : " btn-ghost")}
              onClick={() => setTheme(value)}>
              {label}
            </button>
          ))}
        </div>
        <label>Accent color</label>
        <div className="row" style={{ marginTop: 8, marginBottom: 16 }}>
          {ACCENTS.map((c) => (
            <button key={c} type="button" aria-label={c}
              className={"swatch" + (accent === c ? " active" : "")}
              style={{ background: c }}
              onClick={() => setAccent(c)} />
          ))}
        </div>
        <label>Retro vibes</label>
        <div className="row" style={{ marginTop: 8 }}>
          <button type="button"
            className={"btn btn-sm" + (crt ? " btn-primary" : " btn-ghost")}
            onClick={() => setCrt(!crt)}>
            {crt ? "📺 CRT scanlines on" : "📺 CRT scanlines off"}
          </button>
        </div>
      </div>

      <form className="card" onSubmit={changePassword}>
        <h3 style={{ marginBottom: 12 }}>Change password</h3>
        <div className="field">
          <label>Current password</label>
          <input type="password" value={current} autoComplete="current-password"
            onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div className="field">
          <label>New password (min 8 chars)</label>
          <input type="password" value={next} autoComplete="new-password"
            onChange={(e) => setNext(e.target.value)} />
        </div>
        <button className="btn btn-primary" disabled={!current || next.length < 8}>
          Update password
        </button>
        {msg && (
          <div className={msg.ok ? "ok-text" : "error-text"}>{msg.text}</div>
        )}
      </form>
    </div>
  );
}
