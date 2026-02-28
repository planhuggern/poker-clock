import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login.jsx";
import Callback from "./pages/Callback.jsx";
import Home from "./pages/Home.jsx";
import Tv from "./pages/Tv.jsx";
import TournamentList from "./pages/TournamentList.jsx";

export default function App() {
  return (
    <Routes>
      {/* Landing: list of tournaments */}
      <Route path="/" element={<TournamentList />} />

      {/* Per-tournament views */}
      <Route path="/tournament/:tournamentId" element={<Home />} />
      <Route path="/tournament/:tournamentId/tv" element={<Tv />} />

      {/* Auth */}
      <Route path="/login" element={<Login />} />
      <Route path="/callback" element={<Callback />} />

      {/* Legacy back-compat: /tv still goes to tournament 1 */}
      <Route path="/tv" element={<Navigate to="/tournament/1/tv" replace />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
