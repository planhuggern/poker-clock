import { useEffect, useMemo, useState } from "react";

function toRowsFromTournament(t) {
  const levels = Array.isArray(t?.levels) ? t.levels : [];
  return levels.map((L) => ({
    type: L.type === "break" ? "break" : "level",
    title: L.title ?? "",
    minutes: Math.max(1, Math.round((L.durationSeconds ?? 60) / 60)),
    sb: L.sb ?? 0,
    bb: L.bb ?? 0,
    ante: L.ante ?? 0,
  }));
}

function toTournamentFromRows(name, rows) {
  return {
    name: name || "Pokerturnering",
    levels: rows.map((r) => {
      const durationSeconds = Math.max(1, Number(r.minutes || 1)) * 60;
      if (r.type === "break") {
        return { type: "break", title: r.title || "Pause", durationSeconds };
      }
      return {
        type: "level",
        title: r.title || "",
        durationSeconds,
        sb: Number(r.sb || 0),
        bb: Number(r.bb || 0),
        ante: Number(r.ante || 0),
      };
    }),
  };
}

function validate(rows) {
  if (!rows.length) return "Må ha minst én rad.";
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const idx = i + 1;
    if (!r.type) return `Rad ${idx}: type mangler`;
    const m = Number(r.minutes);
    if (!Number.isFinite(m) || m <= 0)
      return `Rad ${idx}: minutter må være > 0`;

    if (r.type === "level") {
      const sb = Number(r.sb),
        bb = Number(r.bb),
        ante = Number(r.ante);
      if (!Number.isFinite(sb) || sb < 0) return `Rad ${idx}: SB må være >= 0`;
      if (!Number.isFinite(bb) || bb <= 0) return `Rad ${idx}: BB må være > 0`;
      if (!Number.isFinite(ante) || ante < 0)
        return `Rad ${idx}: Ante må være >= 0`;
      if (sb > bb) return `Rad ${idx}: SB bør ikke være større enn BB`;
    }
  }
  return "";
}

function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function readJsonFile(file) {
  const text = await file.text();
  return JSON.parse(text);
}

