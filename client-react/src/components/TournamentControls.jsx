export default function TournamentControls({
  isAdmin,
  running,
  pause,
  start,
  reset,
  prev,
  next,
  currentIndex,
  levels,
  addTime,
  jump,
}) {
  if (!isAdmin) {
    return <div className="text-xs opacity-40 mt-1 text-center">Kun host kan styre klokken.</div>;
  }

  return (
    <>
      <div className="bg-base-300/60 rounded-2xl border border-base-content/10 p-4 mb-4">
        <div className="flex gap-2 flex-wrap items-center mb-2">
          <button className={`btn btn-primary btn-sm${running ? " btn-active" : ""}`} onClick={running ? pause : start}>
            {running ? "⏸ Pause" : "▶ Start"}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={reset}>⟳ Reset nivå</button>
          <button className="btn btn-secondary btn-sm" onClick={prev} disabled={currentIndex === 0}>◀ Forrige</button>
          <button className="btn btn-secondary btn-sm" onClick={next} disabled={currentIndex >= levels.length - 1}>Neste ▶</button>
        </div>
        <div className="flex gap-2 flex-wrap items-center mb-2">
          <span className="text-xs opacity-50 min-w-[54px]">Legg til tid:</span>
          <button className="btn btn-ghost btn-sm" onClick={() => addTime(60)}>+1 min</button>
          <button className="btn btn-ghost btn-sm" onClick={() => addTime(300)}>+5 min</button>
          <button className="btn btn-ghost btn-sm" onClick={() => addTime(-60)}>−1 min</button>
        </div>
      </div>

      {levels.length > 0 && (
        <div className="mb-4">
          <div className="text-xs opacity-50 mb-2">Hopp til nivå:</div>
          <div className="flex flex-wrap gap-1.5">
            {levels.map((lvl, i) => (
              <button
                key={i}
                className={`level-nav-btn${i === currentIndex ? " current" : ""}${lvl.type === "break" ? " break" : ""}`}
                onClick={() => jump(i)}
                title={lvl.title}
              >
                {lvl.type === "break" ? "☕" : `L${i + 1 - levels.slice(0, i + 1).filter((l) => l.type === "break").length}`}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
