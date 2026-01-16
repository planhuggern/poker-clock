import { Navigate, useNavigate, Link } from "react-router-dom";
import { usePokerSocket } from "../lib/usePokerSocket";
import ClockCard from "../components/ClockCard";
import AdminTournamentEditor from "../components/AdminTournamentEditor";

export default function Home() {
  const nav = useNavigate();
  const token = localStorage.getItem("poker_token");
  const role = localStorage.getItem("poker_role") || "viewer";
  

  if (!token) return <Navigate to="/login" replace />;

  const { status, error, snapshot, start, pause, reset, next, prev, updateTournament } = usePokerSocket(token);

  return (
    <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 820 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ margin: 0 }}>Pokerklokke</h1>
        <Link to="/tv">TV</Link>
      </div>

      <div style={{ margin: "12px 0" }}>
        Status: <b>{status}</b>
        {error ? <span> – {error}</span> : null}
        {" · "}
        Role: <b>{role}</b>
      </div>

      <ClockCard snapshot={snapshot} />

      {role === "admin" ? (
        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={start}>Start</button>
          <button onClick={pause}>Pause</button>
          <button onClick={reset}>Reset nivå</button>
          <button onClick={prev}>Forrige</button>
          <button onClick={next}>Neste</button>
        </div>
      ) : (
        <div style={{ marginTop: 12, opacity: 0.8 }}>
          (Kun admin kan styre.)
        </div>
      )}

      <AdminTournamentEditor
        role={role}
        snapshot={snapshot}
        updateTournament={updateTournament}
      />

      <div style={{ marginTop: 16 }}>
        <button
          onClick={() => {
            localStorage.removeItem("poker_token");
            localStorage.removeItem("poker_role");
            nav("/login", { replace: true });
          }}
        >
          Logg ut
        </button>
      </div>
    </div>
  );
}
