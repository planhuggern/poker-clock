# Go-læringsplan / omskrivingsplan

Formål: Espen lærer Go ved å gradvis omskrive deler av Django-backenden
(`server/`) til Go. Startet med poker-clock (`holtebu-server`), utvides nå
til også å omfatte oslo-conquest. Denne filen er logg + plan slik at vi kan
plukke opp der vi slapp mellom sesjoner. Oppdater den når vi fullfører et
steg eller endrer retning — ikke la den bli stale.

Prinsipp: vertikale skiver. Hvert steg skal ende med noe som kjører og kan
testes, ikke halvferdig kode (jf. `AGENTS.md`).

## Viktig: denne roadmapen bruker ikke feature-workflowen

Arbeid som følger denne filen skal **ikke** kjøres gjennom
`.ai/workflows/feature.workflow.md` som streng state machine. Roadmapen er
selv arbeidsflyten for Go-læringen.

Konsekvens:
- Ikke start "Steg 1 - Analytikeravklaring" fra feature-workflowen når vi sier
  at vi skal fortsette på denne roadmapen.
- Ikke stopp ved feature-workflowens godkjenningsporter med mindre Espen
  eksplisitt ber om det.
- Følg i stedet rekkefølgen og samarbeidsformen i denne filen: Espen skriver
  koden, assistenten forklarer, peker på relevante filer, reviewer og kjører
  verktøy/tester.
- Vanlige prosjektregler gjelder fortsatt: små steg, tester der det gir mening,
  ingen scope creep, og oppdater roadmapen når et steg fullføres eller endres.

## Samarbeidsform

**Espen skriver koden. Claude guider, forklarer og reviewer — skriver ikke
implementasjonen selv**, med mindre Espen eksplisitt ber om det (f.eks.
"vis meg et forslag" eller "skriv denne delen for meg"). Poenget er å lære
Go, ikke å få en Go-backend generert. Rollen til Claude i denne planen:

- forklar konsepter (idiomer, stdlib-pakker, feilmønstre) før/underveis
- foreslå tilnærming/struktur i ord, ikke i ferdig kode
- pek på relevante deler av eksisterende kode å se på
- review kode Espen har skrevet — påpek bugs, uidiomatiske mønstre, forslag
  til forbedring — men la Espen gjøre selve endringen
- kjør `go build`/`go test`/`go vet` og rapporter resultat, det er verktøybruk,
  ikke koding

## Status i dag

`server/go/` inneholder:
- `cmd/holtebu-server/main.go` — HTTP-routing (`net/http`),
  `/pokerklokke`-prefix-stripping og wiring av packages
- `config/config.go` — leser `../config.json`
- `db/db.go` — SQLite-tilkobling (`modernc.org/sqlite`)
- `auth/auth.go` — JWT-parsing (`golang-jwt/jwt/v5`) + auth-middleware
  (**for øyeblikket ikke koblet inn noe sted, bevisst utsatt** — se steg 6)
- `pokerclock/tournaments.go` — `GET/POST /api/tournaments`,
  `GET /api/tournaments/{id}`

Go-tester finnes for eksisterende poker-clock-handlers og main-routing
(`go test ./...` passerer).

Tilsvarende Django-endepunkter (`server/clock/urls.py`) som **ikke** er
portet ennå:
- `clock/api/me/`, `clock/api/me/register/` (`MeView`, `RegisterView`)
- `clock/api/players/` (`PlayerListView`)
- `clock/api/tournaments/<pk>/finish/` (`TournamentFinishView`)
- Guest-auth/refresh (`players.urls`) — blir sannsynligvis værende i Django
  (OAuth-tung), men vurderes senere.

## Plan (i rekkefølge)

Hvert steg = én sesjon/økt. Vi krysser av og skriver kort notat når et steg
er ferdig, i stedet for å slette det.

