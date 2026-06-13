import { useEffect, useState } from "react";
import type { Level, Snapshot, Tournament } from "../lib/types";

interface Row {
  type: "level" | "break";
  title: string;
  minutes: string | number;
  sb: string | number;
  bb: string | number;
  ante: string | number;
}

interface RowSettings {
  buyIn: string;
  rebuyAmount: string;
  addOnAmount: string;
  startingStack: string;
}

interface Preset {
  name: string;
  buyIn: number;
  rebuyAmount: number;
  addOnAmount: number;
  startingStack: number;
  levels: Level[];
}

function toRowsFromTournament(t: { levels?: Level[] } | null | undefined): Row[] {
  const levels = Array.isArray(t?.levels) ? t!.levels : [];
  return levels.map((L) => ({
    type: L.type === "break" ? "break" as const : "level" as const,
    title: L.title ?? "",
    minutes: Math.max(1, Math.round((L.durationSeconds ?? L.seconds ?? 60) / 60)),
    sb: L.sb ?? 0,
    bb: L.bb ?? 0,
    ante: L.ante ?? 0,
  }));
}

function toTournamentFromRows(name: string, rows: Row[], settings: RowSettings = { buyIn: "0", rebuyAmount: "0", addOnAmount: "0", startingStack: "0" }): Omit<Tournament, "id" | "status" | "admin" | "playerCount"> {
  return {
    name: name || "Pokerturnering",
    buyIn:        Number(settings.buyIn)        || 0,
    rebuyAmount:  Number(settings.rebuyAmount)  || 0,
    addOnAmount:  Number(settings.addOnAmount)  || 0,
    startingStack:Number(settings.startingStack)|| 0,
    levels: rows.map((r) => {
      const durationSeconds = Math.max(1, Number(r.minutes || 1)) * 60;
      if (r.type === "break") {
        return { type: "break" as const, title: r.title || "Pause", durationSeconds };
      }
      return {
        type: "level" as const,
        title: r.title || "",
        durationSeconds,
        sb: Number(r.sb || 0),
        bb: Number(r.bb || 0),
        ante: Number(r.ante || 0),
      };
    }),
  };
}

function validate(rows: Row[]): string {
  if (!rows.length) return "Må ha minst én rad.";
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const idx = i + 1;
    if (!r.type) return `Rad ${idx}: type mangler`;
    const m = Number(r.minutes);
    if (!Number.isFinite(m) || m <= 0)
      return `Rad ${idx}: minutter må være > 0`;

    if (r.type === "level") {
      const sb = Number(r.sb), bb = Number(r.bb), ante = Number(r.ante);
      if (!Number.isFinite(sb) || sb < 0) return `Rad ${idx}: SB må være >= 0`;
      if (!Number.isFinite(bb) || bb <= 0) return `Rad ${idx}: BB må være > 0`;
      if (!Number.isFinite(ante) || ante < 0) return `Rad ${idx}: Ante må være >= 0`;
      if (sb > bb) return `Rad ${idx}: SB bør ikke være større enn BB`;
    }
  }
  return "";
}

