# Oslo Conquest – Prosjektkontekst

## Hva er dette?
Et turbasert strategispill inspirert av Risk + Monopol, satt til Oslo. Spilles i nettleseren. Multiplayer via WebSocket mot en Django Channels-backend. Kjøres som en egen SPA innenfor poker-clock-portalen.

## Tech stack
- **Frontend:** Preact + SVG.js, JSX, CSS — bygget med Vite som eget entry point
- **Kart:** SVG.js med polygon-data fra `map.json` (tegnet i `map-editor.html`)
- **Multiplayer:** WebSocket mot Django Channels (`ws://server/ws/oslo-conquest/`)
- **Backend state:** In-memory dict `_rooms` på serveren — ingen DB-persistens
- **Auth:** Ingen — spillere identifiserer seg med generert `p_<random>`-ID

## Filstruktur

### Frontend (`client-react/oslo-conquest/`)
| Fil | Ansvar |
|---|---|
| `index.html` | Entry point |
| `main.js` | Bootstrap, eksponerer globale funksjoner |
| `state.js` | Globalt mutable objekt: `gameState`, `myPlayerId`, `selectedTerritory`, `svgEl`, `mapTransform` |
| `game-data.js` | Konstanter: 16 bydeler, 35 territorier (pris, inntekt, nøytrale enheter), 11 oppdrag, 6 spillerfarger, adjacency-graf, checkpoints |
| `game-state.js` | Spillinitialisering (shuffle oppdrag, sett opp territorier), tur-/spillerqueries |
| `actions.js` | Alle spillmutasjoner: `rollDice`, `buyTerritory`, `invadeTerritory`, `reinforceTerritory`, `payRent`, `moveToTerritory`, `endTurn` |
| `missions.js` | Seiersvilkår — kalles etter hver handling |
| `map.js` | SVG-render, pan/zoom/drag, territorievalg, visuell oppdatering |
| `map.json` | Forhåndsberegnet polygon-data for territorier og bydelsgrenser |
| `ui.js` | HUD: spillerbrikker, handlingspanel (kontekstsensitivt), checkpoint-bar, hendelseslogg |
| `dice.js` | Kamptærning-modal |
| `modals.js` | Leie-modal, seiersskjerm-modal |
| `websocket.js` | WebSocket tilkobling/frakobling, lobby (opprett/bli med/lokal), send/motta state |
| `style.css` | Mørkt tema (`#0d0d0f` bakgrunn, `#c9a84c` gull-aksenter), Cinzel Decorative + Crimson Pro |
| `map-editor.html` | Dev-verktøy for å tegne territoriepolygoner |

### Backend (`server/oslo_conquest/`)
| Fil | Ansvar |
|---|---|
| `consumers.py` | `OsloConquestConsumer` — WebSocket-handler, in-memory `_rooms`-dict |
| `routing.py` | WebSocket URL: `ws/oslo-conquest/` |
| `urls.py` | HTTP-URLer (tom foreløpig) |

## Spillregler
- **2–6 spillere**, alle starter med 2000 kr og 10 bataljoner ved Lørenskog
- **35 territorier** fordelt på Oslos 16 bydeler
- **Kjøp:** Betal bankpris for nøytralt territorium — du eier det
- **Invasjon:** Risk-regler med terningkast. Dyrere områder har 2–4 nøytrale bataljoner
- **Bevegelse:** Kast terning (1–6), flytt øye-antall steg
- **Leie:** Lander du på andres område betaler du 15 % av territorieprisen, eller angriper i stedet
- **Bydelsbonus:** Eier du alle områder i en bydel får du inntektsbonus
- **Checkpoints:** Lørenskog → Lysaker → Kolbotn. Passerer du ett får du +500 kr og +3 bat.

## Turrekkefølge
1. Kast terning (1–6) — setter bevegelsesbudsjett
2. Flytt opp til det antall steg; på hvert territorium: kjøp nøytralt, forsterk eget, invader eller betal leie
3. Samle inntekt fra fullstendige bydeler
4. Samle checkpoint-bonus ved Lørenskog / Lysaker / Kolbotn
5. Avslutt tur → neste spiller som ikke er eliminert

## Kamp (Risk-regler)
- Angriper kaster inntil 3 terninger, forsvarer inntil 2
- Sammenlign høyeste kast parvis — uavgjort går til forsvarer
- Taper fjerner bataljoner; territoriet skifter eier når forsvarer når 0

## Oppdragskort (11 stk, trekkes tilfeldig ved start)
1. 🗺️ Vestkanten – eie alle områder i Frogner, Ullern og Vestre Aker
2. 🏙️ Østkanten – eie alle områder i Alna, Østensjø og Nordstrand
3. 🌲 Nordmarka-porten – eie alle i Nordre Aker og Vestre Aker
4. 🔴 Sentrumsherren – eie alle i Gamle Oslo, Grünerløkka og St. Hanshaugen
5. 🏘️ Storby – eie totalt 20 enkeltområder
6. ⚔️ Conquistador – minst ett område i alle 16 bydeler
7. 💰 Kapitalist – 5000 kr og minst 10 områder samtidig
8. 🗡️ Blodhevn *(skjult)* – slå ut en tilfeldig utpekt motspiller
9. 🛣️ Ringveien – minst ett område i hver bydel langs ruten Lørenskog → Kolbotn
10. 🎯 Festning – komplett bydel med minst 10 bataljoner
11. 🪓 Barbaren – vinn minst 2 områder fra HVER motspiller i kamp

Oppdrag 8 (Blodhevn) er skjult — målet vises ikke før det er fullført.

## Seier
- Fullfør oppdraget ditt → umiddelbar seier
- Siste spiller igjen vinner automatisk

## Datastrukturer

### TERRITORIES (35 stk)
```js
{ id: 't1', name: 'Grønland', district: 'gamle-oslo', price: 300, neutralUnits: 2, x: 0.54, y: 0.62 }
```

### DISTRICTS (16 stk)
```js
'gamle-oslo': { name: 'Gamle Oslo', bonus: { money: 300, units: 2 }, color: '#2d1f3d' }
```

### ADJACENCY
```js
{ 't1': ['t2','t3','t4','t5','t9'], ... }
```

### Game state
```js
{
  phase: 'playing', round: 1, currentPlayerIdx: 0,
  players: [{ id, name, color, money, units, mission, target, position,
               checkpoints: {lørenskog, lysaker, kolbotn}, diceRoll, diceUsed,
               eliminated, conquests: {[playerId]: count} }],
  territories: { [id]: { id, owner, units } },
  log: [{ msg, type, time }]
}
```

## Django Channels – WebSocket API
Klienten sender:
```json
{ "type": "create_game", "room": "oslo-1", "player": { "id": "p1", "name": "Ola" } }
{ "type": "join_game",   "room": "oslo-1", "player": { "id": "p2", "name": "Kari" } }
{ "type": "game_action", "state": { ...full gameState... } }
```
Serveren broadcaster til alle i rommet:
```json
{ "type": "game_state", "state": { ...full gameState... } }
```

State eies av den handlende klienten og broadcastes i sin helhet — ingen server-side validering av trekk.

## Designvalg
- **Ingen server-side validering.** Handlende klient muterer state lokalt, broadcaster det. Alle klienter (inkludert avsender) oppdaterer fra broadcasten.
- **Ingen DB-persistens.** Restarter serveren → alle spill mistes.
- **Lokal spillemodus.** Man kan starte et spill uten WebSocket-tilkobling — state håndteres utelukkende klientsiden.