- [x] **1. Tester for det som finnes** — ferdig 2026-07-24. `TestGetTournamentByID`
      skrevet om til table-driven av Espen selv (brukte `strconv.FormatInt`,
      lot db/handler være felles utenfor løkka siden alle cases bare leser).
      `TestListTournaments`, `TestCreateTournament`, `TestMethodDispatch` er
      fortsatt Claudes opprinnelige (feilaktig selvskrevne) utkast — Espen
      valgte bevisst å beholde dem som de er, ikke skrive dem om. Alt
      kompilerer og passerer (`go test ./...`).
- [x] **2. Restrukturer til package + `cmd/`-mønster** — ferdig 2026-07-24.
      Go-koden er delt i packages (`auth`, `config`, `db`, `pokerclock`) og
      kjørbar server ligger i `cmd/holtebu-server`. Build-kommandoer i
      `bootstrap.sh` og GitHub Actions peker på `./cmd/holtebu-server`.
      Verifisert av Espen med `go test ./...` og
      `go build -o holtebu-server ./cmd/holtebu-server`.

### Poker-clock-steg — PÅ VENT (lavere prioritet enn oslo-conquest)

Espen har omprioritert til å jobbe på oslo-conquest-rewriten først. Disse
stegene er ikke droppet, bare satt på pause — plukk dem opp igjen når
oslo-conquest er kommet videre.

- [ ] `GET /api/players` — port av `PlayerListView`. Lærer: enda et
      handler-mønster, gjenbruk av `db.Query`-mønsteret fra `listTournaments`.
- [ ] `PATCH /api/tournaments/{id}/finish` — port av `TournamentFinishView`.
      Lærer: håndtere en ny HTTP-metode i `methodDispatch`, partial updates
      mot SQLite.
- [ ] Strukturert feilhåndtering — rydd opp i repeterende `http.Error(...)`-
      mønstre på tvers av handlers (vurder en liten hjelpefunksjon/felles
      feil-type). Gjør dette *etter* at nok handlers finnes til at mønsteret
      er tydelig, ikke før.
- [ ] (Stretch) WebSocket i Go for poker-clock — vurder om deler av
      `clock/consumers.py` (tick-broadcast, per-tournament channel groups)
      kan porteres. Stort tema: goroutines, channels, concurrency-safe
      state. Overlapper trolig mye med det vi uansett må lære for
      oslo-conquest sin WS-consumer — vurder å gjøre oslo-conquest sin
      WS-del først og gjenbruke lærdommen her.
- [ ] Reintroduser auth (idiomatisk) — bevisst utsatt til sist (se notat
      2026-07-22: "droppe auth helt til slutt"). Koble `requireAuth`
      tilbake inn, nå som `createTournament` håndterer `claims == nil`
      gracefully. Vurder middleware-kjeding (logging + recover + auth).
      Lærer: HOF-middleware-mønsteret i Go, `context.Context` for
      request-scoped data.
- [ ] `GET /api/me` — port av `MeView`. Krever auth-steget over (trenger
      claims fra token for å vite hvem "me" er) — derfor sist.

## Struktur-beslutning: package + cmd/, ikke eget modul (2026-07-23)

Spørsmål som kom opp: bør oslo-conquest-Go-koden være et helt eget Go-modul
(egen `go.mod`, koblet sammen med `go.work`), eller en ny **package** i det
eksisterende `holtebu-server`-modulet?

**Kort fasit — package/module i Go:**
- *Package* = en mappe `.go`-filer som deler `package X`-linje, kompileres
  som én enhet, er det du `import`-erer. `server/go/` er i dag én eneste
  package (`main`) — alle filene (`main.go`, `auth.go`, `tournaments.go`,
  `db.go`, `config.go`) starter med `package main`.
- *Module* = én eller flere packages som deler samme `go.mod`/`go.sum`
  (samme avhengighetsversjoner). `server/go/go.mod` (`module holtebu-server`)
  er modulgrensen i dag.

**Valg: samme modul, ny package + `cmd/`-mønster.** Begrunnelse: begge
appene er små personlige prosjekter i samme repo, og packages er en mer
grunnleggende Go-ferdighet å øve på enn multi-modul-oppsett. Går til eget
modul + `go.work` senere hvis det oppstår en reell grunn (uavhengig
release-takt, kolliderende avhengigheter).

