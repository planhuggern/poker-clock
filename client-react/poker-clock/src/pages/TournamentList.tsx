import { useState } from "react";
import { Link } from "react-router-dom";
import { useTournamentApi } from "../lib/useTournamentApi";
import TournamentCard from "./TournamentCard";
import ThemeSwitcher from "../components/ThemeSwitcher";
import UserMenu from "../components/UserMenu";

export default function TournamentList() {
  const { tournaments, loading, error, createTournament, renameTournament, finishTournament } =
    useTournamentApi();

  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [renaming, setRenaming] = useState<{ id: number; name: string } | null>(null);
  const [renamingError, setRenamingError] = useState("");

  const active   = tournaments.filter(t => t.status !== "finished");
  const finished = tournaments.filter(t => t.status === "finished");

  async function handleCreate(e: React.FormEvent) {
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
      setCreateError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (!renaming) return;
    const name = renaming.name.trim();
    if (!name) { setRenamingError("Skriv inn et navn"); return; }
    setRenamingError("");
    try {
      await renameTournament(renaming.id, name);
      setRenaming(null);
    } catch (err) {
      setRenamingError((err as Error).message);
    }
  }

  async function handleFinish(id: number) {
    if (!confirm("Avslutt denne turneringen?")) return;
    try {
      await finishTournament(id);
    } catch (err) {
      alert((err as Error).message);
    }
  }

  return (
    <main className="main-content">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <h1 className="m-0">🃏 Turneringer</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowForm(f => !f)}
          >
            {showForm ? "✕ Avbryt" : "+ Ny turnering"}
          </button>
          <UserMenu />
          <ThemeSwitcher />
        </div>
      </div>

      {showForm && (
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

      {renaming && (
        <div className="fixed inset-0 bg-black/55 flex items-center justify-center z-[999]">
          <form className="bg-base-200 border border-base-content/15 rounded-xl p-6 min-w-[320px] flex flex-col gap-3" onSubmit={handleRename}>
            <h3>Endre turneringsnavn</h3>
            <input
              className="input w-full"
              value={renaming.name}
              onChange={e => setRenaming(r => r ? { ...r, name: e.target.value } : null)}
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

      {loading && <p className="opacity-45 italic">Laster turneringer…</p>}
      {error   && <p className="text-error text-sm m-0">Feil: {error}</p>}

      {active.length > 0 && (
        <section className="my-6">
          <h2 className="text-xs uppercase tracking-widest opacity-45 mb-3">Aktive turneringer</h2>
          <div className="tournament-grid">
            {active.map(t => (
              <TournamentCard
                key={t.id}
                t={t}
                onRename={() => setRenaming({ id: t.id, name: t.name })}
                onFinish={() => handleFinish(t.id)}
              />
            ))}
          </div>
        </section>
      )}

      {active.length === 0 && !loading && (
        <p className="opacity-45 italic">Ingen aktive turneringer.</p>
      )}

      {finished.length > 0 && (
        <section className="my-6">
          <h2 className="text-xs uppercase tracking-widest opacity-45 mb-3">Avsluttede turneringer</h2>
          <div className="tournament-grid">
            {finished.map(t => (
              <TournamentCard key={t.id} t={t} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
