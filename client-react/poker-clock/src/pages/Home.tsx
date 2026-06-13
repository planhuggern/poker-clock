import { useParams } from "react-router-dom";
import { usePokerSocket } from "../lib/usePokerSocket";
import ClockCard from "../components/ClockCard";
import AdminTournamentTable from "../components/AdminTournamentTable";
import TournamentControls from "../components/TournamentControls";
import TournamentPlayersPanel from "../components/TournamentPlayersPanel";
import TournamentHeader from "../components/TournamentHeader";

export default function Home() {
  const { tournamentId: tidParam } = useParams<{ tournamentId: string }>();
  const tournamentId = Number(tidParam) || 1;

  const {
    status, snapshot,
    start, pause, reset, next, prev, jump,
    updateTournament, addTime, setPlayers, rebuy, addOn, bustout,
  } = usePokerSocket(tournamentId);

  const t = snapshot?.tournament;
  const levels = t?.levels ?? [];
  const players = snapshot?.players;
  const currentIndex = snapshot?.currentIndex ?? 0;
  const running = snapshot?.running ?? false;

  return (
    <main className="main-content">
      <TournamentHeader
        title={t?.name}
        status={status}
        tournamentId={tournamentId}
      />

      <ClockCard snapshot={snapshot} />

      <TournamentControls
        isAdmin
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

      <TournamentPlayersPanel
        isAdmin
        players={players}
        setPlayers={setPlayers}
        bustout={bustout}
        rebuy={rebuy}
        addOn={addOn}
        tournament={t}
      />

      <AdminTournamentTable
        snapshot={snapshot}
        updateTournament={updateTournament}
      />
    </main>
  );
}
