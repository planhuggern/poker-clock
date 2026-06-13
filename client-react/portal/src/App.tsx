const basePath = (import.meta.env.VITE_BASE_PATH as string | undefined)?.replace(/^\/|\/$/g, '') ?? '';

const apps = [
  {
    href: basePath ? `/${basePath}/` : (import.meta.env.VITE_CLOCK_URL as string | undefined) ?? '/poker-clock/',
    icon: '🃏',
    name: 'Poker Clock',
    desc: 'Turneringsklokke med blindsstruktur og spillerstyring',
  },
  {
    href: (import.meta.env.VITE_OSLO_URL as string | undefined) ?? '/oslo-conquest/',
    icon: '🗺️',
    name: 'Oslo Conquest',
    desc: 'Flerspiller strategispill på kartet over Oslo',
  },
  {
    href: (import.meta.env.VITE_TRADING_URL as string | undefined) ?? '/trading/',
    icon: '📈',
    name: 'Trading',
    desc: 'Historisk og live kursdata med interaktive dashboards',
  },
];

export function App() {
  return (
    <>
      <h1>Holtebu Apps</h1>
      <div className="apps">
        {apps.map((app) => (
          <a key={app.name} className="app-card" href={app.href}>
            <div className="app-icon">{app.icon}</div>
            <div className="app-name">{app.name}</div>
            <div className="app-desc">{app.desc}</div>
          </a>
        ))}
      </div>
    </>
  );
}
