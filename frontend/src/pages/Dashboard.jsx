import { useEffect, useState } from "react";
import { api, formatBytes } from "../api";
import { useAuth } from "../AuthContext";
import GameCard from "../components/GameCard";
import GameModal from "../components/GameModal";

export default function Dashboard() {
  const { can } = useAuth();
  const [stats, setStats] = useState(null);
  const [scan, setScan] = useState(null);
  const [selected, setSelected] = useState(null);

  const refresh = () => api("/api/stats").then(setStats).catch(() => {});

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const s = await api("/api/scan/status");
        setScan(s);
        if (!s.running && scan?.running) refresh();
      } catch { /* ignore */ }
    }, 2000);
    return () => clearInterval(poll);
  }, [scan?.running]);

  const startScan = async () => {
    try {
      await api("/api/scan", { method: "POST" });
      setScan((s) => ({ ...s, running: true, phase: "scanning" }));
    } catch (e) {
      alert(e.message);
    }
  };

  const pct = scan?.total ? Math.round((scan.done / scan.total) * 100) : 0;

  return (
    <div>
      <div className="row spread wrap" style={{ marginBottom: 20 }}>
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-sub" style={{ marginBottom: 0 }}>Your library at a glance</div>
        </div>
        {can("scan.run") && (
          <button className="btn btn-primary" onClick={startScan} disabled={scan?.running}>
            {scan?.running ? "Scanning…" : "Scan library"}
          </button>
        )}
      </div>

      {scan?.running && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="row spread" style={{ marginBottom: 10 }}>
            <strong style={{ textTransform: "capitalize" }}>{scan.phase}</strong>
            <span className="muted">
              {scan.phase === "matching"
                ? `${scan.done}/${scan.total} · ${scan.current}`
                : scan.current}
            </span>
          </div>
          <div className="progress-track">
            <div className="progress-fill"
              style={{ width: scan.phase === "matching" ? `${pct}%` : "100%" }} />
          </div>
        </div>
      )}
      {scan && !scan.running && scan.phase === "done" && (
        <div className="card ok-text" style={{ marginBottom: 20, marginTop: 0 }}>
          Last scan: {scan.added} added, {scan.removed} removed, {scan.matched} matched with artwork.
        </div>
      )}
      {scan?.phase === "error" && (
        <div className="card error-text" style={{ marginBottom: 20 }}>
          Scan failed: {scan.error}
        </div>
      )}

      {stats && (
        <div className="stat-row">
          <div className="stat-card">
            <div className="stat-value">{stats.total_games}</div>
            <div className="stat-label">Games</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.platforms}</div>
            <div className="stat-label">Platforms</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{formatBytes(stats.total_size)}</div>
            <div className="stat-label">Library size</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.matched}</div>
            <div className="stat-label">With artwork</div>
          </div>
        </div>
      )}

      {stats?.recent?.length > 0 && (
        <>
          <div className="page-title" style={{ fontSize: 17, marginBottom: 14 }}>
            Recently added
          </div>
          <div className="game-grid" style={{ "--card-w": "140px" }}>
            {stats.recent.map((g, i) => (
              <GameCard key={g.id} game={g} index={i} onClick={() => setSelected(g.id)} />
            ))}
          </div>
        </>
      )}

      {selected && <GameModal gameId={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
