import { Navigate, useParams } from "react-router-dom";
import { usePokerSocket } from "../lib/usePokerSocket";
import ClockCard, { fmtTime, fmtChips } from "../components/ClockCard";

export default function Tv() {
  const token = localStorage.getItem("poker_token");
  const { tournamentId: tidParam } = useParams();
  const tournamentId = Number(tidParam) || 1;
  const { status, snapshot } = usePokerSocket(token, tournamentId);

  if (!token) return <Navigate to="/login" replace />;

  const t = snapshot?.tournament;
  const levels = t?.levels ?? [];
  const currentIndex = snapshot?.currentIndex ?? 0;
  const players = snapshot?.players;

  return (
    <div className="tv-layout">

      {/* Left: level list */}
      <aside className="tv-levels">
        <div className="tv-levels-title">{t?.name ?? "Pokerturnering"}</div>
        <div className="tv-levels-list">
          {levels.map((lvl, i) => {
            const isPast = i < currentIndex;
            const isCurrent = i === currentIndex;
            return (
              <div
                key={i}
                className={`tv-level-row${isCurrent ? " current" : ""}${isPast ? " past" : ""}${lvl.type === "break" ? " break-row" : ""}`}
              >
                {lvl.type === "break" ? (
                  <span>☕ {lvl.title ?? "Pause"} – {Math.round((lvl.seconds ?? 0) / 60)}m</span>
                ) : (
                  <>
                    <span className="tv-lvl-num">L{i + 1 - levels.slice(0, i + 1).filter(l => l.type === "break").length}</span>
                    <span className="tv-lvl-blinds">{fmtChips(lvl.sb)}/{fmtChips(lvl.bb)}</span>
                    {lvl.ante ? <span className="tv-lvl-ante">A:{fmtChips(lvl.ante)}</span> : null}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* Center: clock */}
      <main className="tv-clock">
        <ClockCard snapshot={snapshot} big />
        <div className="tv-conn-status">
          <span className={`clock-dot ${status === "connected" ? "running" : "paused"}`} />
          {status}
        </div>
      </main>

      {/* Right: players + prize */}
      <aside className="tv-players">
        {players && players.registered > 0 ? (
          <>
            <div className="tv-stat">
              <div className="tv-stat-value">{players.active}</div>
              <div className="tv-stat-label">spillere igjen</div>
            </div>
            <div className="tv-stat">
              <div className="tv-stat-value">{players.registered}</div>
              <div className="tv-stat-label">startet</div>
            </div>
            <div className="tv-stat-divider" />
            {players.rebuyCount > 0 && (
              <div className="tv-stat">
                <div className="tv-stat-value">{players.rebuyCount}</div>
                <div className="tv-stat-label">rebuys</div>
              </div>
            )}
            {players.addOnCount > 0 && (
              <div className="tv-stat">
                <div className="tv-stat-value">{players.addOnCount}</div>
                <div className="tv-stat-label">add-ons</div>
              </div>
            )}
            {players.prizePool > 0 && (
              <div className="tv-stat prize">
                <div className="tv-stat-value">{players.prizePool.toLocaleString("no-NO")}</div>
                <div className="tv-stat-label">kr premiere</div>
              </div>
            )}
          </>
        ) : (
          <div className="tv-stat-label" style={{ opacity: 0.4, textAlign: "center" }}>
            Ingen spillerinfo
          </div>
        )}
      </aside>

    </div>
  );
}
