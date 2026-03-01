import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useTournamentApi } from "../lib/useTournamentApi";
import { usePlayerApi } from "../lib/usePlayerApi";
import ThemeSwitcher from "../components/ThemeSwitcher";

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

export default function TournamentList() {
  const nav   = useNavigate();
  const token = localStorage.getItem("poker_token");
  const role  = localStorage.getItem("poker_role") || "viewer";
  const isAdmin = role === "admin";

  const { tournaments, loading, error, createTournament, renameTournament, finishTournament } =
    useTournamentApi(token);

  const { profile, register } = usePlayerApi(token);
  const [registering, setRegistering] = useState(null); // tournament id being registered
  const [registerError, setRegisterError] = useState("");

  async function handleRegister(tournamentId) {
    setRegistering(tournamentId);
    setRegisterError("");
    try {
      await register(tournamentId);
    } catch (err) {
      setRegisterError(err.message);
    } finally {
      setRegistering(null);
    }
  }

  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [renaming, setRenaming] = useState(null); // { id, name }
  const [renamingError, setRenamingError] = useState("");

  if (!token) return <Navigate to="/login" replace />;

  const active   = tournaments.filter(t => t.status !== "finished");
  const finished = tournaments.filter(t => t.status === "finished");

  async function handleCreate(e) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) { setCreateError("Skriv inn et turneringsnavn"); return; }
    setCreating(true);
    setCreateError("");
    try {
      await createTournament(name);
      setNewName("");
      setShowForm(false);
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleRename(e) {
    e.preventDefault();
    const name = renaming.name.trim();
    if (!name) { setRenamingError("Skriv inn et navn"); return; }
    setRenamingError("");
    try {
      await renameTournament(renaming.id, name);
      setRenaming(null);
    } catch (err) {
      setRenamingError(err.message);
    }
  }

  async function handleFinish(id) {
    if (!confirm("Avslutt denne turneringen?")) return;
    try {
      await finishTournament(id);
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <main className="main-content">
      <div className="home-header">
        <h1 className="home-title">🃏 Turneringer</h1>
        <div className="home-header-right">
          {isAdmin && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowForm(f => !f)}>
              {showForm ? "✕ Avbryt" : "+ Ny turnering"}
            </button>
          )}
          <ThemeSwitcher />
          <button className="btn btn-ghost btn-sm" onClick={() => {
            localStorage.removeItem("poker_token");
            localStorage.removeItem("poker_role");
            nav("/login", { replace: true });
          }}>Logg ut</button>
        </div>
      </div>

      {/* Create form */}
      {showForm && isAdmin && (
        <form className="tournament-create-form" onSubmit={handleCreate}>
          <input
            className="input"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Turneringsnavn…"
            maxLength={80}
          />
          <button className="btn btn-primary btn-sm" disabled={creating} type="submit">
            {creating ? "Oppretter…" : "Opprett"}
          </button>
          {createError && <p className="error-text">{createError}</p>}
        </form>
      )}

      {/* Rename modal */}
      {renaming && (
        <div className="modal-backdrop">
          <form className="modal-box" onSubmit={handleRename}>
            <h3>Endre turneringsnavn</h3>
            <input
              className="input w-full"
              value={renaming.name}
              onChange={e => setRenaming(r => ({ ...r, name: e.target.value }))}
              maxLength={80}
              autoFocus
            />
            <div className="modal-actions">
              <button className="btn btn-primary btn-sm" type="submit">Lagre</button>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => setRenaming(null)}>Avbryt</button>
            </div>
            {renamingError && <p className="error-text">{renamingError}</p>}
          </form>
        </div>
      )}

      {registerError && <p className="error-text" style={{marginBottom: "0.5rem"}}>Påmelding feilet: {registerError}</p>}
      {loading && <p className="muted-text">Laster turneringer…</p>}
      {error   && <p className="error-text">Feil: {error}</p>}

      {/* Active tournaments */}
      {active.length > 0 && (
        <section className="tournament-section">
          <h2 className="section-heading">Aktive turneringer</h2>
          <div className="tournament-grid">
            {active.map(t => (
              <TournamentCard
                key={t.id}
                t={t}
                isAdmin={isAdmin}
                onRename={() => setRenaming({ id: t.id, name: t.name })}
                onFinish={() => handleFinish(t.id)}
                isRegistered={profile?.activeTournamentId === t.id}
                isBlockedByOther={profile?.activeTournamentId != null && profile.activeTournamentId !== t.id}
                onRegister={() => handleRegister(t.id)}
                registering={registering === t.id}
              />
            ))}
          </div>
        </section>
      )}

      {active.length === 0 && !loading && (
        <p className="muted-text">
          Ingen aktive turneringer.{isAdmin ? " Opprett en ny ovenfor." : ""}
        </p>
      )}

      {/* Finished tournaments */}
      {finished.length > 0 && (
        <section className="tournament-section">
          <h2 className="section-heading">Avsluttede turneringer</h2>
          <div className="tournament-grid">
            {finished.map(t => (
              <TournamentCard key={t.id} t={t} isAdmin={false} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function TournamentCard({ t, isAdmin, onRename, onFinish, isRegistered, isBlockedByOther, onRegister, registering }) {
  return (
    <div className="tournament-card">
      <div className="tournament-card-header">
        <span
          className={`badge badge-sm ${STATUS_BADGE[t.status] ?? 'badge-ghost'}`}
        >
          {STATUS_LABEL[t.status] ?? t.status}
        </span>
        {isAdmin && (
          <div className="tournament-card-admin-btns">
            <button className="btn btn-ghost btn-xs" onClick={onRename}>✏️</button>
            {t.status !== "finished" && (
              <button className="btn btn-ghost btn-xs" onClick={onFinish}>🏁</button>
            )}
          </div>
        )}
      </div>

      <h3 className="tournament-card-name">{t.name}</h3>

      <div className="tournament-card-meta">
        <span>{t.playerCount} spiller{t.playerCount !== 1 ? "e" : ""}</span>
        {t.buyIn > 0 && <span>Buy-in: {t.buyIn} kr</span>}
      </div>

      {t.status !== "finished" && (
        <div className="tournament-card-actions">
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
          <div className="tournament-registered-badge">✅ Du er påmeldt</div>
        ) : (
          <button
            className="btn btn-success btn-sm"
            onClick={onRegister}
            disabled={registering || isBlockedByOther}
            title={isBlockedByOther ? "Du er allerede påmeldt en annen turnering" : ""}
          >
            {registering ? "Melder på…" : isBlockedByOther ? "Opptatt i annen turnering" : "+ Meld meg på"}
          </button>
        )
      )}
    </div>
  );
}
