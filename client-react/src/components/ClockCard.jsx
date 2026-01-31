function fmtTime(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return String(m).padStart(2, "0") + ":" + String(r).padStart(2, "0");
}

export default function ClockCard({ snapshot, big = false }) {
  if (!snapshot) return <div>Venter på snapshot…</div>;

  const t = snapshot.tournament;
  const lvl = t?.levels?.[snapshot.currentIndex];

  return (
    <div className={big ? "clock-card big" : "clock-card"}>
      <div className="clock-time">
        {fmtTime(snapshot.timing?.remaining)}
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
