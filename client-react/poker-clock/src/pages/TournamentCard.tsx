import { Link } from "react-router-dom";
import type { TournamentItem } from "../lib/types";

const STATUS_LABEL: Record<string, string> = {
  pending:  "Venter",
  running:  "Pågår",
  finished: "Avsluttet",
};

const STATUS_BADGE: Record<string, string> = {
  pending:  "badge-ghost",
  running:  "badge-success",
  finished: "badge-neutral",
};

interface TournamentCardProps {
  t: TournamentItem;
  onRename?: () => void;
  onFinish?: () => void;
}

function TournamentCard({ t, onRename, onFinish }: TournamentCardProps) {
  return (
    <div className="tournament-card">
      <div className="flex justify-between items-center">
        <span className={`badge badge-sm ${STATUS_BADGE[t.status] ?? "badge-ghost"}`}>
          {STATUS_LABEL[t.status] ?? t.status}
        </span>
        {(onRename || onFinish) && (
          <div className="flex gap-1">
            <button className="btn btn-ghost btn-xs" onClick={onRename}>✏️</button>
            {t.status !== "finished" && (
              <button className="btn btn-ghost btn-xs" onClick={onFinish}>🏁</button>
            )}
          </div>
        )}
      </div>

      <h3 className="text-lg font-bold m-0">{t.name}</h3>

      <div className="text-sm opacity-55 flex gap-4">
        <span>{t.playerCount} spiller{t.playerCount !== 1 ? "e" : ""}</span>
        {(t.buyIn ?? 0) > 0 && <span>Buy-in: {t.buyIn} kr</span>}
      </div>

      {t.status !== "finished" && (
        <div className="flex gap-2 mt-1">
          <Link to={`/tournament/${t.id}`} className="btn btn-primary btn-sm">
            🕹 Klokke
          </Link>
          <Link to={`/tournament/${t.id}/tv`} className="btn btn-secondary btn-sm">
            📺 TV
          </Link>
        </div>
      )}

    </div>
  );
}

export default TournamentCard;
