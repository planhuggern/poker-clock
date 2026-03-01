import { useState } from "react";
import { Navigate, useNavigate, Link, useParams } from "react-router-dom";
import { usePokerSocket } from "../lib/usePokerSocket";
import { usePlayerApi } from "../lib/usePlayerApi";
import ClockCard, { fmtChips } from "../components/ClockCard";
import AdminTournamentTable from "../components/AdminTournamentTable";
import UserMenu from "../components/UserMenu";


export default function Home() {
  const nav = useNavigate();
  const { tournamentId: tidParam } = useParams();
  const tournamentId = Number(tidParam) || 1;

  const token = localStorage.getItem("poker_token");
  const role = localStorage.getItem("poker_role") || "viewer";

  // Sjekk om innlogget bruker er admin for denne turneringen
  const isAdmin = (() => {
    if (!profile || !snapshot?.tournament) return false;
    return profile.username === snapshot.tournament.admin?.username;
  })();

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

  if (!token) return <Navigate to="/login" replace />;

  const t = snapshot?.tournament;
  const levels = t?.levels ?? [];
  const players = snapshot?.players;
  const currentIndex = snapshot?.currentIndex ?? 0;
  const running = snapshot?.running;

  return (
    <main className="main-content">

      {/* Header */}
      <div className="home-header">
        <h1 className="home-title">{t?.name ?? "Pokerklokke"}</h1>
        <div className="home-header-right">
          <span className={`clock-dot ${status === "connected" ? "running" : "paused"}`} />
          <Link to={`/tournament/${tournamentId}/tv`} className="btn-secondary">📺 TV</Link>
          <Link to="/" className="btn-secondary">⬅ Turneringer</Link>
          <UserMenu token={token} />
          <button className="btn-ghost" onClick={() => {
            localStorage.removeItem("poker_token");
            localStorage.removeItem("poker_role");
            nav("/login", { replace: true });
          }}>Logg ut</button>
        </div>
      </div>

      {/* Clock */}
      <ClockCard snapshot={snapshot} />

      {/* Registration */}
      <div className="register-banner">
        {isRegistered ? (
          <span className="register-banner-ok">✅ Du er påmeldt denne turneringen</span>
        ) : (
          <>
            <button
              className="btn-register"
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
            {registerError && <span className="error-text" style={{marginLeft: 8, fontSize: "0.85rem"}}>{registerError}</span>}
          </>
        )}
      </div>

      {/* Clock controls */}
      {isAdmin ? (
        <div className="admin-controls">
          <div className="ctrl-row">
            <button className={`btn-primary${running ? " active" : ""}`} onClick={running ? pause : start}>
              {running ? "⏸ Pause" : "▶ Start"}
            </button>
            <button className="btn-secondary" onClick={reset}>⟳ Reset nivå</button>
            <button className="btn-secondary" onClick={prev} disabled={currentIndex === 0}>◀ Forrige</button>
            <button className="btn-secondary" onClick={next} disabled={currentIndex >= levels.length - 1}>Neste ▶</button>
          </div>
          <div className="ctrl-row">
            <span className="ctrl-label">Legg til tid:</span>
            <button className="btn-ghost" onClick={() => addTime(60)}>+1 min</button>
            <button className="btn-ghost" onClick={() => addTime(300)}>+5 min</button>
            <button className="btn-ghost" onClick={() => addTime(-60)}>−1 min</button>
          </div>
        </div>
      ) : (
        <div className="viewer-note">Kun admin kan styre klokken.</div>
      )}

      {/* Level navigation */}
      {isAdmin && levels.length > 0 && (
        <div className="level-nav">
          <div className="level-nav-title">Hopp til nivå:</div>
          <div className="level-nav-list">
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
        <div className="players-panel">
          <div className="players-panel-header">
            <h3>Spillere & premiepott</h3>
            <button className="btn-ghost" onClick={() => {
              setPlayerInput(String(players?.registered ?? 0));
              setEditingPlayers(v => !v);
            }}>
              {editingPlayers ? "Lukk" : "Sett antall"}
            </button>
          </div>

          {editingPlayers && (
            <form className="player-form" onSubmit={e => {
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
                className="player-input"
                placeholder="Antall spillere"
                autoFocus
              />
              <button type="submit" className="btn-primary">OK</button>
            </form>
          )}

          <div className="players-stats">
            <div className="pstat">
              <div className="pstat-val">{players?.active ?? 0}</div>
              <div className="pstat-lbl">igjen</div>
            </div>
            <div className="pstat">
              <div className="pstat-val">{players?.registered ?? 0}</div>
              <div className="pstat-lbl">startet</div>
            </div>
            <div className="pstat">
              <div className="pstat-val">{players?.rebuyCount ?? 0}</div>
              <div className="pstat-lbl">rebuys</div>
            </div>
            <div className="pstat">
              <div className="pstat-val">{players?.addOnCount ?? 0}</div>
              <div className="pstat-lbl">add-ons</div>
            </div>
            {(players?.prizePool ?? 0) > 0 && (
              <div className="pstat prize">
                <div className="pstat-val">{players.prizePool.toLocaleString("no-NO")}</div>
                <div className="pstat-lbl">kr premier</div>
              </div>
            )}
          </div>

          <div className="ctrl-row" style={{ marginTop: 8 }}>
            <button className="btn-danger" onClick={bustout} disabled={!players?.active}>
              💀 Bust ({players?.active ?? 0} igjen)
            </button>
            <button className="btn-secondary" onClick={rebuy}>+ Rebuy</button>
            <button className="btn-secondary" onClick={addOn}>+ Add-on</button>
          </div>

          {t && (
            <div className="prize-info">
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
