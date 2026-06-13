import { useState } from "react";
import { useParams } from "react-router-dom";
import { usePokerSocket } from "../lib/usePokerSocket";
import { usePlayerApi } from "../lib/usePlayerApi";
import ClockCard from "../components/ClockCard";
import AdminTournamentTable from "../components/AdminTournamentTable";
import TournamentRegistration from "../components/TournamentRegistration";
import TournamentControls from "../components/TournamentControls";
import TournamentPlayersPanel from "../components/TournamentPlayersPanel";
import TournamentHeader from "../components/TournamentHeader";


export default function Home() {
  const { tournamentId: tidParam } = useParams();
  const tournamentId = Number(tidParam) || 1;

  const [token] = useState(() => localStorage.getItem("poker_token"));
  const [role] = useState(() => localStorage.getItem("poker_role") || "viewer");

  const { profile, register } = usePlayerApi(token);
  const isRegistered = profile?.activeTournamentId === tournamentId;

  const {
    status, snapshot,
    start, pause, reset, next, prev, jump,
    updateTournament, addTime, setPlayers, rebuy, addOn, bustout,
  } = usePokerSocket(token, tournamentId);

  const isAdmin = !!(profile && snapshot?.tournament &&
    profile.username === snapshot.tournament.admin?.username);

  const t = snapshot?.tournament;
  const levels = t?.levels ?? [];
  const players = snapshot?.players;
  const currentIndex = snapshot?.currentIndex ?? 0;
  const running = snapshot?.running;

  return (
    <main className="main-content">

      {/* Header */}
      <TournamentHeader
        title={t?.name}
        status={status}
        tournamentId={tournamentId}
        token={token}
      />

      {/* Clock */}
      <ClockCard snapshot={snapshot} />

      {/* Registration */}
      <TournamentRegistration
        isRegistered={isRegistered}
        profile={profile}
        tournamentId={tournamentId}
        register={register}
      />

      {/* Clock controls */}
      <TournamentControls
        isAdmin={isAdmin}
        running={running}
        pause={pause}
        start={start}
        reset={reset}
        prev={prev}
        next={next}
        currentIndex={currentIndex}
        levels={levels}
        addTime={addTime}
        jump={jump}
      />

      {/* Players panel */}
      <TournamentPlayersPanel
        isAdmin={isAdmin}
        players={players}
        setPlayers={setPlayers}
        bustout={bustout}
        rebuy={rebuy}
        addOn={addOn}
        tournament={t}
      />

      {/* Tournament editor */}
      <AdminTournamentTable
        role={role}
        snapshot={snapshot}
        updateTournament={updateTournament}
      />

    </main>
  );
}
