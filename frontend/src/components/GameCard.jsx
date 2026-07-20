import { downloadGame, formatBytes } from "../api";
import { useAuth } from "../AuthContext";

export default function GameCard({ game, onClick, index = 0 }) {
  const { can } = useAuth();

  const download = (e) => {
    e.stopPropagation();
    downloadGame(game.id).catch((err) => alert(err.message));
  };

  return (
    <div className="game-card" onClick={onClick}
      style={{ animationDelay: `${Math.min(index * 25, 400)}ms` }}>
      <div className="cover">
        {game.cover ? (
          <img src={game.cover} alt={game.name} loading="lazy" />
        ) : (
          <div className="cover-placeholder">{game.name}</div>
        )}
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