export default function AdminTournamentTable({
  role,
  snapshot,
  updateTournament,
}) {
  const isAdmin = role === "admin";
  const t = snapshot?.tournament;

  const [name, setName] = useState("");
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [dirty, setDirty] = useState(false);
  const [importMsg, setImportMsg] = useState("");

  // Når snapshot endrer seg fra server (f.eks. annen admin), sync inn – men ikke overskriv hvis admin redigerer
  useEffect(() => {
    if (!isAdmin || !t) return;
    if (dirty) return;
    setName(t.name ?? "Pokerturnering");
    setRows(toRowsFromTournament(t));
  }, [isAdmin, t, dirty]);

  const addLevel = () => {
    setDirty(true);
    setRows((prev) => [
      ...prev,
      {
        type: "level",
        title: `Level ${prev.filter((x) => x.type === "level").length + 1}`,
        minutes: 15,
        sb: 50,
        bb: 100,
        ante: 0,
      },
    ]);
  };

  const addBreak = () => {
    setDirty(true);
    setRows((prev) => [
      ...prev,
      { type: "break", title: "Pause", minutes: 5, sb: 0, bb: 0, ante: 0 },
    ]);
  };

  const delRow = (i) => {
    setDirty(true);
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  };

  const move = (i, dir) => {
    setDirty(true);
    setRows((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const copy = prev.slice();
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
      return copy;
    });
  };

  const setCell = (i, key, value) => {
    setDirty(true);
    setRows((prev) => {
      const copy = prev.slice();
      copy[i] = { ...copy[i], [key]: value };
      // hvis bytter type til break, null ut blinds (kun kosmetisk)
      if (key === "type" && value === "break") {
        copy[i].sb = 0;
        copy[i].bb = 0;
        copy[i].ante = 0;
        if (!copy[i].title) copy[i].title = "Pause";
      }
      return copy;
    });
  };

  const canApply = useMemo(
    () => isAdmin && rows.length > 0,
    [isAdmin, rows.length],
  );

  if (!isAdmin) return null;

  return (
    <div style={{ marginTop: 18 }}>
      <h3 style={{ marginBottom: 8 }}>Admin: Rediger oppsett</h3>

      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 10,
        }}
      >
        <label style={{ opacity: 0.8 }}>Turneringsnavn:</label>
        <input
          value={name}
          onChange={(e) => {
            setDirty(true);
            setName(e.target.value);
          }}
          style={{
            padding: 8,
            borderRadius: 10,
            border: "1px solid #ddd",
            minWidth: 260,
          }}
        />

        <button onClick={addLevel}>+ Legg til nivå</button>
        <button onClick={addBreak}>+ Legg til pause</button>

        <button
          onClick={() => {
            const tournament = toTournamentFromRows(name, rows);
            const safeName = (tournament.name || "tournament")
              .toLowerCase()
              .replace(/[^a-z0-9-_]+/g, "-");
            downloadJson(`${safeName}.json`, tournament);
          }}
          disabled={!rows.length}
          title="Last ned oppsett som JSON"
        >
          Eksport
        </button>

        <label
          style={{
            display: "inline-block",
            padding: "6px 10px",
            border: "1px solid #ddd",
            borderRadius: 10,
            cursor: "pointer",
            background: "white",
          }}
          title="Importer oppsett fra JSON-fil"
        >
          Import
          <input
            type="file"
            accept="application/json,.json"
            style={{ display: "none" }}
            onChange={async (e) => {
              setImportMsg("");
              const file = e.target.files?.[0];
              if (!file) return;

              try {
                const parsed = await readJsonFile(file);

                if (
                  !parsed ||
                  !Array.isArray(parsed.levels) ||
                  parsed.levels.length === 0
                ) {
                  throw new Error("JSON må ha levels[] med minst ett element");
                }

                const importedTournament = {
                  name: parsed.name ?? "Pokerturnering",
                  levels: parsed.levels,
                };

                // Oppdater UI (så tabellen viser hva som ble importert)
                setName(importedTournament.name);
                setRows(toRowsFromTournament(importedTournament));

                // Send direkte til server
                updateTournament(importedTournament);

                // Vi er “synket” med server nå
                setDirty(false);
                setErr("");
                setImportMsg("Importert og sendt til server ✅");
              } catch (err) {
                setImportMsg(`Import feilet: ${err?.message || "Ugyldig fil"}`);
              } finally {
                // gjør at du kan importere samme fil igjen
                e.target.value = "";
              }
            }}
          />
        </label>

        <button
          onClick={() => {
            setDirty(false);
            setErr("");
            setImportMsg("");
          }}
          style={{ opacity: 0.9 }}
        >
          Angre lokale endringer
        </button>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th style={{ padding: 8, borderBottom: "1px solid #eee" }}>#</th>
              <th style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                Type
              </th>
              <th style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                Tittel
              </th>
              <th style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                Min
              </th>
              <th style={{ padding: 8, borderBottom: "1px solid #eee" }}>SB</th>
              <th style={{ padding: 8, borderBottom: "1px solid #eee" }}>BB</th>
              <th style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                Ante
              </th>
              <th style={{ padding: 8, borderBottom: "1px solid #eee" }}></th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r, i) => {
              const isBreak = r.type === "break";
              return (
                <tr key={i}>
                  <td
                    style={{
                      padding: 8,
                      borderBottom: "1px solid #f4f4f4",
                      width: 34,
                    }}
                  >
                    {i + 1}
                  </td>

                  <td style={{ padding: 8, borderBottom: "1px solid #f4f4f4" }}>
                    <select
                      value={r.type}
                      onChange={(e) => setCell(i, "type", e.target.value)}
                    >
                      <option value="level">Nivå</option>
                      <option value="break">Pause</option>
                    </select>
                  </td>

                  <td style={{ padding: 8, borderBottom: "1px solid #f4f4f4" }}>
                    <input
                      value={r.title}
                      onChange={(e) => setCell(i, "title", e.target.value)}
                      style={{
                        width: "100%",
                        padding: 6,
                        borderRadius: 8,
                        border: "1px solid #ddd",
                      }}
                    />
                  </td>

                  <td
                    style={{
                      padding: 8,
                      borderBottom: "1px solid #f4f4f4",
                      width: 70,
                    }}
                  >
                    <input
                      type="number"
                      min="1"
                      value={r.minutes}
                      onChange={(e) => setCell(i, "minutes", e.target.value)}
                      style={{
                        width: 64,
                        padding: 6,
                        borderRadius: 8,
                        border: "1px solid #ddd",
                      }}
                    />
                  </td>

                  <td
                    style={{
                      padding: 8,
                      borderBottom: "1px solid #f4f4f4",
                      width: 80,
                    }}
                  >
                    <input
                      type="number"
                      min="0"
                      disabled={isBreak}
                      value={r.sb}
                      onChange={(e) => setCell(i, "sb", e.target.value)}
                      style={{
                        width: 72,
                        padding: 6,
                        borderRadius: 8,
                        border: "1px solid #ddd",
                        opacity: isBreak ? 0.5 : 1,
                      }}
                    />
                  </td>

                  <td
                    style={{
                      padding: 8,
                      borderBottom: "1px solid #f4f4f4",
                      width: 80,
                    }}
                  >
                    <input
                      type="number"
                      min="0"
                      disabled={isBreak}
                      value={r.bb}
                      onChange={(e) => setCell(i, "bb", e.target.value)}
                      style={{
                        width: 72,
                        padding: 6,
                        borderRadius: 8,
                        border: "1px solid #ddd",
                        opacity: isBreak ? 0.5 : 1,
                      }}
                    />
                  </td>

                  <td
                    style={{
                      padding: 8,
                      borderBottom: "1px solid #f4f4f4",
                      width: 80,
                    }}
                  >
                    <input
                      type="number"
                      min="0"
                      disabled={isBreak}
                      value={r.ante}
                      onChange={(e) => setCell(i, "ante", e.target.value)}
                      style={{
                        width: 72,
                        padding: 6,
                        borderRadius: 8,
                        border: "1px solid #ddd",
                        opacity: isBreak ? 0.5 : 1,
                      }}
                    />
                  </td>

                  <td
                    style={{
                      padding: 8,
                      borderBottom: "1px solid #f4f4f4",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <button
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      title="Opp"
                    >
                      ↑
                    </button>{" "}
                    <button
                      onClick={() => move(i, +1)}
                      disabled={i === rows.length - 1}
                      title="Ned"
                    >
                      ↓
                    </button>{" "}
                    <button onClick={() => delRow(i)} title="Slett">
                      Slett
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {importMsg ? (
        <div style={{ marginTop: 10, opacity: 0.85 }}>{importMsg}</div>
      ) : null}

      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          marginTop: 12,
          flexWrap: "wrap",
        }}
      >
        <button
          disabled={!canApply}
          onClick={() => {
            const msg = validate(rows);
            if (msg) {
              setErr(msg);
              return;
            }
            setErr("");
            const tournament = toTournamentFromRows(name, rows);
            updateTournament(tournament);
            setDirty(false);
          }}
        >
          Bruk oppsett
        </button>

        {err ? <span style={{ color: "crimson" }}>{err}</span> : null}

        <span style={{ opacity: 0.7, fontSize: 12 }}>
          (durationSeconds = minutter × 60. Pauser ignorerer SB/BB/Ante.)
        </span>
      </div>
    </div>
  );
}
