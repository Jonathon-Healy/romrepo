import { useEffect, useState } from "react";
import { api, formatBytes } from "../api";
import GameModal from "../components/GameModal";

export default function DuplicatesPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api("/api/duplicates").then(setData).catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <div className="page-title">Duplicates</div>
      <div className="page-sub">
        Titles that appear more than once across regions, formats, or platforms.
      </div>

      {error && <div className="card error-text">{error}</div>}
      {!data && !error && <div className="muted">Scanning your library…</div>}
      {data && data.total_groups === 0 && (
        <div className="card muted">No duplicate titles found. Clean library! 🎉</div>
      )}

      {data?.groups.map((grp) => (
        <div className="dupe-group" key={grp.title + grp.count}>
          <div className="dupe-head">
            <span className="dupe-title">{grp.title}</span>
            <span className="chip">{grp.count} copies</span>
            {grp.platforms.map((p) => <span key={p} className="chip chip-dim">{p}</span>)}
            <span className="muted" style={{ marginLeft: "auto" }}>
              {formatBytes(grp.total_size)} total
            </span>
          </div>
          <div className="dupe-copies">
            {grp.games.map((g) => (
              <div className="dupe-copy" key={g.id} onClick={() => setSelected(g.id)}>
                {g.cover
                  ? <img src={g.cover} alt="" loading="lazy" />
                  : <span className="dupe-ph" />}
                <span style={{ minWidth: 0 }}>
                  <div className="card-title" title={g.filename}>{g.filename}</div>
                  <div className="card-sub">
                    <span>{g.platform_name}</span>
                    <span>{formatBytes(g.size)}</span>
                  </div>
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {selected && <GameModal gameId={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
