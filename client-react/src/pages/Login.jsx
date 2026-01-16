const SERVER = import.meta.env.VITE_SERVER_URL;

export default function Login() {
  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Pokerklokke</h1>
      <button onClick={() => (window.location.href = `${SERVER}/auth/google`)}>
        Logg inn med Google
      </button>
    </div>
  );
}