**Målstruktur** (bygges gradvis, ikke i ett steg):
```
server/go/
  go.mod                       (module holtebu-server, uendret)
  cmd/
    holtebu-server/main.go     (dagens main.go, trimmet til oppstart/wiring)
    oslo-conquest/main.go      (nytt, når det arbeidet starter)
  <navngitte packages>/        (f.eks. config, db, auth, tournaments —
                                 eksakt inndeling avklares når vi gjør det)
```

**Driftskonsekvens å huske på:** `bootstrap.sh` bygger i dag med
`go build -C server/go -o holtebu-server .` (bygger fra rotmappen, "."-
package). Når `main.go` flyttes til `cmd/holtebu-server/`, må denne
kommandoen oppdateres til å peke på `./cmd/holtebu-server` — ellers
feiler deploy. Ta dette eksplisitt når restruktureringen faktisk gjøres,
ikke bare i farten.

## Oslo Conquest → Go

Kilde å porte fra: `server/oslo_conquest/` (Django-app, WS-consumer via
Channels — se `oslo_conquest/consumers.py`, `oslo_conquest/routing.py`,
mounted på `/ws/oslo-conquest/`). Ingen DB-persistens i dag (`_rooms` i
minnet), jf. `memory/oslo-conquest-spec.md`.

Viktig retning 2026-07-25: Vi skal ikke lage "en ny MVP" og vi skal ikke
videreføre `mvp` som fil-/package-navn i Go-koden. Python-kilden heter
`server/oslo_conquest/mvp.py` av historiske grunner, men Go-porten skal
modelleres som selve Oslo Conquest-spillet.

Mål for første Go-versjon: portere dagens server-autoritære spillkontrakt uten
DB-persistens. Det betyr rom/lobby i minnet, to spillere per rom, bot-rom,
startcheckpoint/setup, terning, flytting, angrep, forfeit, rejoin og room-list.
Full økonomi, oppdragskort og DB-persistens er fortsatt utenfor første slice.

Navngivingsregel for ny Go-kode:
- Bruk `osloconquest` som package.
- Bruk filer som `board.go`, `types.go`, `game.go`, `rooms.go`, `turns.go`,
  `combat.go`, `bot.go`, `store.go` og `websocket.go` når de trengs.
- Ikke opprett `mvp.go`, `mvp_test.go`, `mvp/` eller andre nye `mvp`-navn.
- "Første slice" betyr bare liten leveranse, ikke at spillet skal bygges som en
  separat MVP ved siden av det ekte spillet.

Identitetsregel 2026-07-25:
- `side` skal utryddes i ny Go-kode. Ikke definer `Side`, `Red`, `Blue` eller
  `PlayerSide`.
- Spillere identifiseres med `PlayerID`.
- `activePlayer`, `winner` og territory `owner` skal være `PlayerID`/`null`,
  ikke `"red"`/`"blue"`.
- Farge/navn kan fortsatt være presentasjonsfelter på spiller (`color`,
  `colorName`), men de skal ikke brukes som spillidentitet.
- Dette er en bevisst kontraktsendring fra dagens Django-server. React-klienten
  må justeres når Go-serveren kobles inn.

### Oslo Conquest-steg

- [x] **3. Les og lås protokoll + state-kontrakt før koding** — ferdig
      2026-07-24, justert 2026-07-25. Kontrakt er dokumentert under
      "Oslo Conquest protokollkontrakt" nedenfor. Første Go-port skal følge
      dagens spillflyt, men med ny identitetskontrakt: `PlayerID` erstatter
      `side`.
- [ ] **4. Opprett `osloconquest` package med rene domenetyper** — port
      board-konstanter (`TERRITORY_IDS`, `CHECKPOINT_IDS`, `ADJACENCY`) og
      definer typed `Room`, `Player`, `Territory`, `PlayerID`, `Phase`. Ikke
      definer `Side`. Start med tester for initielt rom og board-invarianter.
      Ikke WebSocket ennå. Lærer: Go-structs, maps/slices, typed constants og
      table-driven tests.
