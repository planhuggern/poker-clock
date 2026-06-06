import { Navigate, useLocation } from "react-router-dom";

export default function Callback() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const token = params.get("token");
  const role = params.get("role");

  if (!token) {
    return <Navigate to="/login?error=missing_token" replace />;
  }

  // Lagre synkront (render-kode). I dev kan den rendres to ganger,
  // men det er idempotent: setItem med samme verdi er helt OK.
  localStorage.setItem("poker_token", token);
  if (role) localStorage.setItem("poker_role", role);

  // (valgfritt) Rydd URL: ved å navigere bort forsvinner query uansett
  return <Navigate to="/" replace />;
}
