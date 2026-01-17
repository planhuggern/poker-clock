import Database from "better-sqlite3";
import path from "path";

let db;
let saveTimer = null;

export function initDb(dbPath = path.resolve(process.cwd(), "poker-clock.db")) {
  db = new Database(dbPath);

  // Litt tryggere settings
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  return db;
}

export function loadStateFromDb(fallbackState) {
  if (!db) throw new Error("DB not initialized. Call initDb() first.");

  const row = db.prepare("SELECT json FROM app_state WHERE id = 1").get();
  if (!row) return fallbackState;

  try {
    const parsed = JSON.parse(row.json);
    // minimal sanity
    if (!parsed || !parsed.tournament || !Array.isArray(parsed.tournament.levels)) return fallbackState;
    return parsed;
  } catch (e) {
    console.error("Failed to parse state JSON from DB:", e);
    return fallbackState;
  }
}

export function saveStateToDb(state) {
  if (!db) throw new Error("DB not initialized. Call initDb() first.");

  const stmt = db.prepare(`
    INSERT INTO app_state (id, json, updated_at)
    VALUES (1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      json = excluded.json,
      updated_at = excluded.updated_at
  `);

  stmt.run(JSON.stringify(state), Date.now());
}

// Debounce for å unngå å skrive hvert sekund unødvendig mye
export function scheduleSave(state, ms = 250) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      saveStateToDb(state);
    } catch (e) {
      console.error("Failed to save state to DB:", e);
    }
  }, ms);
}

import fs from "fs";

// Sjekk om DB allerede har state
export function hasStateInDb() {
  if (!db) throw new Error("DB not initialized");
  const row = db.prepare("SELECT 1 FROM app_state WHERE id = 1").get();
  return !!row;
}