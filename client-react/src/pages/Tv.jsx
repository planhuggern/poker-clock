import { Navigate } from "react-router-dom";
import { usePokerSocket } from "../lib/usePokerSocket";
import ClockCard from "../components/ClockCard";


export default function Tv() {
  const token = localStorage.getItem("poker_token");
  const { status, error, snapshot } = usePokerSocket(token);

  if (!token) return <Navigate to="/login" replace />;

  return (
    <main className="main-content" style={{ display: "flex", flexDirection: "column", alignItems: "center", minHeight: "80vh", justifyContent: "center" }}>
      <div style={{ marginBottom: 10, opacity: 0.7 }}>
        {status}{error ? ` – ${error}` : ""}
      </div>
      <ClockCard snapshot={snapshot} big />
    </main>
  );
}
