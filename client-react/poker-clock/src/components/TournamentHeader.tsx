import { Link } from "react-router-dom";
import UserMenu from "./UserMenu";
import ThemeSwitcher from "./ThemeSwitcher";

interface TournamentHeaderProps {
  title: string | undefined;
  status: string;
  tournamentId: number;
}

export default function TournamentHeader({ title, status, tournamentId }: TournamentHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
      <h1 className="m-0">{title ?? "Pokerklokke"}</h1>
      <div className="flex items-center gap-3 flex-wrap">
        <span className={`clock-dot ${status === "connected" ? "running" : "paused"}`} />
        <Link to={`/tournament/${tournamentId}/tv`} className="btn btn-secondary btn-sm">📺 TV</Link>
        <Link to="/" className="btn btn-ghost btn-sm">⬅ Turneringer</Link>
        <UserMenu />
        <ThemeSwitcher />
      </div>
    </div>
  );
}
