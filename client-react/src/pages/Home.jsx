import { Navigate, useNavigate } from "react-router-dom";

export default function Home() {
  const nav = useNavigate();
  const token = localStorage.getItem("poker_token");
  const role = localStorage.getItem("poker_role");

  if (!token) return <Navigate to="/login" replace />;

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Innlogget ✅</h1>
      <p>Role: <b>{role || "viewer"}</b></p>
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
  );
}
