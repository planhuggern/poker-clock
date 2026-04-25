# Oslo Conquest – Prosjektkontekst

## Hva er dette?
Et turbasert strategispill inspirert av Risk + Monopol, satt til Oslo. Spilles i nettleseren som én HTML-fil. Multiplayer via WebSocket mot en Django Channels-backend.

## Tech stack
- **Frontend:** Vanilla JS + SVG-kart (Phaser ble droppet – ikke nødvendig for turbasert)
- **Kart:** SVG tegnet i kode, skal erstattes med manuelt tegnet kart
- **Multiplayer:** WebSocket mot Django Channels (`ws://server/ws/oslo-conquest/`)
- **Filen:** `oslo-conquest.html` – én selvstending fil

## Spillregler
- **2–6 spillere**, alle starter med 2000 kr og 10 bataljoner
- **35 territorier** fordelt på Oslos 15 offisielle bydeler
- **Kjøp:** Betal bankpris, plasser minst 1 bataljon – du eier området
- **Invasjon:** Risk-regler med terningkast. Dyrere områder har 2–4 nøytrale bataljoner
- **Bevegelse:** Kast terning, flytt øye-antall steg valgfritt
- **Leie:** Lander du på andres område betaler du leie, eller angriper i stedet
- **Bydelsbonus:** Eier du alle områder i en bydel får du penge- og bataljonbonus
- **Checkpoints:** Ruten går Lørenskog → (valgfri vei) → Lysaker → (valgfri vei) → Kolbotn → tilbake. Fullfører du runden får du +500 kr og +3 bat.

## Oppdragskort (11 stk, trekkes tilfeldig ved start)
1. 🗺️ Vestkanten – eie alle områder i Frogner, Ullern og Vestre Aker
2. 🏙️ Østkanten – eie alle områder i Alna, Østensjø og Nordstrand
3. 🌲 Nordmarka-porten – eie alle i Nordre Aker og Vestre Aker
4. 🔴 Sentrumsherren – eie alle i Gamle Oslo, Grünerløkka og St. Hanshaugen
5. 🏘️ Storby – eie totalt 20 enkeltområder
6. ⚔️ Conquistador – minst ett område i alle 15 bydeler
7. 💰 Kapitalist – 5000 kr og minst 10 områder samtidig
8. 🗡️ Blodhevn – slå ut en tilfeldig utpekt motspiller (skjult mål)
9. 🛣️ Ringveien – minst ett område i hver bydel langs østsiden
10. 🎯 Festning – komplett bydel med minst 10 bataljoner
11. 🪓 Barbaren – vinn minst 2 områder fra HVER motspiller i kamp

## Seier
- Fullfør oppdraget ditt → umiddelbar seier
- Blodhevn: vinner selv om du ikke er rikest
- Barbaren: vinner umiddelbart
- Siste spiller igjen vinner automatisk
- Hvis spiller slås ut og ingen har fullført oppdrag → rikeste spiller vinner

## Kart – status og problem
SVG-kartet er laget i kode men ser ikke bra ut og hadde bugs (container fikk ikke høyde).
**Neste steg:** Lag et tegneverktøy der bruker kan:
1. Laste inn et Oslo-kartbilde som bakgrunn
2. Klikke for å plassere de 35 territoriene
3. Klikke punkt for punkt for å tegne 15 bydelspolygoner
4. Eksportere alt som JSON
Så injiseres JSON-koordinatene inn i spillet.

## Datastrukturer

### TERRITORIES (35 stk)
```js
{ id: 't1', name: 'Grønland', district: 'gamle-oslo', price: 300, neutralUnits: 2, x: 0.54, y: 0.62 }
```

### DISTRICTS (15 stk)
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
{ "type": "join_game", "room": "oslo-1", "player": { "id": "p2", "name": "Kari" } }
{ "type": "game_action", "state": { ...full gameState... } }
```
Serveren sender:
```json
{ "type": "game_state", "state": { ...full gameState... } }
{ "type": "action_result", "state": { ... }, "dice": { ... } }
```

## Kjente bugs / TODO
- [ ] Kartvisning buggy – trenger manuelt tegnet kart
- [ ] Bevegelseslogikk (terningkast + trekk-til-territorium) er delvis implementert
- [ ] Django Channels consumer er ikke laget ennå
- [ ] Spiller 2 og 3 har ingen AI – må spilles manuelt lokalt eller via WebSocket
- [ ] Checkpoint-logikk for Lysaker og Kolbotn må kobles til faktiske kartposisjoner
