import React from "react";
import { Link } from "react-router-dom";


const STATUS_LABEL = {
  pending:  "Venter",
  running:  "Pågår",
  finished: "Avsluttet",
};

const STATUS_BADGE = {
  pending:  "badge-ghost",
  running:  "badge-success",
  finished: "badge-neutral",
};


function TournamentCard({ t, isAdmin, onRename, onFinish, isRegistered, isBlockedByOther, onRegister, registering }) {
  return (
    <div className="tournament-card">
      <div className="flex justify-between items-center">
        <span
          className={`badge badge-sm ${STATUS_BADGE[t.status] ?? 'badge-ghost'}`}
        >
          {STATUS_LABEL[t.status] ?? t.status}
        </span>
        {isAdmin && (
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
        {t.buyIn > 0 && <span>Buy-in: {t.buyIn} kr</span>}
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

      {t.status !== "finished" && onRegister && (
        isRegistered ? (
          <div className="text-sm text-success font-semibold mt-1">✅ Du er påmeldt</div>
        ) : isBlockedByOther ? null : (
          <button
            className="btn btn-success btn-sm"
            onClick={onRegister}
            disabled={registering}
          >
            {registering ? "Melder på…" : "+ Meld meg på"}
          </button>
        )
      )}
    </div>
  );
}

export default TournamentCard;