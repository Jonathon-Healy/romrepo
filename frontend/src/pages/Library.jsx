import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import GameCard from "../components/GameCard";
import GameModal from "../components/GameModal";

const SORTS = [
  ["name", "Name A–Z"],
  ["name_desc", "Name Z–A"],
  ["added", "Recently added"],
  ["year", "Release year"],
  ["rating", "Rating"],
  ["size", "File size"],
];

export default function Library() {
  const [params, setParams] = useSearchParams();
  const platform = params.get("platform") || "";
  const search = params.get("search") || "";
  const sort = params.get("sort") || "name";
  const favorites = params.get("favorites") === "1";

  const [games, setGames] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const reqId = useRef(0);

  const load = async (pageNum, append) => {
    const id = ++reqId.current;
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: pageNum, page_size: 60, sort });
      if (platform) qs.set("platform", platform);
      if (search) qs.set("search", search);
      if (favorites) qs.set("favorites", "1");
      const res = await api(`/api/games?${qs}`);
      if (id !== reqId.current) return;
      setTotal(res.total);
      setGames((prev) => (append ? [...prev, ...res.games] : res.games));
      setPage(pageNum);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  };

  useEffect(() => {
    load(1, false);
  }, [platform, search, sort, favorites]);

  const setSort = (value) => {
    const next = new URLSearchParams(params);
    next.set("sort", value);
    setParams(next, { replace: true });
  };

  return (
    <div>
      <div className="row spread wrap" style={{ marginBottom: 18 }}>
        <div>
          <div className="page-title">
            {favorites ? "♥ Favorites"
              : search ? `Search: “${search}”`
              : platform ? games[0]?.platform_name || "Library" : "All Games"}
          </div>
          <div className="page-sub" style={{ marginBottom: 0 }}>{total} games</div>
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value)} style={{ width: 180 }}>
          {SORTS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
      </div>

      {loading && games.length === 0 ? (
        <div className="game-grid">
          {Array.from({ length: 12 }).map((_, i) => <div key={i} className="skeleton" />)}
        </div>
      ) : games.length === 0 ? (
        <div className="card muted">
          No games found. If your library is empty, run a scan from Settings or the Dashboard.
        </div>
      ) : (
        <>
          <div className="game-grid">
            {games.map((g, i) => (
              <GameCard key={g.id} game={g} index={i % 60}
                onClick={() => setSelected(g.id)}
                onFavChange={(id, val) => {
                  if (favorites && !val) {
                    setGames((prev) => prev.filter((x) => x.id !== id));
                    setTotal((t) => t - 1);
                  }
                }} />
            ))}
          </div>
          {games.length < total && (
            <div style={{ textAlign: "center", marginTop: 24 }}>
              <button className="btn" disabled={loading} onClick={() => load(page + 1, true)}>
                {loading ? "Loading…" : `Load more (${games.length} / ${total})`}
              </button>
            </div>
          )}
        </>
      )}

      {selected && <GameModal gameId={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
