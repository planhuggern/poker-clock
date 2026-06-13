import { Routes, Route, Navigate } from "react-router-dom";
import Callback from "./pages/Callback";
import Home from "./pages/Home";
import Tv from "./pages/Tv";
import TournamentList from "./pages/TournamentList";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<TournamentList />} />
      <Route path="/tournament/:tournamentId" element={<Home />} />
      <Route path="/tournament/:tournamentId/tv" element={<Tv />} />
      {/* Auth callback — receives token from dev-login */}
      <Route path="/callback" element={<Callback />} />
      {/* Legacy back-compat: /tv still goes to tournament 1 */}
      <Route path="/tv" element={<Navigate to="/tournament/1/tv" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
