# Go-læringsplan / omskrivingsplan

Formål: Espen lærer Go ved å gradvis omskrive deler av Django-backenden
(`server/`) til Go. Startet med poker-clock (`holtebu-server`), utvides nå
til også å omfatte oslo-conquest. Denne filen er logg + plan slik at vi kan
plukke opp der vi slapp mellom sesjoner. Oppdater den når vi fullfører et
steg eller endrer retning — ikke la den bli stale.

Prinsipp: vertikale skiver. Hvert steg skal ende med noe som kjører og kan
testes, ikke halvferdig kode (jf. `AGENTS.md`).

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
- `main.go` — HTTP-routing (`net/http`), `/pokerklokke`-prefix-stripping
- `config.go` — leser `../config.json`
- `db.go` — SQLite-tilkobling (`modernc.org/sqlite`)
- `auth.go` — JWT-parsing (`golang-jwt/jwt/v5`) + `requireAuth`-middleware
  (**for øyeblikket ikke koblet inn noe sted, bevisst utsatt** — se steg 6)
- `tournaments.go` — `GET/POST /api/tournaments`, `GET /api/tournaments/{id}`

Ingen Go-tester finnes ennå (`go test ./...` → "no test files").

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

## Oslo Conquest → Go (ny retning, ikke brutt ned i steg ennå)

Kilde å porte fra: `server/oslo_conquest/` (Django-app, WS-consumer via
Channels — se `oslo_conquest/consumers.py`, `oslo_conquest/routing.py`,
mounted på `/ws/oslo-conquest/`). Ingen DB-persistens i dag (`_rooms` i
minnet), jf. `memory/oslo-conquest-spec.md`.

Denne planen er ikke brutt ned i konkrete steg ennå — det gjør vi når
struktur-steget (package + `cmd/`) er unnagjort og vi faktisk starter.
Grovt sett venter: WebSocket-håndtering i Go (`net/http` sin
`ResponseWriter`-hijacking eller et bibliotek som `gorilla/websocket`/
`nhooyr.io/websocket` — ikke avgjort), og in-memory concurrency-sikker
romtilstand (goroutines/channels eller mutex-beskyttet map).

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
