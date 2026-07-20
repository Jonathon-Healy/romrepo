import { useRef, useState } from "react";
import { api, downloadGame, formatBytes, platformHue } from "../api";
import { useAuth } from "../AuthContext";

export default function GameCard({ game, onClick, index = 0, onFavChange }) {
  const { can } = useAuth();
  const ref = useRef(null);
  const [fav, setFav] = useState(game.favorite);
  const [pop, setPop] = useState(false);

  const download = (e) => {
    e.stopPropagation();
    downloadGame(game.id).catch((err) => alert(err.message));
  };

  const toggleFav = async (e) => {
    e.stopPropagation();
    const next = !fav;
    setFav(next);
    setPop(true);
    setTimeout(() => setPop(false), 400);
    try {
      await api(`/api/games/${game.id}/favorite`, { method: next ? "PUT" : "DELETE" });
      onFavChange?.(game.id, next);
    } catch (err) {
      setFav(!next);
      alert(err.message);
    }
  };

  // 3D tilt + shine position
  const onMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.transform =
      `perspective(700px) rotateY(${(x - 0.5) * 10}deg) rotateX(${(0.5 - y) * 10}deg) translateY(-4px)`;
    el.style.setProperty("--mx", `${x * 100}%`);
    el.style.setProperty("--my", `${y * 100}%`);
  };
  const onLeave = () => {
    if (ref.current) ref.current.style.transform = "";
  };

  return (
    <div className="game-card" ref={ref} onClick={onClick}
      onMouseMove={onMove} onMouseLeave={onLeave}
      style={{
        animationDelay: `${Math.min(index * 25, 400)}ms`,
        "--phue": platformHue(game.platform),
      }}>
      <div className="cover">
        {game.cover ? (
          <img src={game.cover} alt={game.name} loading="lazy" />
        ) : (
          <div className="cover-placeholder">{game.name}</div>
        )}
        <button className={"fav-btn" + (fav ? " on" : "") + (pop ? " pop" : "")}
          onClick={toggleFav} title={fav ? "Unfavorite" : "Favorite"}>
          {fav ? "♥" : "♡"}
        </button>
        {can("library.download") && (
          <button className="btn btn-primary btn-sm card-dl" onClick={download}
            title="Download">
            ⬇
          </button>
        )}
      </div>
      <div className="card-body">
        <div className="card-title" title={game.name}>{game.name}</div>
        <div className="card-sub">
          <span>{game.platform_name}</span>
          <span>{formatBytes(game.size)}</span>
        </div>
      </div>
    </div>
  );
}
