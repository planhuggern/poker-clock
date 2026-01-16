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
    <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 12 }}>
      <div style={{ fontSize: big ? 96 : 48, fontWeight: 800, lineHeight: 1 }}>
        {fmtTime(snapshot.timing?.remaining)}
      </div>

      <div style={{ marginTop: 8, fontSize: big ? 28 : 16 }}>
        {lvl?.type === "break" ? "PAUSE" : "NIVÅ"} {snapshot.currentIndex + 1} /{" "}
        {t?.levels?.length ?? "?"}
        {lvl?.title ? ` – ${lvl.title}` : ""}
      </div>

      <div style={{ marginTop: 6, fontSize: big ? 22 : 14, opacity: 0.9 }}>
        {lvl?.type === "level"
          ? `Blinds: ${lvl.sb}/${lvl.bb}  Ante: ${lvl.ante ?? 0}`
          : `Pause: ${fmtTime(snapshot.timing?.total)}`}
      </div>

      <div style={{ marginTop: 10, fontSize: big ? 18 : 12, opacity: 0.7 }}>
        Status: {snapshot.running ? "KJØRER" : "PAUSE"}
      </div>
    </div>
  );
}
