import { useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";

// [value, label, [swatch colors for the mini preview]]
const THEMES = [
  ["dark", "Dark", ["#12141a", "#232735", "#7c5cff"]],
  ["oled", "OLED Black", ["#000000", "#17181d", "#7c5cff"]],
  ["light", "Light", ["#f4f5f9", "#ffffff", "#3b82f6"]],
  ["synthwave", "Synthwave", ["#1a1030", "#33205c", "#ff5c8a"]],
  ["gameboy", "Game Boy", ["#0b1e0b", "#294d24", "#c6de8c"]],
  ["amber", "CRT Amber", ["#150f00", "#2b2000", "#ffc04d"]],
  ["matrix", "Matrix", ["#010d05", "#0c2415", "#5cffa0"]],
  ["nord", "Nord", ["#2e3440", "#434c5e", "#88c0d0"]],
  ["dracula", "Dracula", ["#282a36", "#3a3d4d", "#bd93f9"]],
  ["gruvbox", "Gruvbox", ["#1d2021", "#3c3836", "#fabd2f"]],
];

const ACCENTS = ["#7c5cff", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6"];

export default function ProfilePage() {
  const { user } = useAuth();
  const [theme, setThemeState] = useState(localStorage.getItem("rr_theme") || "dark");
  const [accent, setAccentState] = useState(localStorage.getItem("rr_accent") || "#7c5cff");
  const [crt, setCrtState] = useState(localStorage.getItem("rr_crt") === "1");
  const [modalScale, setModalScaleState] = useState(
    parseFloat(localStorage.getItem("rr_modal_scale") || "1"));
  const [cardW, setCardWState] = useState(
    parseInt(localStorage.getItem("rr_card_w") || "160", 10));
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

  const setCrt = (on) => {
    setCrtState(on);
    localStorage.setItem("rr_crt", on ? "1" : "0");
    document.documentElement.dataset.crt = on ? "1" : "0";
  };

  const setModalScale = (v) => {
    setModalScaleState(v);
    localStorage.setItem("rr_modal_scale", String(v));
    document.documentElement.style.setProperty("--modal-scale", String(v));
  };

  const setCardW = (v) => {
    setCardWState(v);
    localStorage.setItem("rr_card_w", String(v));
    document.documentElement.style.setProperty("--card-w", `${v}px`);
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
    <div style={{ maxWidth: 620 }}>
      <div className="page-title">Profile</div>
      <div className="page-sub">
        Signed in as <strong>{user.username}</strong> · {user.role}
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h3 style={{ marginBottom: 12 }}>Appearance</h3>

        <label>Theme</label>
        <div className="theme-grid">
          {THEMES.map(([value, label, colors]) => (
            <button key={value} type="button"
              className={"theme-tile" + (theme === value ? " active" : "")}
              onClick={() => setTheme(value)}>
              <span className="theme-preview">
                {colors.map((c, i) => <i key={i} style={{ background: c }} />)}
              </span>
              <span className="theme-name">{label}</span>
            </button>
          ))}
        </div>

        <label>Accent color</label>
        <div className="row wrap" style={{ marginTop: 8, marginBottom: 16 }}>
          {ACCENTS.map((c) => (
            <button key={c} type="button" aria-label={c}
              className={"swatch" + (accent === c ? " active" : "")}
              style={{ background: c }}
              onClick={() => setAccent(c)} />
          ))}
        </div>

        <label>Game pop-up size — {Math.round(modalScale * 100)}%</label>
        <input type="range" className="rr-range" min="0.8" max="1.6" step="0.05"
          value={modalScale} onChange={(e) => setModalScale(parseFloat(e.target.value))} />
        <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
          Scales the game detail pop-up so you can see cover art larger. Live preview:
        </div>
        <div className="scale-preview">
          <div className="mini-modal" style={{ "--preview-scale": modalScale }}>
            <div className="mini-cover" />
            <div className="mini-lines" style={{ flex: 1 }}>
              <i className="t" />
              <i style={{ width: "55%" }} />
              <i style={{ width: "90%" }} />
              <i style={{ width: "70%" }} />
              <i className="a" />
            </div>
          </div>
        </div>

        <label style={{ marginTop: 18 }}>Library card size — {cardW}px</label>
        <input type="range" className="rr-range" min="120" max="240" step="10"
          value={cardW} onChange={(e) => setCardW(parseInt(e.target.value, 10))} />
        <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
          Sets how large game covers appear in the library grid.
        </div>

        <label style={{ marginTop: 18 }}>Retro vibes</label>
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