- [x] **5. Port romopprettelse og spillerflyt** — ferdig 2026-07-29.
      Rene funksjoner for waiting- og bot-rom, spillerinnmelding, room-oppslag
      og room-liste. Tester dekker happy path, fullt rom, blank ID, duplikat
      romnavn og spiller i annet rom. `go test ./...` grønt.
- [ ] **6. Port setup og turregler uten WebSocket** — implementer
      `choose_start_checkpoint`, `roll_dice`, `move`, `end_turn` og `forfeit`
      som testbare domenefunksjoner. Gjør terningkast injiserbart i tester
      (f.eks. liten `Dice`-funksjon), ikke hardkod `rand.Intn` inne i logikken.
      Lærer: dependency injection i Go uten framework.
      Status 2026-08-16: `ChooseStartCheckpoint`, setup-delen av `EndTurn`,
      `RollDice` og `Move` finnes. `RollDice` avviser setup-fasen og bruker
      injiserbar terningfunksjon. Rekkeviddeberegningen for `ValidMoves` er
      ferdig: `reachableMapNodes` i `moves.go` bruker BFS (kø + `distances`-
      map) og sorterer med `slices.Sort`, så hver node kun besøkes via
      korteste avstand og rekkefølgen er deterministisk. `Move` følger
      Django-kontrakten: ett hopp til en node innenfor rekkevidde, så
      `MovesRemaining = 0` og `ValidMoves` tømmes. Checkpoint-bonus er
      implementert med konstantene `CheckpointBonusMoney`/`CheckpointBonusUnits`
      i `rules.go` (500/3 etter Django, lette å justere senere).
      `go test ./osloconquest`, `go vet ./osloconquest` og `gofmt` er grønne.
      Regelen «spilleren kan velge å ikke flytte» ligger i `end_turn` i
      playing-fasen (jf. Django), ikke i `validMoves`. Neste delsteg:
      playing-delen av `EndTurn` (med «kan velge å ikke flytte») og `forfeit`.
- [ ] **7. Port kampreglene som egen vertikal skive** — implementer dagens
      Django-angrep først (`fromTerritoryId` → `toTerritoryId`) før eventuell
      full mass-attack fra specen. Test nabo-validering, eier-validering,
      seier/tap, units-endringer og winner-threshold. Lærer: komplekse
      state-overganger med små tester.
- [ ] **8. Velg WebSocket-bibliotek og lag minimal server** — velg mellom
      stdlib-hijacking, `gorilla/websocket` og `nhooyr.io/websocket` før koding.
      Anbefalt beslutning for læring: bruk et lite bibliotek, sannsynligvis
      `nhooyr.io/websocket`, og hold resten av koden i egne packages. Lag
      `cmd/oslo-conquest/main.go` eller wire Oslo Conquest inn i eksisterende
      `cmd/holtebu-server` etter en eksplisitt beslutning. Lærer:
      WebSocket-oppgradering, read-loop/write-loop og JSON-protokoll.
- [ ] **9. Implementer concurrency-sikker room store** — erstatt Django sin
      globale `_rooms` med en Go-store. Start med `sync.Mutex`/`sync.RWMutex`
      rundt map for enkelhet; vurder per-room goroutine/channels senere hvis
      behovet faktisk oppstår. Test med parallelle room-operasjoner. Lærer:
      race-sikker delt tilstand; kjør `go test -race ./...` når mulig.
- [ ] **10. Koble WebSocket-handlers til domenelogikken** — støtt minst
      `create_game`, `create_game_with_bot`, `join_game`, `rejoin_game`,
      `list_rooms`, `choose_start_checkpoint`, `roll_dice`, `move`, `attack`,
      `end_turn` og `forfeit`. Serveren skal sende samme hovedtyper som
      klienten forventer: `game_state`, `room_list`, `error`. Lærer:
      protokoll-dispatch uten stor uoversiktlig switch hvis mønsteret blir
      tungt.
- [ ] **11. Bot som vanlig regelbruker** — port `bot.py` minimalt: bot velger
      checkpoint i setup og avslutter tur i playing, via samme action-path som
      en menneskelig spiller. Ikke gi boten snarveier inn i state. Lærer:
      separere beslutning fra mutasjon.
