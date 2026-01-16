import { useEffect, useMemo, useState } from "react";

export default function AdminTournamentEditor({ role, snapshot, updateTournament }) {
  const isAdmin = role === "admin";
  const tournament = snapshot?.tournament;

  const [text, setText] = useState("");
  const [err, setErr] = useState("");

  // Når snapshot endres (f.eks. noen andre admin endrer), oppdater editor
  useEffect(() => {
    if (!isAdmin || !tournament) return;
    setText(JSON.stringify(tournament, null, 2));
  }, [isAdmin, tournament]);

  const placeholder = useMemo(() => {
    return JSON.stringify({
      name: "Pokerturnering",
      levels: [
        { type: "level", title: "Level 1", durationSeconds: 900, sb: 25, bb: 50, ante: 0 },
        { type: "level", title: "Level 2", durationSeconds: 900, sb: 50, bb: 100, ante: 0 },
        { type: "break", title: "Pause", durationSeconds: 300 }
      ]
    }, null, 2);
  }, []);

  if (!isAdmin) return null;

  return (
    <div style={{ marginTop: 16 }}>
      <h3 style={{ marginBottom: 8 }}>Admin: Turneringsstruktur (JSON)</h3>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        rows={14}
        style={{
          width: "100%",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          fontSize: 12,
          padding: 12,
          borderRadius: 10,
          border: "1px solid #ddd"
        }}
      />

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
        <button
          onClick={() => {
            setErr("");
            try {
              const t = JSON.parse(text);

              // Minimal validering (samme som server forventer)
              if (!t || !Array.isArray(t.levels) || t.levels.length === 0) {
                throw new Error("Må ha levels[] med minst ett element");
              }

              updateTournament(t);
            } catch (e) {
              setErr(e?.message || "Ugyldig JSON");
            }
          }}
        >
          Bruk struktur
        </button>

        {err ? <span style={{ color: "crimson" }}>{err}</span> : null}
      </div>

      <div style={{ marginTop: 8, opacity: 0.7, fontSize: 12 }}>
        Tips: durationSeconds er i sekunder (900 = 15 min). type = "level" eller "break".
      </div>
    </div>
  );
}
