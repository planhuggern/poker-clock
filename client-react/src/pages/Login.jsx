const SERVER_ORIGIN = import.meta.env.VITE_SERVER_URL
  || globalThis.location?.origin
  || "http://localhost:3000";

const BASE_URL = import.meta.env.BASE_URL || "/";
const basePath = BASE_URL === "/" ? "" : BASE_URL.replace(/\/$/, "");


export default function Login() {
  return (
    <main className="main-content">
      <h1>Pokerklokke</h1>
      <button onClick={() => (window.location.href = `${SERVER_ORIGIN}${basePath}/auth/google`)}>
        Logg inn med Google
      </button>
    </main>
  );
}