- [ ] **12. Lokal integrasjon mot klienten** — pek klienten mot Go-WS lokalt
      og spill gjennom: create room, join/rejoin, bot-room, setup, roll, move,
      attack, end_turn, forfeit. Fiks bare kontraktbrudd som hindrer dagens
      spillflyt.
      Lærer: ende-til-ende debugging mellom React og Go.
- [ ] **13. Drift/utrulling etter eksplisitt beslutning** — bestem om
      Oslo Conquest skal kjøres som egen binary/service eller samme
      `holtebu-server`-binary. Oppdater Traefik/systemd/bootstrap/GitHub
      Actions først når lokal flyt er verifisert. Lærer: deploy-konsekvenser
      av Go package/cmd-valg.
- [ ] **14. Rydding og Django-paritetssjekk** — sammenlign Go mot Django én
      gang til. Kryss av hva som kan slettes senere og hva Django fortsatt må
      eie. Ikke slett Django-implementasjonen før Go-versjonen er kjørt lokalt
      med klienten og deploy-planen er klar.

### Oslo Conquest protokollkontrakt (låst for første Go-port)

Kilder lest 2026-07-24:
- `client-react/oslo-conquest/src/transport/websocket/websocket.ts`
- `client-react/oslo-conquest/src/App.tsx`
- `client-react/oslo-conquest/src/domains/game/types.ts`
- `server/oslo_conquest/consumers.py`
- `server/oslo_conquest/mvp.py` (historisk navn; skal ikke kopieres til Go)
- `server/tests/test_oslo_conquest_consumer.py`
- `memory/oslo-conquest-spec.md`

Første Go-port skal bevare dagens spillflyt, men ikke videreføre dagens
`side`-baserte identitet. `memory/oslo-conquest-spec.md` er retning for videre
spillutvikling, men er ikke kontrakten for første port når den avviker fra
Django/React.

**WebSocket endpoint**
- Dagens Django endpoint: `/ws/oslo-conquest/`
- Go-versjonen må lokalt kunne tilby samme path når klientintegrasjon testes.

**Client → server**
- `{"type":"list_rooms"}`
- `{"type":"create_game","room":string,"player":{"id":string,"name":string}}`
- `{"type":"create_game_with_bot","room":string,"player":{"id":string,"name":string}}`
- `{"type":"join_game","room":string,"player":{"id":string,"name":string}}`
- `{"type":"rejoin_game","room":string,"playerId":string}`
- `{"type":"choose_start_checkpoint","playerId"?:string,"checkpointTerritoryId":string}`
- `{"type":"roll_dice","playerId"?:string}`
- `{"type":"move","playerId"?:string,"toTerritoryId":string}`
- `{"type":"attack","playerId"?:string,"fromTerritoryId":string,"toTerritoryId":string}`
- `{"type":"end_turn","playerId"?:string}`
- `{"type":"forfeit","playerId"?:string}`

`playerId` er valgfritt i flere meldinger fordi Django fallbacker til
connectionens spiller-id der det finnes. Go-porten bør støtte samme toleranse.

**Server → client**
- `{"type":"room_list","rooms":[RoomInfo...]}`
- `{"type":"game_state","state":GameState}`
- `{"type":"error","message":string}`

Klienten kan også lese `action_result`, men Django-consumeren bruker ikke det i
dag. Første Go-port trenger derfor ikke sende `action_result`.

**RoomInfo**
- `room`
- `playerCount`
- `maxPlayers`
- `started`
- `phase`
- `status` (`"waiting"` eller `"started"`)
- `ownerId`
- `playerIds`
- `players` (spillernavn)

Room-list skal ikke inkludere full `territories`-state.

**GameState minimum**
- `room`
- `phase`: `"waiting"`, `"setup"`, `"playing"` eller `"finished"`
- `started`
- `activePlayer`: `PlayerID` eller `null`
- `winner`: `PlayerID` eller fraværende/null
- `players`: liste av spillere
- `territories`: map fra territory/checkpoint-id til territory-state
- `log`: liste av `{msg,type,time}`

