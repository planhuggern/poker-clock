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
MVP-en bruker det eksisterende kartet som spillbrett, men følger en forenklet monopol-lignende runde med mobil hær. Full økonomi, leie, bydelsbonus, checkpoints og oppdragskort kan fortsatt komme senere.

### MVP-scope
- **2 spillere** per rom.
- Spillere får faste sider/farger, for eksempel `red` og `blue`.
- Alle spillbare områder fra eksisterende kart brukes som territorier.
- Hvert territorium må ha `id`, `name`, `neighbors`, `owner` og `units`.
- Territorier kan eies av `red`, `blue` eller være nøytrale.
- Hver spiller har en **mobil hær** som følger spillerbrikken.
- Hver spiller kan flytte opptil terningkastets rekkevidde, men kan stoppe tidligere.
- Territorier innen rekkevidde skal kunne markeres som gyldige trekkvalg i klienten.
- Når en spiller lander på eget territorium, kan hen både sette av og plukke opp overskytende bataljoner.
- Det må alltid stå igjen minst `1` bataljon på et eid territorium.
- Ingen lokal-only regelavvik: samme regler skal gjelde for WebSocket-spill og eventuell lokal spillmodus.

### MVP-startoppsett
- Hver spiller får ett startterritorium.
- Startterritoriene kan hardkodes fra kartet eller velges automatisk som to territorier med rimelig avstand.
- Startterritorier starter med `3` units.
- Alle andre territorier starter nøytrale med `1` unit.
- Hver spiller starter med en mobil hær knyttet til sin spillerbrikke.
- Spillerbrikken starter på spillerens startterritorium.
- `red` starter første tur.

### MVP-tur
Spillet er turbasert, og bare aktiv spiller kan utføre handlinger.

1. Aktiv spiller kaster terning (`1`–`6`) og får et bevegelsesbudsjett.
2. Aktiv spiller flytter spillerbrikken og den mobile hæren til et territorium innen rekkevidde.
3. På destinasjonen kan spilleren, avhengig av hvem som eier territoriet:
   - kjøpe nøytralt territorium,
   - angripe nøytralt eller fiendtlig territorium,
   - forsterke eget territorium,
   - plukke opp overskytende bataljoner fra eget territorium.
4. Aktiv spiller kan stoppe før hele rekkevidden er brukt opp dersom reglene tillater det.
5. Aktiv spiller avslutter turen.

### MVP-mobil hær
- Hver spiller har en separat **mobil styrke** som følger spillerbrikken.
- Garnisoner på territorier og mobil hær er to forskjellige beholdninger.
- Når spilleren lander på eget territorium med mer enn `1` bataljon der, kan hen flytte et valgfritt antall av de overskytende bataljonene inn i den mobile hæren.
- Når spilleren lander på eget territorium, kan hen også sette av et valgfritt antall bataljoner fra den mobile hæren til territoriet.
- Et eid territorium kan aldri reduseres til `0` bataljoner; minst `1` må bli stående igjen.
- Når et territorium kjøpes eller erobres, må minst `1` bataljon bli stående igjen der. Spilleren velger selv hvor mange flere som eventuelt settes igjen.
- Den mobile hæren følger videre med spillerbrikken med mindre bataljoner eksplisitt blir stående igjen som garnison.

### MVP-angrep
- Angrep skjer mot territoriet spilleren **lander på**.
- Angrepsstyrken består av den mobile hæren spilleren har med seg.
- Nøytrale territorier forsvarer seg med sine `units`, men tar aldri egne turer.
- Dersom spilleren eier tilstøtende territorier, kan disse brukes til **mass attack**.
- Ved mass attack flyttes de deltagende støttebataljonene fysisk inn i det erobrede territoriet ved seier.
- Dersom spilleren avbryter kampen uten å vinne territoriet, returnerer støttebataljonene til territoriene de kom fra.

Kamp avgjøres deterministisk:

```txt
attackPower = mobileArmy + supportUnits
defensePower = to.units

if attackPower > defensePower:
  attacker wins
else:
  attacker loses
```

Deterministisk tapsmodell (MVP):

```txt
losses = min(attackPower, defensePower)
```

Fordeling av tap på angripersiden:

```txt
1) mobileArmy tar tap først
2) hvis mobileArmy går til 0 og det fortsatt gjenstår tap,
   trekkes resten fra supportUnits
```

Ved seier:

```txt
to.owner = attacker
to.units = 1
remainingAttackers = attackPower - losses

player chooses garrisonExtra >= 0
to.units = 1 + garrisonExtra

remainingAttackers is split into:
- mobileArmyAfterCombat (follows player piece)
- supportUnitsMovedIn (came from adjacent owned territories)
```

Mass attack ved seier:

```txt
support units that joined the attack move physically into the conquered territory,
unless consumed by combat losses
```

Mass attack uten erobring (spiller avbryter):

```txt
surviving support units return to their source territories
```

Ved tap:

```txt
territory owner does not change
defender units stay unchanged in MVP deterministic model
attacker side loses `losses` units using the loss allocation order above
```

### MVP-seier
- Hvis kartet har 12 eller færre territorier: spilleren vinner når motstanderen eier `0` territorier.
- Hvis kartet har mer enn 12 territorier: spilleren vinner når de eier minst `60%` av territoriene.

### MVP-WebSocket-handlinger
Klienten må minimum kunne sende:

```txt
join_room
roll_dice
move(to_id)
pickup_units(territory_id, amount)
drop_units(territory_id, amount)
buy_territory(territory_id, amount_to_leave)
attack(to_id, support={territory_id: amount})
end_turn
```

Server/klient-state må minimum kunne uttrykke:

```js
{
  roomId: 'oslo-1',
  phase: 'playing',
  activePlayer: 'red',
  winner: null,
  players: {
    red: {
      name: 'Player 1',
      position: 't0a',
      mobileUnits: 3,
      diceRoll: null,
      movesRemaining: 0
    },
    blue: {
      name: 'Player 2',
      position: 't35',
      mobileUnits: 3,
      diceRoll: null,
      movesRemaining: 0
    }
  },
  territories: {
    sentrum: { owner: 'red', units: 3 }
  }
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
  players: [{ id, name, color, side, position, mobileUnits,
               diceRoll, movesRemaining, eliminated }],
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
- **Server-autoritativ MVP-state.** Flytting, kjøp, pickup/drop og angrep skal valideres og avgjøres på serveren.
- **Ingen DB-persistens.** Restarter serveren → alle spill mistes.
- **Lokal spillemodus.** Lokal modus bør bruke samme regler som multiplayer så langt det er praktisk.
