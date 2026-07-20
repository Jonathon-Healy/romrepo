import { useEffect, useState } from "react";
import { api, downloadGame, formatBytes } from "../api";
import { useAuth } from "../AuthContext";

export default function GameModal({ gameId, onClose }) {
  const { can } = useAuth();
  const [game, setGame] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api(`/api/games/${gameId}`).then(setGame).catch((e) => setError(e.message));
  }, [gameId]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-body">
          {error && <div className="error-text">{error}</div>}
          {!game && !error && <div className="muted">Loading…</div>}
          {game && (
            <>
              <div className="row" style={{ alignItems: "flex-start", gap: 20 }}>
                {game.cover && (
                  <img src={game.cover} alt="" style={{
                    width: 180, borderRadius: 12, flexShrink: 0,
                  }} />
                )}
                <div style={{ minWidth: 0 }}>
                  <h2 style={{ fontSize: 22, marginBottom: 6 }}>{game.name}</h2>
                  <div className="row wrap" style={{ gap: 8, marginBottom: 12 }}>
                    <span className="chip">{game.platform_name}</span>
                    {game.release_year && <span className="chip chip-dim">{game.release_year}</span>}
                    {game.rating && <span className="chip chip-dim">★ {game.rating}</span>}
                    <span className="chip chip-dim">{formatBytes(game.size)}</span>
                  </div>
                  {game.genres && (
                    <p className="muted" style={{ marginBottom: 10 }}>{game.genres}</p>
                  )}
                  {game.summary && (
                    <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-dim)" }}>
                      {game.summary}
                    </p>
                  )}
                </div>
              </div>

              {game.screenshots?.length > 0 && (
                <div className="shots">
                  {game.screenshots.map((s) => <img key={s} src={s} alt="" loading="lazy" />)}
                </div>
              )}

              <div className="row spread" style={{ marginTop: 20 }}>
                <span className="muted" style={{
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {game.path}
                </span>
                <div className="row">
                  {can("library.download") && (
                    <button className="btn btn-primary"
                      onClick={() => downloadGame(game.id).catch((e) => alert(e.message))}>
                      ⬇ Download
                    </button>
                  )}
                  <button className="btn btn-ghost" onClick={onClose}>Close</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
