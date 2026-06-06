const SERVER_ORIGIN = import.meta.env.VITE_SERVER_URL
  || globalThis.location?.origin
  || "http://localhost:3000";

const BASE_URL = import.meta.env.BASE_URL || "/";
const basePath = BASE_URL === "/" ? "" : BASE_URL.replace(/\/$/, "");


export default function Login() {
  function handleTestLogin(role = "viewer") {
    localStorage.setItem("poker_token", "test-token");
    localStorage.setItem("poker_role", role);
    window.location.href = "/";
  }

  return (
    <main className="main-content">
      <h1>Pokerklokke</h1>
      <button disabled={import.meta.env.DEV} onClick={() => (window.location.href = `${SERVER_ORIGIN}${basePath}/auth/google`)}>
        Logg inn med Google
      </button>
      {/* Testbruker-knapp kun i utviklingsmodus */}
      {!import.meta.env.PROD && (
        <div style={{ marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={() => handleTestLogin("viewer")}>Logg inn som testbruker</button>
          <button className="btn btn-accent" style={{ marginLeft: 8 }} onClick={() => handleTestLogin("admin")}>Logg inn som admin</button>
        </div>
      )}
    </main>
  );
}
