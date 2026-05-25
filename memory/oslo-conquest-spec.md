# Oslo Conquest – Spec

## Hva er dette?
Et turbasert strategispill inspirert av Risk + Monopol, satt til Oslo. Spilles i nettleseren. Multiplayer via WebSocket mot en Django Channels-backend. Kjøres som en egen SPA innenfor poker-clock-portalen.

## Spillregler
- **2–6 spillere**, alle starter med 2000 kr og 10 bataljoner ved Lørenskog
- **35 territorier** fordelt på Oslos 16 bydeler
- **Kjøp:** Betal bankpris for nøytralt territorium — du eier det
- **Invasjon:** Risk-regler med terningkast. Dyrere områder har 2–4 nøytrale bataljoner
- **Bevegelse:** Kast terning (1–6), flytt øye-antall steg
- **Leie:** Lander du på andres område betaler du 15 % av territorieprisen, eller angriper i stedet
- **Bydelsbonus:** Eier du alle områder i en bydel får du inntektsbonus
- **Checkpoints:** Lørenskog → Lysaker → Kolbotn. Passerer du ett får du +500 kr og +3 bat.

## MVP-regler
MVP-en bruker det eksisterende kartet som spillbrett, men kutter økonomi, terningbevegelse, oppdragskort, leie, bydelsbonus og checkpoints fra første spillbare versjon.

### MVP-scope
- **2 spillere** per rom.
- Spillere får faste sider/farger, for eksempel `red` og `blue`.
- Alle spillbare områder fra eksisterende kart brukes som territorier.
- Hvert territorium må ha `id`, `name`, `neighbors`, `owner` og `units`.
- Territorier kan eies av `red`, `blue` eller være nøytrale.
- Ingen flytting mellom egne territorier i første MVP.
- Ingen lokal-only regelavvik: samme regler skal gjelde for WebSocket-spill og eventuell lokal spillmodus.

### MVP-startoppsett
- Hver spiller får ett startterritorium.
- Startterritoriene kan hardkodes fra kartet eller velges automatisk som to territorier med rimelig avstand.
- Startterritorier starter med `3` units.
- Alle andre territorier starter nøytrale med `1` unit.
- `red` starter første tur.

### MVP-tur
Spillet er turbasert, og bare aktiv spiller kan utføre handlinger.

1. Aktiv spiller får forsterkninger.
2. Aktiv spiller plasserer alle forsterkninger på ett eid territorium.
3. Aktiv spiller kan gjøre maks ett angrep.
4. Aktiv spiller avslutter turen.

Forsterkninger beregnes slik:

```txt
reinforcements = max(1, floor(ownedTerritories / 3))
```

### MVP-angrep
- Angriper må eie `from`.
- `to` må være nabo av `from`.
- `to` må ikke eies av angriper.
- `from.units` må være minst `2`.
- Nøytrale territorier forsvarer seg med sine `units`, men tar aldri egne turer.

Kamp avgjøres deterministisk:

```txt
if from.units > to.units:
    attacker wins
else:
    attacker loses
```

Ved seier:

```txt
from.units -= 1
to.owner = attacker
to.units = 1
```

Ved tap:

```txt
from.units -= 1
```

### MVP-seier
- Hvis kartet har 12 eller færre territorier: spilleren vinner når motstanderen eier `0` territorier.
- Hvis kartet har mer enn 12 territorier: spilleren vinner når de eier minst `60%` av territoriene.

### MVP-WebSocket-handlinger
Klienten må minimum kunne sende:

```txt
join_room
place_reinforcements(territory_id, amount)
attack(from_id, to_id)
end_turn
```

Server/klient-state må minimum kunne uttrykke:

```js
{
  roomId: 'oslo-1',
  phase: 'reinforce',
  activePlayer: 'red',
  winner: null,
  players: {
    red: { name: 'Player 1' },
    blue: { name: 'Player 2' }
  },
  territories: {
    sentrum: { owner: 'red', units: 3 }
  },
  reinforcementsRemaining: 2
}
```

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

## WebSocket API
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

## Designvalg
- **Ingen server-side validering.** Handlende klient muterer state lokalt, broadcaster det. Alle klienter (inkludert avsender) oppdaterer fra broadcasten.
- **Ingen DB-persistens.** Restarter serveren → alle spill mistes.
- **Lokal spillemodus.** Man kan starte et spill uten WebSocket-tilkobling — state håndteres utelukkende klientsiden.