**Player minimum**
- `id`
- `name`
- `color`
- `colorName`
- `isBot`
- `position`
- `diceRoll`
- `movesRemaining`
- `validMoves`
- `setupConfirmed`
- `money`
- `units`
- `nextCheckpoint`

**Territory state**
- For vanlige territorier: `{id, owner, units}` der owner er `PlayerID`
  eller `null`.
- For checkpoints: `{id, owner:null, units:0}`.

**Første Go-port følger dagens Django-regler**
- 2 spillere per rom.
- `create_game` oppretter waiting-room med første spiller.
- `join_game` legger til andre spiller og starter setup når rommet er fullt.
- `create_game_with_bot` oppretter menneskelig spiller + bot og starter setup.
- Setup: hver spiller må velge checkpoint og avslutte tur før `playing`.
- `roll_dice` setter `diceRoll`, `movesRemaining` og `validMoves`.
- `move` krever terningkast og gyldig destination; checkpoint-bonus beholdes.
- `attack` er dagens enkle Django-angrep fra `fromTerritoryId` til
  `toTerritoryId`. Full mass-attack fra specen er videre spillutvikling, ikke
  del av første Go-slice.
- `end_turn` bytter aktiv spiller og nullstiller dice/moves.
- `forfeit` setter `winner` og `phase:"finished"`.
- `rejoin_game` sender full `game_state` hvis rom og spiller finnes, ellers
  `error` og oppdatert `room_list`.
- Ukjente/ugyldige actions bør ikke mutere state; returner `error` når dagens
  Django gjør det.

**Bevisst utsatt fra første port**
- `pickup_units`
- `drop_units`
- `buy_territory`
- full mobil hær-modell fra specen
- mass attack med support-map
- oppdragskort
- full økonomi/leie/bydelsbonus
- DB-persistens

## Ikke-mål (foreløpig)

- Google OAuth-flyten — blir i Django inntil videre.
- Persistens-endringer nå med det første — Go-serveren leser samme
  SQLite-fil som Django. **Fremtidig retning:** Espen ønsker å gå over til
  Postgres etterhvert (ikke tidfestet, ikke et steg i planen ennå). Når det
  skjer påvirker det testene: SQLite er embedded og billig å opprette per
  test (`t.TempDir()` + fil), mens Postgres krever en kjørende
  server-instans (f.eks. testcontainer eller delt test-DB) — vurder
  teststrategi på nytt når migreringen faktisk planlegges.

## Notater fra tidligere økter

- 2026-08-16: Lagt inn `.vscode/settings.json` med `formatOnSave` for Go
  (Go-utvidelsen `golang.go` + `gofmt`). gofmt kjøres automatisk ved save,
  så vi slipper manuell `gofmt -w` og CRLF/LF-støyen som fulgte med.
- 2026-07-22: Fjernet `requireAuth`-wrapping fra `main.go` midlertidig
  («vi venter med auth»). `createTournament` gjort tolerant for manglende
  claims (`host_id` er nullable, `null=True` i `clock/models.py`).
- 2026-07-22: Espen ønsker å droppe auth helt til sist i planen — flyttet
  "reintroduser auth" og `/api/me` (som avhenger av auth) til steg 6–7.
- 2026-07-22: Claude skrev `main_test.go`/`tournaments_test.go` selv på
  steg 1 — feil, se "Samarbeidsform" over. Filene ligger igjen som
  ureviderte utkast; Espen skriver testene selv (kan kikke på utkastene
  eller ignorere dem).
- 2026-07-22: Espen ønsker å gå over til Postgres etterhvert — se
  "Ikke-mål" over. Ingen konkret plan/tidspunkt ennå.
- 2026-07-23: Espen omprioriterer til å jobbe på oslo-conquest-Go-rewriten
  først. Poker-clock-stegene (players, finish, feilhåndtering, websocket,
  auth, me) satt på vent, ikke droppet. Avklarte package-vs-module — valgte
  å holde oslo-conquest i samme modul som poker-clock (`holtebu-server`),
  organisert med `cmd/`-mønster for flere kjørbare programmer, i stedet for
  et eget modul + `go.work`. Se "Struktur-beslutning" over.
