---
title: Feature
---

Implementer en ny feature ved hjelp av en analytiker, arkitekt og implementasjonsteam.

## Flyt

### Steg 1 – Analytikerens avklaring

Start en sub-agent med følgende oppdrag:

- Les feature-beskrivelsen i $ARGUMENTS
- Still **kritiske spørsmål** til brukeren for å unngå misforståelser og scope creep. Eksempler på hva å avklare:
  - Hva er motivasjonen, og gir det nok verdi?
  - Hva er innenfor scope — og hva er *ikke* det?
  - Finnes det edge cases eller feilscenarioer som må håndteres?
  - Er det avhengigheter til eksisterende features?
- Vent på brukerens svar
- Skriv deretter **testbare brukerhistorier** på formatet:
  > Som [bruker] ønsker jeg [handling] slik at [verdi]
  > **Akseptansekriterier:** Gitt [kontekst], når [handling], så [forventet resultat]
- Vær skeptisk til store scope — bryt heller ned i flere små historier
- Presenter historiene og be brukeren bekrefte eller justere

Stopp og vent på brukerens godkjenning av brukerhistoriene før du går videre.

### Steg 2 – Arkitektanalyse og plan

Start en ny sub-agent (subagent_type: Plan) med brukerhistoriene fra steg 1 som input:

- Les relevant kode i prosjektet (bruk Glob og Read for å forstå eksisterende strukturer)
- Lag en **enkel skisse** av løsningen — ASCII-diagram eller punktliste med komponentansvar
- Identifiser hvilke filer som må opprettes eller endres
- List opp konkrete design-valg med begrunnelse (pattern, modulinndeling, grensesnitt)
- Vær kritisk: still spørsmål ved kompleksitet, duplisering og uklar ansvarsfordeling
- Fokuser på: modularisering, single responsibility, ryddige grensesnitt, lesbarhet

Arkitekten skal IKKE skrive kode — kun planlegge.

### Steg 3 – Presenter planen og vent

Vis planen til brukeren. Stopp og spør eksplisitt:
> "Ser planen riktig ut? Juster gjerne før jeg begynner å implementere."

Ikke fortsett til steg 4 før brukeren har godkjent.

### Steg 4 – Implementasjon

Implementer featuren basert på de godkjente brukerhistoriene og planen. Følg TDD-prinsippene fra CLAUDE.md:
- Skriv tester først
- Implementer til testene er grønne
- Commit etter grønn iterasjon

Bruk parallelle agenter for uavhengige lag (backend, frontend, tester) når grensesnittene er definert.

### Steg 5 – Kode-refaktorering

Kjør `/simplify`-skillen på de endrede filene. Den gjennomgår koden for:
- Duplisering og gjenbruk
- Navngiving og lesbarhet
- Unødvendig kompleksitet

Fiks det som flagges før arkitekten gjennomgår.

### Steg 6 – Arkitektgjennomgang

Start arkitekt-agenten på nytt med tilgang til de endrede filene. Oppdraget:

- Sammenlign implementasjonen med den godkjente planen og brukerhistoriene
- Sjekk for anti-patterns, duplisering, uklare ansvarsgrenser
- Gi konkret tilbakemelding: hva er bra, hva bør fikses
- Hvis det er avvik fra planen: forklar om de er akseptable eller ikke

Presenter gjennomgangen til brukeren. Fiks eventuelle kritiske funn.

## Feature-beskrivelse

$ARGUMENTS
