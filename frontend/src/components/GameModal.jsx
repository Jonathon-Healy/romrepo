import { useEffect, useState } from "react";
import { api, downloadGame, formatBytes } from "../api";
import { useAuth } from "../AuthContext";
import GamePlayer, { isPlayable } from "./GamePlayer";

export default function GameModal({ gameId, onClose }) {
  const { can } = useAuth();
  const [game, setGame] = useState(null);
  const [error, setError] = useState(null);
  const [fixing, setFixing] = useState(false);
  const [playing, setPlaying] = useState(false);

  const loadGame = () =>
    api(`/api/games/${gameId}`).then(setGame).catch((e) => setError(e.message));

  useEffect(() => { loadGame(); }, [gameId]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && (fixing ? setFixing(false) : onClose());
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, fixing]);

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
                  <img className="modal-cover" src={game.cover} alt="" />
                )}
                <div style={{ minWidth: 0 }}>
                  <div className="row" style={{ gap: 10 }}>
                    <h2 style={{ fontSize: 22, marginBottom: 6 }}>{game.name}</h2>
                    <button className={"fav-btn on"}
                      style={{ position: "static", opacity: 1, transform: "none",
                        color: game.favorite ? "#ff5c8a" : "var(--text-dim)" }}
                      onClick={async () => {
                        const next = !game.favorite;
                        setGame({ ...game, favorite: next });
                        api(`/api/games/${game.id}/favorite`,
                          { method: next ? "PUT" : "DELETE" }).catch(() => {});
                      }}>
                      {game.favorite ? "♥" : "♡"}
                    </button>
                  </div>
                  <div className="row wrap" style={{ gap: 8, marginBottom: 12 }}>
                    <span className="chip">{game.platform_name}</span>
                    {game.release_year && <span className="chip chip-dim">{game.release_year}</span>}
                    {game.rating && <span className="chip chip-dim">★ {game.rating}</span>}
                    <span className="chip chip-dim">{formatBytes(game.size)}</span>
                    {game.download_count > 0 && (
                      <span className="chip chip-dim">⬇ {game.download_count}</span>
                    )}
                    {game.match_failed && !game.matched && (
                      <span className="chip" style={{ background: "#d84b5c22", color: "#e46875" }}>
                        unmatched
                      </span>
                    )}
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

              {fixing && can("scan.run") && (
                <MatchFixer game={game}
                  onApplied={() => { setFixing(false); loadGame(); }}
                  onCancel={() => setFixing(false)} />
              )}

              <div className="row spread" style={{ marginTop: 20, gap: 12 }}>
                <span className="muted" style={{
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {game.path}
                </span>
                <div className="row">
                  {can("scan.run") && !fixing && (
                    <button className="btn btn-ghost" onClick={() => setFixing(true)}
                      title="Search IGDB and pick the correct match / artwork">
                      🎯 Fix match
                    </button>
                  )}
                  {can("library.download") && isPlayable(game.platform) && (
                    <button className="btn btn-primary" onClick={() => setPlaying(true)}
                      title="Play in your browser">
                      ▶ Play
                    </button>
                  )}
                  {can("library.download") && (
                    <button className="btn btn-ghost"
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
      {playing && game && (
        <GamePlayer game={game} onClose={() => setPlaying(false)} />
      )}
    </div>
  );
}

function MatchFixer({ game, onApplied, onCancel }) {
  const [q, setQ] = useState(game.name);
  const [candidates, setCandidates] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const search = async (e) => {
    e?.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await api(
        `/api/games/${game.id}/match-candidates?q=${encodeURIComponent(q)}`);
      setCandidates(res.candidates);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { search(); }, []); // eslint-disable-line

  const apply = async (igdbId) => {
    setBusy(true);
    setErr(null);
    try {
      await api(`/api/games/${game.id}/apply-match`,
        { method: "POST", body: { igdb_id: igdbId } });
      onApplied();
    } catch (e2) {
      setErr(e2.message);
      setBusy(false);
    }
  };

  return (
    <div className="card" style={{ marginTop: 18 }}>
      <div className="row spread" style={{ marginBottom: 10 }}>
        <strong>Fix match — pick the correct game</strong>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
      <form className="row" style={{ gap: 8, marginBottom: 12 }} onSubmit={search}>
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search IGDB…" />
        <button className="btn btn-primary btn-sm" disabled={busy}>
          {busy ? "…" : "Search"}
        </button>
      </form>
      {err && <div className="error-text">{err}</div>}
      {candidates && candidates.length === 0 && !busy && (
        <div className="muted">No results. Try a different search.</div>
      )}
      <div className="match-list">
        {candidates?.map((c) => (
          <button key={c.igdb_id} className="match-row" disabled={busy}
            onClick={() => apply(c.igdb_id)}>
            {c.cover
              ? <img src={c.cover} alt="" className="match-thumb" />
              : <span className="match-thumb match-thumb-empty" />}
            <span style={{ minWidth: 0 }}>
              <span className="match-name">
                {c.name} {c.year && <span className="muted">({c.year})</span>}
              </span>
              {c.summary && <span className="match-summary">{c.summary}</span>}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