const PRESETS: Record<string, Preset> = {
  quick: {
    name: "Hurtigturnering",
    buyIn: 100, rebuyAmount: 100, addOnAmount: 100, startingStack: 5000,
    levels: [
      { type:"level", title:"Level 1",  sb:25,   bb:50,   ante:0,   durationSeconds:600 },
      { type:"level", title:"Level 2",  sb:50,   bb:100,  ante:0,   durationSeconds:600 },
      { type:"level", title:"Level 3",  sb:75,   bb:150,  ante:0,   durationSeconds:600 },
      { type:"break", title:"Pause",                                  durationSeconds:300 },
      { type:"level", title:"Level 4",  sb:100,  bb:200,  ante:25,  durationSeconds:600 },
      { type:"level", title:"Level 5",  sb:150,  bb:300,  ante:25,  durationSeconds:600 },
      { type:"level", title:"Level 6",  sb:200,  bb:400,  ante:50,  durationSeconds:600 },
      { type:"break", title:"Pause",                                  durationSeconds:300 },
      { type:"level", title:"Level 7",  sb:300,  bb:600,  ante:75,  durationSeconds:600 },
      { type:"level", title:"Level 8",  sb:400,  bb:800,  ante:100, durationSeconds:600 },
    ],
  },
  standard: {
    name: "Standard turnering",
    buyIn: 200, rebuyAmount: 200, addOnAmount: 200, startingStack: 10000,
    levels: [
      { type:"level", title:"Level 1",  sb:25,   bb:50,   ante:0,   durationSeconds:900 },
      { type:"level", title:"Level 2",  sb:50,   bb:100,  ante:0,   durationSeconds:900 },
      { type:"level", title:"Level 3",  sb:75,   bb:150,  ante:0,   durationSeconds:900 },
      { type:"break", title:"Pause",                                  durationSeconds:600 },
      { type:"level", title:"Level 4",  sb:100,  bb:200,  ante:25,  durationSeconds:900 },
      { type:"level", title:"Level 5",  sb:150,  bb:300,  ante:25,  durationSeconds:900 },
      { type:"level", title:"Level 6",  sb:200,  bb:400,  ante:50,  durationSeconds:900 },
      { type:"break", title:"Pause",                                  durationSeconds:600 },
      { type:"level", title:"Level 7",  sb:300,  bb:600,  ante:75,  durationSeconds:900 },
      { type:"level", title:"Level 8",  sb:400,  bb:800,  ante:100, durationSeconds:900 },
      { type:"level", title:"Level 9",  sb:500,  bb:1000, ante:100, durationSeconds:900 },
      { type:"break", title:"Pause",                                  durationSeconds:600 },
      { type:"level", title:"Level 10", sb:600,  bb:1200, ante:200, durationSeconds:900 },
    ],
  },
  deep: {
    name: "Deep Stack",
    buyIn: 500, rebuyAmount: 500, addOnAmount: 500, startingStack: 25000,
    levels: [
      { type:"level", title:"Level 1",  sb:25,   bb:50,   ante:0,   durationSeconds:1200 },
      { type:"level", title:"Level 2",  sb:50,   bb:100,  ante:0,   durationSeconds:1200 },
      { type:"level", title:"Level 3",  sb:75,   bb:150,  ante:0,   durationSeconds:1200 },
      { type:"level", title:"Level 4",  sb:100,  bb:200,  ante:0,   durationSeconds:1200 },
      { type:"break", title:"Pause",                                  durationSeconds:900 },
      { type:"level", title:"Level 5",  sb:150,  bb:300,  ante:25,  durationSeconds:1200 },
      { type:"level", title:"Level 6",  sb:200,  bb:400,  ante:25,  durationSeconds:1200 },
      { type:"level", title:"Level 7",  sb:300,  bb:600,  ante:50,  durationSeconds:1200 },
      { type:"level", title:"Level 8",  sb:400,  bb:800,  ante:75,  durationSeconds:1200 },
      { type:"break", title:"Pause",                                  durationSeconds:900 },
      { type:"level", title:"Level 9",  sb:500,  bb:1000, ante:100, durationSeconds:1200 },
      { type:"level", title:"Level 10", sb:600,  bb:1200, ante:100, durationSeconds:1200 },
      { type:"level", title:"Level 11", sb:800,  bb:1600, ante:200, durationSeconds:1200 },
      { type:"level", title:"Level 12", sb:1000, bb:2000, ante:200, durationSeconds:1200 },
      { type:"break", title:"Pause",                                  durationSeconds:900 },
      { type:"level", title:"Level 13", sb:1500, bb:3000, ante:300, durationSeconds:1200 },
      { type:"level", title:"Level 14", sb:2000, bb:4000, ante:400, durationSeconds:1200 },
    ],
  },
};

function applyPreset(
  key: string,
  setName: (v: string) => void,
  setRows: (v: Row[]) => void,
  setBuyIn: (v: string) => void,
  setRebuyAmount: (v: string) => void,
  setAddOnAmount: (v: string) => void,
  setStartingStack: (v: string) => void,
  setDirty: (v: boolean) => void,
): void {
  const p = PRESETS[key];
  if (!p) return;
  setName(p.name);
  setRows(toRowsFromTournament(p));
  setBuyIn(String(p.buyIn));
  setRebuyAmount(String(p.rebuyAmount));
  setAddOnAmount(String(p.addOnAmount));
  setStartingStack(String(p.startingStack));
  setDirty(true);
}

