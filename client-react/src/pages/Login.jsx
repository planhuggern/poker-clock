const SERVER = import.meta.env.VITE_SERVER_URL;


export default function Login() {
  return (
    <main className="main-content">
      <h1>Pokerklokke</h1>
      <button onClick={() => (window.location.href = `${SERVER}/auth/google`)}>
        Logg inn med Google
      </button>
    </main>
  );
}
