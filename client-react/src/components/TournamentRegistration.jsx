import { useState } from "react";

export default function TournamentRegistration({
  isRegistered,
  profile,
  tournamentId,
  register,
}) {
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState("");

  if (isRegistered) {
    return (
      <div className="flex items-center gap-2 my-3">
        <span className="text-sm text-success font-semibold">✅ Du er påmeldt denne turneringen</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 my-3">
      <button
        className="btn btn-success btn-sm"
        disabled={registering || profile?.activeTournamentId != null}
        title={profile?.activeTournamentId != null ? "Du er allerede påmeldt en annen turnering" : ""}
        onClick={async () => {
          setRegistering(true);
          setRegisterError("");
          try {
            await register(tournamentId);
          } catch (e) {
            setRegisterError(e.message);
          } finally {
            setRegistering(false);
          }
        }}
      >
        {registering
          ? "Melder på…"
          : profile?.activeTournamentId != null
            ? "Opptatt i annen turnering"
            : "＋ Meld meg på turneringen"}
      </button>
      {registerError && <span className="text-error text-sm ml-2">{registerError}</span>}
    </div>
  );
}
