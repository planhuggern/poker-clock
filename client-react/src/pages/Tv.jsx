import { Navigate } from "react-router-dom";
import { usePokerSocket } from "../lib/usePokerSocket";
import ClockCard from "../components/ClockCard";

export default function Tv() {
  const token = localStorage.getItem("poker_token");
  if (!token) return <Navigate to="/login" replace />;

  const { status, error, snapshot } = usePokerSocket(token);

  return (
    <div style={{
      height: "100vh",
      padding: 24,
      fontFamily: "system-ui",
      display: "grid",
      placeItems: "center"
    }}>
      <div style={{ width: "min(1100px, 96vw)" }}>
        <div style={{ marginBottom: 10, opacity: 0.7 }}>
          {status}{error ? ` – ${error}` : ""}
        </div>
        <ClockCard snapshot={snapshot} big />
      </div>
    </div>
  );
}