function downloadJson(filename: string, obj: unknown): void {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function readJsonFile(file: File): Promise<unknown> {
  const text = await file.text();
  return JSON.parse(text);
}

interface AdminTournamentTableProps {
  snapshot: Snapshot | null;
  updateTournament: (tournament: Partial<Tournament>) => void;
}

export default function AdminTournamentTable({
  snapshot,
  updateTournament,
}: AdminTournamentTableProps) {
  const t = snapshot?.tournament;

  const [name, setName] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState("");
  const [dirty, setDirty] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [buyIn, setBuyIn] = useState("200");
  const [rebuyAmount, setRebuyAmount] = useState("200");
  const [addOnAmount, setAddOnAmount] = useState("200");
  const [startingStack, setStartingStack] = useState("10000");

  useEffect(() => {
    if (!t || dirty) return;
    setName(t.name ?? "Pokerturnering");
    setRows(toRowsFromTournament(t));
    setBuyIn(String(t.buyIn ?? 200));
    setRebuyAmount(String(t.rebuyAmount ?? 200));
    setAddOnAmount(String(t.addOnAmount ?? 200));
    setStartingStack(String(t.startingStack ?? 10000));
  }, [t, dirty]);

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

  const delRow = (i: number) => {
    setDirty(true);
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  };

  const move = (i: number, dir: number) => {
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

  const setCell = (i: number, key: keyof Row, value: string | number) => {
    setDirty(true);
    setRows((prev) => {
      const copy = prev.slice();
      copy[i] = { ...copy[i], [key]: value } as Row;
      if (key === "type" && value === "break") {
        copy[i].sb = 0;
        copy[i].bb = 0;
        copy[i].ante = 0;
        if (!copy[i].title) copy[i].title = "Pause";
      }
      return copy;
    });
  };

  const canApply = rows.length > 0;

  return (
    <div className="mt-5">
      <h3>Admin: Rediger oppsett</h3>

      <div className="flex gap-2 items-center flex-wrap mb-3">
        <label>Preset:</label>
        <select
          className="select select-sm"
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) {
              applyPreset(e.target.value, setName, setRows, setBuyIn, setRebuyAmount, setAddOnAmount, setStartingStack, setDirty);
              e.target.value = "";
            }
          }}
        >
          <option value="">Bruk preset…</option>
          <option value="quick">Hurtigturnering (10 min)</option>
          <option value="standard">Standard (15 min)</option>
          <option value="deep">Deep Stack (20 min)</option>
        </select>
      </div>

      <div className="flex gap-3 flex-wrap mb-4 p-3 bg-base-300/50 rounded-xl border border-base-content/10">
        {[
          { label: "Buy-in kr",  val: buyIn,         set: setBuyIn },
          { label: "Rebuy kr",   val: rebuyAmount,   set: setRebuyAmount },
          { label: "Add-on kr",  val: addOnAmount,   set: setAddOnAmount },
          { label: "Startstack", val: startingStack, set: setStartingStack },
        ].map(({ label, val, set }) => (
          <label key={label}>
            {label}
            <input
              type="number"
              min="0"
              value={val}
              onChange={(e) => { setDirty(true); set(e.target.value); }}
              className="input input-sm editor-input--num90"
            />
          </label>
        ))}
      </div>

      <div className="flex gap-2 items-center flex-wrap mb-2">
        <label>Turneringsnavn:</label>
        <input
          value={name}
          onChange={(e) => { setDirty(true); setName(e.target.value); }}
          className="input editor-input--wide"
        />

        <button className="btn btn-sm" onClick={addLevel}>+ Legg til nivå</button>
        <button className="btn btn-sm" onClick={addBreak}>+ Legg til pause</button>

        <button
          className="btn btn-sm"
          onClick={() => {
            const tournament = toTournamentFromRows(name, rows, { buyIn, rebuyAmount, addOnAmount, startingStack });
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

        <label className="editor-import-btn" title="Importer oppsett fra JSON-fil">
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
                const parsed = await readJsonFile(file) as Record<string, unknown>;

                if (!parsed || !Array.isArray(parsed.levels) || (parsed.levels as unknown[]).length === 0) {
                  throw new Error("JSON må ha levels[] med minst ett element");
                }

                const importedTournament = {
                  name: (parsed.name as string) ?? "Pokerturnering",
                  levels: parsed.levels as Level[],
                };

                setName(importedTournament.name);
                setRows(toRowsFromTournament(importedTournament));
                updateTournament(importedTournament);
                setDirty(false);
                setErr("");
                setImportMsg("Importert og sendt til server ✅");
              } catch (err) {
                setImportMsg(`Import feilet: ${(err as Error)?.message || "Ugyldig fil"}`);
              } finally {
                e.target.value = "";
              }
            }}
          />
        </label>

        <button
          className="btn btn-ghost btn-sm"
          onClick={() => { setDirty(false); setErr(""); setImportMsg(""); }}
        >
          Angre lokale endringer
        </button>
      </div>

      <div className="editor-table-wrap">
        <table className="editor-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Type</th>
              <th>Tittel</th>
              <th>Min</th>
              <th>SB</th>
              <th>BB</th>
              <th>Ante</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r, i) => {
              const isBreak = r.type === "break";
              return (
                <tr key={i}>
                  <td className="w-34">{i + 1}</td>

                  <td>
                    <select
                      className="select select-sm"
                      value={r.type}
                      onChange={(e) => setCell(i, "type", e.target.value)}
                    >
                      <option value="level">Nivå</option>
                      <option value="break">Pause</option>
                    </select>
                  </td>

                  <td>
                    <input
                      value={r.title}
                      onChange={(e) => setCell(i, "title", e.target.value)}
                      className="input input-sm editor-input--full"
                    />
                  </td>

                  <td className="w-70">
                    <input
                      type="number"
                      min="1"
                      value={r.minutes}
                      onChange={(e) => setCell(i, "minutes", e.target.value)}
                      className="input input-sm editor-input--sm"
                    />
                  </td>

                  <td className="w-80">
                    <input
                      type="number"
                      min="0"
                      disabled={isBreak}
                      value={r.sb}
                      onChange={(e) => setCell(i, "sb", e.target.value)}
                      className="input input-sm editor-input--num"
                    />
                  </td>

                  <td className="w-80">
                    <input
                      type="number"
                      min="0"
                      disabled={isBreak}
                      value={r.bb}
                      onChange={(e) => setCell(i, "bb", e.target.value)}
                      className="input input-sm editor-input--num"
                    />
                  </td>

                  <td className="w-80">
                    <input
                      type="number"
                      min="0"
                      disabled={isBreak}
                      value={r.ante}
                      onChange={(e) => setCell(i, "ante", e.target.value)}
                      className="input input-sm editor-input--num"
                    />
                  </td>

                  <td className="nowrap">
                    <button className="btn btn-ghost btn-xs" onClick={() => move(i, -1)} disabled={i === 0} title="Opp">↑</button>{" "}
                    <button className="btn btn-ghost btn-xs" onClick={() => move(i, +1)} disabled={i === rows.length - 1} title="Ned">↓</button>{" "}
                    <button className="btn btn-error btn-xs" onClick={() => delRow(i)} title="Slett">Slett</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {importMsg ? <div className="mt-2">{importMsg}</div> : null}

      <div className="flex gap-2 items-center mt-3 flex-wrap">
        <button
          className="btn btn-primary btn-sm"
          disabled={!canApply}
          onClick={() => {
            const msg = validate(rows);
            if (msg) { setErr(msg); return; }
            setErr("");
            updateTournament(toTournamentFromRows(name, rows, { buyIn, rebuyAmount, addOnAmount, startingStack }));
            setDirty(false);
          }}
        >
          Bruk oppsett
        </button>

        {err ? <span style={{ color: "crimson" }}>{err}</span> : null}

        <span className="text-xs opacity-70">
          (durationSeconds = minutter × 60. Pauser ignorerer SB/BB/Ante.)
        </span>
      </div>
    </div>
  );
}
