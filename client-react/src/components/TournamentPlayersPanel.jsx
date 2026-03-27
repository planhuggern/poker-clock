import { useState } from "react";
import { fmtChips } from "./ClockCard";

export default function TournamentPlayersPanel({
  isAdmin,
  players,
  setPlayers,
  bustout,
  rebuy,
  addOn,
  tournament,
}) {
  const [editingPlayers, setEditingPlayers] = useState(false);
  const [playerInput, setPlayerInput] = useState("");

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="bg-base-300/60 rounded-2xl border border-base-content/10 p-4 mb-4">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h3>Spillere & premiepott</h3>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setPlayerInput(String(players?.registered ?? 0));
            setEditingPlayers((v) => !v);
          }}
        >
          {editingPlayers ? "Lukk" : "Sett antall"}
        </button>
      </div>

      {editingPlayers && (
        <form
          className="flex items-center gap-2 flex-wrap mb-4"
          onSubmit={(e) => {
            e.preventDefault();
            const n = parseInt(playerInput, 10);
            if (Number.isFinite(n) && n >= 0) {
              setPlayers({ registered: n, busted: 0, rebuyCount: 0, addOnCount: 0 });
              setEditingPlayers(false);
            }
          }}
        >
          <input
            type="number"
            min="0"
            value={playerInput}
            onChange={(e) => setPlayerInput(e.target.value)}
            className="input input-sm"
            placeholder="Antall spillere"
            autoFocus
          />
          <button type="submit" className="btn btn-primary btn-sm">OK</button>
        </form>
      )}

      <div className="players-stats">
        <div className="bg-base-content/5 rounded-xl p-2 flex flex-col gap-0.5">
          <div className="text-lg font-bold">{players?.active ?? 0}</div>
          <div className="text-xs opacity-50">igjen</div>
        </div>
        <div className="bg-base-content/5 rounded-xl p-2 flex flex-col gap-0.5">
          <div className="text-lg font-bold">{players?.registered ?? 0}</div>
          <div className="text-xs opacity-50">startet</div>
        </div>
        <div className="bg-base-content/5 rounded-xl p-2 flex flex-col gap-0.5">
          <div className="text-lg font-bold">{players?.rebuyCount ?? 0}</div>
          <div className="text-xs opacity-50">rebuys</div>
        </div>
        <div className="bg-base-content/5 rounded-xl p-2 flex flex-col gap-0.5">
          <div className="text-lg font-bold">{players?.addOnCount ?? 0}</div>
          <div className="text-xs opacity-50">add-ons</div>
        </div>
        {(players?.prizePool ?? 0) > 0 && (
          <div className="bg-yellow-400/10 border border-yellow-400/25 rounded-xl p-2 flex flex-col gap-0.5">
            <div className="text-lg font-bold">{players.prizePool.toLocaleString("no-NO")}</div>
            <div className="text-xs opacity-50">kr premier</div>
          </div>
        )}
      </div>

      <div className="flex gap-2 flex-wrap items-center mt-2">
        <button className="btn btn-error btn-sm" onClick={bustout} disabled={!players?.active}>
          💀 Bust ({players?.active ?? 0} igjen)
        </button>
        <button className="btn btn-secondary btn-sm" onClick={rebuy}>+ Rebuy</button>
        <button className="btn btn-secondary btn-sm" onClick={addOn}>+ Add-on</button>
      </div>

      {tournament && (
        <div className="text-xs opacity-45 mt-1 flex gap-3 flex-wrap">
          {tournament.buyIn ? <span>Buy-in: {fmtChips(tournament.buyIn)} kr</span> : null}
          {tournament.rebuyAmount ? <span>Rebuy: {fmtChips(tournament.rebuyAmount)} kr</span> : null}
          {tournament.addOnAmount ? <span>Add-on: {fmtChips(tournament.addOnAmount)} kr</span> : null}
          {tournament.startingStack ? <span>Stack: {fmtChips(tournament.startingStack)}</span> : null}
        </div>
      )}
    </div>
  );
}
