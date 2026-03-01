import { useState } from "react";
import { Navigate, useNavigate, Link, useParams } from "react-router-dom";
import { usePokerSocket } from "../lib/usePokerSocket";
import { usePlayerApi } from "../lib/usePlayerApi";
import ClockCard, { fmtChips } from "../components/ClockCard";
import AdminTournamentTable from "../components/AdminTournamentTable";
import UserMenu from "../components/UserMenu";
import ThemeSwitcher from "../components/ThemeSwitcher";


export default function Home() {
  const nav = useNavigate();
  const { tournamentId: tidParam } = useParams();
  const tournamentId = Number(tidParam) || 1;

  const token = localStorage.getItem("poker_token");
  const role = localStorage.getItem("poker_role") || "viewer";

  const [editingPlayers, setEditingPlayers] = useState(false);
  const [playerInput, setPlayerInput] = useState("");
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState("");

  const { profile, register } = usePlayerApi(token);
  const isRegistered = profile?.activeTournamentId === tournamentId;

  const {
    status, error, snapshot,
    start, pause, reset, next, prev, jump,
    updateTournament, addTime, setPlayers, rebuy, addOn, bustout,
  } = usePokerSocket(token, tournamentId);

  const isAdmin = !!(profile && snapshot?.tournament &&
    profile.username === snapshot.tournament.admin?.username);

  if (!token) return <Navigate to="/login" replace />;

  const t = snapshot?.tournament;
  const levels = t?.levels ?? [];
  const players = snapshot?.players;
  const currentIndex = snapshot?.currentIndex ?? 0;
  const running = snapshot?.running;

  return (
    <main className="main-content">

      {/* Header */}
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <h1 className="m-0">{t?.name ?? "Pokerklokke"}</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`clock-dot ${status === "connected" ? "running" : "paused"}`} />
          <Link to={`/tournament/${tournamentId}/tv`} className="btn btn-secondary btn-sm">📺 TV</Link>
          <Link to="/" className="btn btn-ghost btn-sm">⬅ Turneringer</Link>
          <UserMenu token={token} />
          <ThemeSwitcher />
          <button className="btn btn-ghost btn-sm" onClick={() => {
            localStorage.removeItem("poker_token");
            localStorage.removeItem("poker_role");
            nav("/login", { replace: true });
          }}>Logg ut</button>
        </div>
      </div>

      {/* Clock */}
      <ClockCard snapshot={snapshot} />

      {/* Registration */}
      <div className="flex items-center gap-2 my-3">
        {isRegistered ? (
          <span className="text-sm text-success font-semibold">✅ Du er påmeldt denne turneringen</span>
        ) : (
          <>
            <button
              className="btn btn-success btn-sm"
              disabled={registering || profile?.activeTournamentId != null}
              title={profile?.activeTournamentId != null ? "Du er allerede påmeldt en annen turnering" : ""}
              onClick={async () => {
                setRegistering(true);
                setRegisterError("");
                try { await register(tournamentId); }
                catch (e) { setRegisterError(e.message); }
                finally { setRegistering(false); }
              }}
            >
              {registering ? "Melder på…" : profile?.activeTournamentId != null ? "Opptatt i annen turnering" : "＋ Meld meg på turneringen"}
            </button>
            {registerError && <span className="text-error text-sm ml-2">{registerError}</span>}
          </>
        )}
      </div>

      {/* Clock controls */}
      {isAdmin ? (
        <div className="bg-base-300/60 rounded-2xl border border-base-content/10 p-4 mb-4">
          <div className="flex gap-2 flex-wrap items-center mb-2">
              <button className={`btn btn-primary btn-sm${running ? " btn-active" : ""}`} onClick={running ? pause : start}>
              {running ? "⏸ Pause" : "▶ Start"}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={reset}>⟳ Reset nivå</button>
            <button className="btn btn-secondary btn-sm" onClick={prev} disabled={currentIndex === 0}>◀ Forrige</button>
            <button className="btn btn-secondary btn-sm" onClick={next} disabled={currentIndex >= levels.length - 1}>Neste ▶</button>
          </div>
          <div className="flex gap-2 flex-wrap items-center mb-2">
            <span className="text-xs opacity-50 min-w-[54px]">Legg til tid:</span>
            <button className="btn btn-ghost btn-sm" onClick={() => addTime(60)}>+1 min</button>
            <button className="btn btn-ghost btn-sm" onClick={() => addTime(300)}>+5 min</button>
            <button className="btn btn-ghost btn-sm" onClick={() => addTime(-60)}>−1 min</button>
          </div>
        </div>
      ) : (
        <div className="text-xs opacity-40 mt-1 text-center">Kun admin kan styre klokken.</div>
      )}

      {/* Level navigation */}
      {isAdmin && levels.length > 0 && (
        <div className="mb-4">
          <div className="text-xs opacity-50 mb-2">Hopp til nivå:</div>
          <div className="flex flex-wrap gap-1.5">
            {levels.map((lvl, i) => (
              <button
                key={i}
                className={`level-nav-btn${i === currentIndex ? " current" : ""}${lvl.type === "break" ? " break" : ""}`}
                onClick={() => jump(i)}
                title={lvl.title}
              >
                {lvl.type === "break" ? "☕" : `L${i + 1 - levels.slice(0, i + 1).filter(l => l.type === "break").length}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Players panel */}
      {isAdmin && (
        <div className="bg-base-300/60 rounded-2xl border border-base-content/10 p-4 mb-4">
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <h3>Spillere & premiepott</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => {
              setPlayerInput(String(players?.registered ?? 0));
              setEditingPlayers(v => !v);
            }}>
              {editingPlayers ? "Lukk" : "Sett antall"}
            </button>
          </div>

          {editingPlayers && (
            <form className="flex items-center gap-2 flex-wrap mb-4" onSubmit={e => {
              e.preventDefault();
              const n = parseInt(playerInput, 10);
              if (Number.isFinite(n) && n >= 0) {
                setPlayers({ registered: n, busted: 0, rebuyCount: 0, addOnCount: 0 });
                setEditingPlayers(false);
              }
            }}>
              <input
                type="number" min="0"
                value={playerInput}
                onChange={e => setPlayerInput(e.target.value)}
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

          {t && (
            <div className="text-xs opacity-45 mt-1 flex gap-3 flex-wrap">
              {t.buyIn ? <span>Buy-in: {fmtChips(t.buyIn)} kr</span> : null}
              {t.rebuyAmount ? <span>Rebuy: {fmtChips(t.rebuyAmount)} kr</span> : null}
              {t.addOnAmount ? <span>Add-on: {fmtChips(t.addOnAmount)} kr</span> : null}
              {t.startingStack ? <span>Stack: {fmtChips(t.startingStack)}</span> : null}
            </div>
          )}
        </div>
      )}

      {/* Tournament editor */}
      <AdminTournamentTable
        role={role}
        snapshot={snapshot}
        updateTournament={updateTournament}
      />

    </main>
  );
}
