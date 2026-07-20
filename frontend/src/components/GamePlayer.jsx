import { useEffect, useRef, useState } from "react";
import { api } from "../api";

// platform slug -> EmulatorJS core. GBA is the headline; the handhelds that
// share well-supported cores are cheap to enable too.
const CORES = {
  gba: "gba",
  gbc: "gbc",
  gb: "gb",
};

export function isPlayable(platform) {
  return platform in CORES;
}

export default function GamePlayer({ game, onClose }) {
  const [src, setSrc] = useState(null);
  const [error, setError] = useState(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const { url } = await api(`/api/games/${game.id}/play-token`, { method: "POST" });
        const accent = getComputedStyle(document.documentElement)
          .getPropertyValue("--accent").trim() || "#7c5cff";
        const params = new URLSearchParams({
          rom: url,
          core: CORES[game.platform] || "gba",
          name: `romrepo-${game.id}`, // stable save key
          accent,
        });
        setSrc(`/play.html?${params.toString()}`);
      } catch (e) {
        setError(e.message);
      }
    })();
  }, [game.id, game.platform]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="player-overlay" onClick={(e) => e.stopPropagation()}>
      <div className="player-bar">
        <span className="player-title">▶ {game.name}</span>
        <span className="player-hint muted">
          Saves persist in this browser · gamepad supported · remap in the ⚙ menu
        </span>
        <button className="btn btn-danger btn-sm" onClick={onClose}>✕ Exit</button>
      </div>
      {error ? (
        <div className="player-stage">
          <div className="error-text" style={{ padding: 40 }}>{error}</div>
        </div>
      ) : src ? (
        <iframe className="player-frame" src={src} title={`Play ${game.name}`}
          allow="gamepad; fullscreen; autoplay" />
      ) : (
        <div className="player-stage muted">Loading emulator…</div>
      )}
    </div>
  );
}
