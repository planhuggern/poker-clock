import fs from "fs";
import path from "path";

const STATE_FILE = path.resolve(process.cwd(), "state.json");

export function loadStateFromDisk(fallbackState) {
  try {
    if (!fs.existsSync(STATE_FILE)) return fallbackState;
    const raw = fs.readFileSync(STATE_FILE, "utf-8");
    const parsed = JSON.parse(raw);

    // Minimal sanity check
    if (!parsed || !parsed.tournament || !Array.isArray(parsed.tournament.levels)) {
      return fallbackState;
    }
    return parsed;
  } catch (e) {
    console.error("Failed to load state.json:", e);
    return fallbackState;
  }
}

// Debounced save for å unngå spam
let saveTimer = null;

export function scheduleSave(state) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
    } catch (e) {
      console.error("Failed to write state.json:", e);
    }
  }, 250);
}
