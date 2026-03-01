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
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <h1 className="m-0">🃏 Turneringer</h1>
        <div className="flex items-center gap-3 flex-wrap">
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
        <form className="flex items-center gap-2 mb-6 flex-wrap" onSubmit={handleCreate}>
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
          {createError && <p className="text-error text-sm m-0">{createError}</p>}
        </form>
      )}

      {/* Rename modal */}
      {renaming && (
        <div className="fixed inset-0 bg-black/55 flex items-center justify-center z-[999]">
          <form className="bg-base-200 border border-base-content/15 rounded-xl p-6 min-w-[320px] flex flex-col gap-3" onSubmit={handleRename}>
            <h3>Endre turneringsnavn</h3>
            <input
              className="input w-full"
              value={renaming.name}
              onChange={e => setRenaming(r => ({ ...r, name: e.target.value }))}
              maxLength={80}
              autoFocus
            />
            <div className="flex gap-2">
              <button className="btn btn-primary btn-sm" type="submit">Lagre</button>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => setRenaming(null)}>Avbryt</button>
            </div>
            {renamingError && <p className="text-error text-sm m-0">{renamingError}</p>}
          </form>
        </div>
      )}

      {registerError && <p className="text-error text-sm m-0" style={{marginBottom: "0.5rem"}}>Påmelding feilet: {registerError}</p>}
      {loading && <p className="opacity-45 italic">Laster turneringer…</p>}
      {error   && <p className="text-error text-sm m-0">Feil: {error}</p>}

      {/* Active tournaments */}
      {active.length > 0 && (
        <section className="my-6">
          <h2 className="text-xs uppercase tracking-widest opacity-45 mb-3">Aktive turneringer</h2>
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
        <p className="opacity-45 italic">
          Ingen aktive turneringer.{isAdmin ? " Opprett en ny ovenfor." : ""}
        </p>
      )}

      {/* Finished tournaments */}
      {finished.length > 0 && (
        <section className="my-6">
          <h2 className="text-xs uppercase tracking-widest opacity-45 mb-3">Avsluttede turneringer</h2>
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
