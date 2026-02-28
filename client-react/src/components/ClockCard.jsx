import { useEffect, useRef, useState } from "react";

function fmtTime(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return String(m).padStart(2, "0") + ":" + String(r).padStart(2, "0");
}

/**
 * Lokal klokke som teller ned 100 ms om gangen.
 * Server-ticks brukes kun til å korrigere dersom drift > 2 sek,
 * eller når klokka er stoppet (pause/start/level-bytte).
 * Dette unngår hopp forårsaket av nettverksjitter.
 */
function useDisplayRemaining(snapshot) {
  const [display, setDisplay] = useState(snapshot?.timing?.remaining ?? 0);
  // Refs oppdateres kun i effects/callbacks – aldri under render.
  const localRef = useRef(snapshot?.timing?.remaining ?? 0);
  const snapshotRef = useRef(snapshot);

  // Synk inn ny snapshot: oppdater refs og korriger lokal verdi ved behov.
  useEffect(() => {
    snapshotRef.current = snapshot;
    if (!snapshot) return;
    const serverRemaining = snapshot.timing?.remaining ?? 0;
    if (!snapshot.running) {
      // Klokka stoppet – snap til server-verdi
      localRef.current = serverRemaining;
    } else {
      // Korriger kun ved drift > 2 sek
      const drift = Math.abs(localRef.current - serverRemaining);
      if (drift > 2) localRef.current = serverRemaining;
    }
  }, [snapshot]);

  // Enkelt 100 ms-intervall. setDisplay kallast kun inne i callback (asynkront),
  // aldri synkront i effect-body.
  useEffect(() => {
    const id = setInterval(() => {
      if (snapshotRef.current?.running) {
        localRef.current = Math.max(0, localRef.current - 0.1);
      }
      setDisplay(localRef.current);
    }, 100);
    return () => clearInterval(id);
  }, []);

  return display;
}

export default function ClockCard({ snapshot, big = false }) {
  const remaining = useDisplayRemaining(snapshot);

  if (!snapshot) return <div>Venter på snapshot…</div>;

  const t = snapshot.tournament;
  const lvl = t?.levels?.[snapshot.currentIndex];

  return (
    <div className={big ? "clock-card big" : "clock-card"}>
      <div className="clock-time">
        {fmtTime(remaining)}
      </div>
      <div className="clock-level">
        {lvl?.type === "break" ? "PAUSE" : "NIVÅ"} {snapshot.currentIndex + 1} / {t?.levels?.length ?? "?"}
        {lvl?.title ? ` – ${lvl.title}` : ""}
      </div>
      <div className="clock-blinds">
        {lvl?.type === "level"
          ? `Blinds: ${lvl.sb}/${lvl.bb}  Ante: ${lvl.ante ?? 0}`
          : `Pause: ${fmtTime(snapshot.timing?.total)}`}
      </div>
      <div className="clock-status">
        Status: {snapshot.running ? "KJØRER" : "PAUSE"}
      </div>
    </div>
  );
}

