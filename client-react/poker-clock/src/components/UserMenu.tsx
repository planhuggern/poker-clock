import { useCurrentPlayer } from "@shared/auth/useCurrentPlayer.js";

export default function UserMenu() {
  const player = useCurrentPlayer();
  const displayName = player?.display_name ?? "Gjest";

  return (
    <div className="user-menu">
      <div className="user-menu-trigger" title="Min profil">
        <span className="user-menu-avatar">{displayName[0]?.toUpperCase()}</span>
        <span className="overflow-hidden text-ellipsis flex-1">{displayName}</span>
      </div>
    </div>
  );
}
