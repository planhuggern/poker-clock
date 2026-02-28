import { useEffect, useRef, useState } from "react";

export function fmtTime(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return String(m).padStart(2, "0") + ":" + String(r).padStart(2, "0");
}

export function fmtChips(n) {
  if (!n && n !== 0) return "-";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "k";
  return String(n);
}

/**
 * Lokal klokke som teller ned 100 ms om gangen.
 * Server-ticks brukes kun til å korrigere dersom drift > 2 sek,
 * eller når klokka er stoppet (pause/start/level-bytte).
 */
function useDisplayRemaining(snapshot) {
  const [display, setDisplay] = useState(snapshot?.timing?.remaining ?? 0);
  const localRef = useRef(snapshot?.timing?.remaining ?? 0);
  const snapshotRef = useRef(snapshot);

  useEffect(() => {
    snapshotRef.current = snapshot;
    if (!snapshot) return;
    const serverRemaining = snapshot.timing?.remaining ?? 0;
    if (!snapshot.running) {
      localRef.current = serverRemaining;
    } else {
      const drift = Math.abs(localRef.current - serverRemaining);
      if (drift > 2) localRef.current = serverRemaining;
    }
  }, [snapshot]);

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

  if (!snapshot) return <div className="clock-card">Venter på snapshot…</div>;

  const t = snapshot.tournament;
  const levels = t?.levels ?? [];
  const lvl = levels[snapshot.currentIndex];
  const nextLvl = levels[snapshot.currentIndex + 1];
  const total = snapshot.timing?.total ?? 0;
  const progress = total > 0 ? Math.min(1, (total - remaining) / total) : 0;

  const isBreak = lvl?.type === "break";
  const isWarning = !isBreak && remaining <= 60 && snapshot.running;
  const isCritical = !isBreak && remaining <= 30 && snapshot.running;

  let cardClass = "clock-card";
  if (big) cardClass += " big";
  if (isCritical) cardClass += " critical";
  else if (isWarning) cardClass += " warning";
  if (isBreak) cardClass += " break-card";

  return (
    <div className={cardClass}>

      {/* Level header */}
      <div className="clock-level-header">
        {isBreak ? "☕ PAUSE" : `NIVÅ ${snapshot.currentIndex + 1}`}
        {lvl?.title ? <span className="clock-level-title">{lvl.title}</span> : null}
      </div>

      {/* Big time */}
      <div className="clock-time">
        {fmtTime(remaining)}
      </div>

      {/* Progress bar */}
      <div className="clock-progress-track">
        <div
          className="clock-progress-fill"
          style={{ width: `${(progress * 100).toFixed(1)}%` }}
        />
      </div>

      {/* Blinds row */}
      <div className="clock-blinds">
        {isBreak ? (
          <span>Pause: {fmtTime(total)}</span>
        ) : (
          <>
            <span className="blind-item">SB <b>{fmtChips(lvl?.sb)}</b></span>
            <span className="blind-sep">/</span>
            <span className="blind-item">BB <b>{fmtChips(lvl?.bb)}</b></span>
            {lvl?.ante ? <><span className="blind-sep">·</span><span className="blind-item">Ante <b>{fmtChips(lvl.ante)}</b></span></> : null}
          </>
        )}
      </div>

      {/* Next level preview */}
      {nextLvl && (
        <div className="clock-next">
          {nextLvl.type === "break"
            ? `Neste: ☕ Pause (${nextLvl.seconds ? Math.round(nextLvl.seconds / 60) : "?"}m)`
            : `Neste: ${fmtChips(nextLvl.sb)}/${fmtChips(nextLvl.bb)}${nextLvl.ante ? ` · Ante ${fmtChips(nextLvl.ante)}` : ""}`
          }
        </div>
      )}

      {/* Status */}
      <div className="clock-status-row">
        <span className={`clock-dot ${snapshot.running ? "running" : "paused"}`} />
        {snapshot.running ? "Kjører" : "Pause"}
      </div>
    </div>
  );
}
