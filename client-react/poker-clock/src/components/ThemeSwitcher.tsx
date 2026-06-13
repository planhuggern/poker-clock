import { useState } from "react";

const THEMES = [
  { value: "night",     label: "🌙 Night" },
  { value: "dim",       label: "🌫 Dim" },
  { value: "luxury",    label: "👑 Luxury" },
  { value: "synthwave", label: "🌆 Synthwave" },
  { value: "cyberpunk", label: "⚡ Cyberpunk" },
];

function getStoredTheme(): string {
  return localStorage.getItem("poker_theme") || "night";
}

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState(getStoredTheme);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const t = e.target.value;
    setTheme(t);
    localStorage.setItem("poker_theme", t);
    document.documentElement.setAttribute("data-theme", t);
  }

  return (
    <select
      className="select select-sm"
      value={theme}
      onChange={handleChange}
      title="Velg tema"
      aria-label="Velg fargetema"
    >
      {THEMES.map(t => (
        <option key={t.value} value={t.value}>{t.label}</option>
      ))}
    </select>
  );
}
