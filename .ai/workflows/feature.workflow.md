---
title: Feature Workflow
name: workflows
description: Streng workflow for featurearbeid med analyse, plan, implementasjon, refaktorering og arkitektgjennomgang.
---

Implementer en ny feature ved hjelp av tydelige faser: analytiker, arkitekt, implementasjon, refaktorering og arkitektgjennomgang.

Denne workflowen skal følges som en streng state machine.

## Steg 0 - Miljøkartlegging

Før du starter, avklar én gang:

- Er sub-agents tilgjengelig?
- Er parallell kjøring tilgjengelig?
- Er commit-verktøy tilgjengelig?
- Finnes `/simplify` eller tilsvarende refaktoreringsverktøy?

Bruk disse svarene konsekvent gjennom hele workflowen.

## Regler

- Ikke hopp over steg.
- Ikke gå videre fra et steg som krever godkjenning før brukeren eksplisitt har godkjent.
- Hvis miljøet støtter sub-agents, kan separate agenter brukes.
- Hvis miljøet ikke støtter sub-agents, simuler rollene sekvensielt.
- Hvis miljøet støtter parallelle agenter, kan de brukes for uavhengige arbeidsstrømmer.
- Hvis prosjektets instruksjonsfiler (CLAUDE.md, AGENTS.md, README.md, .cursorrules, etc.) motstrider denne workflowen, følg prosjektfilene for tekniske konvensjoner (navngiving, testrammeverk, etc.) men behold denne workflowens fasestruktur og godkjenningsporter.
- Bruk tilgjengelige prosjektverktøy for å lese filer, søke i kode, kjøre tester og gjøre endringer.
- Ikke anta at bestemte verktøynavn finnes.
- Følg prosjektets egne instruksjonsfiler hvis de finnes, for eksempel `CLAUDE.md`, `AGENTS.md`, `README.md`, `.cursorrules` eller tilsvarende.
- Hvis brukeren sier «avbryt», «stopp» eller tilsvarende på et hvilket som helst tidspunkt: stopp workflowen, oppsummer hva som er gjort så langt, og list opp hvilke filer som eventuelt er endret.
- Hvis prosjektet ikke har eksisterende tester og intet testrammeverk er konfigurert, informer brukeren og foreslå et passende testrammeverk basert på prosjektets teknologistack. Vent på godkjenning før du oppretter testinfrastruktur.
- Hvis en blokkering oppdages (f.eks. feature allerede implementert, alvorlig teknisk hindring), stopp workflowen og informer brukeren umiddelbart.

## Steg 1 – Analytikeravklaring

Ta rollen som analytiker.

Hvis `$ARGUMENTS` er tomt eller for vagt til å stille meningsfulle spørsmål, for eksempel kortere enn 10 ord, stopp og be brukeren om en mer utfyllende feature-beskrivelse før du fortsetter.

Oppdrag:

- Les feature-beskrivelsen i `$ARGUMENTS`.
- Still kritiske spørsmål til brukeren for å unngå misforståelser og scope creep.
- Avklar spesielt:
  - Hva er motivasjonen, og gir featuren nok verdi?
  - Hva er innenfor scope?
  - Hva er eksplisitt utenfor scope?
  - Hvilke edge cases eller feilscenarioer må håndteres?
  - Finnes det avhengigheter til eksisterende features?
  - Finnes det tekniske, produktmessige eller tidsmessige begrensninger?
- Vent på brukerens svar.

Når brukeren har svart, skriv testbare brukerhistorier på formatet:

> Som [bruker] ønsker jeg [handling] slik at [verdi]  
> **Akseptansekriterier:** Gitt [kontekst], når [handling], så [forventet resultat]

Retningslinjer:

- Vær skeptisk til stort scope.
- Bryt store features ned i små, testbare historier.
- Ikke inkluder implementasjonsdetaljer i brukerhistoriene med mindre de er nødvendige.
- Presenter brukerhistoriene for brukeren.

STOPP HER.

Spør brukeren eksplisitt:

> Ser brukerhistoriene riktige ut? Juster gjerne før jeg går videre til arkitektplanen.

Hvis brukeren avviser helt: gå tilbake til starten av steg 1 og gjenta med ny input. Hvis brukeren ber om justeringer: oppdater kun de delene brukeren peker på, presenter oppdatert versjon, og vent på ny godkjenning.

Ikke gå videre til steg 2 før brukeren har godkjent brukerhistoriene.

## Steg 2 – Arkitektanalyse og plan

Ta rollen som arkitekt.

Input:

- Godkjente brukerhistorier fra steg 1.
- Feature-beskrivelsen i `$ARGUMENTS`.

Oppdrag:

- Les kode som direkte berøres av featuren: start med filer nevnt i `$ARGUMENTS`, følg imports eller avhengigheter ett nivå ut, og søk etter lignende patterns i prosjektet. Les maks 20 filer med mindre prosjektstørrelse tydelig krever mer.
- Forstå eksisterende struktur, moduler, patterns og grensesnitt.
- Lag en enkel skisse av løsningen:
  - ASCII-diagram, eller
  - punktliste med komponentansvar.
- Identifiser filer som må:
  - opprettes,
  - endres,
  - slettes,
  - eller vurderes nærmere.
- List opp konkrete designvalg med begrunnelse:
  - pattern,
  - modulinndeling,
  - grensesnitt,
  - datamodell,
  - teststrategi.
- Vær kritisk til:
  - unødvendig kompleksitet,
  - duplisering,
  - uklare ansvarsgrenser,
  - skjulte avhengigheter,
  - manglende testbarhet.
- Prioriter i denne rekkefølgen:
  - løsningsskisse,
  - filer som må endres eller opprettes,
  - kritiske designvalg.
- Punkt 4-6 i dette steget er sekundære og kan forkortes hvis planen allerede er tydelig.
- Deretter fokuser på:
  - modularisering,
  - single responsibility,
  - ryddige grensesnitt,
  - lesbarhet,
  - minst mulig endringsflate.

Arkitekten skal ikke skrive produksjonskode i dette steget.

## Steg 3 – Presenter planen og vent

Presenter arkitektplanen for brukeren.

Planen skal inneholde:

- Kort løsningsskisse.
- Filer som skal endres/opprettes.
- Designvalg og begrunnelser.
- Testplan.
- Risikoer og åpne spørsmål.
- Hva som eksplisitt ikke skal gjøres nå.

STOPP HER.

Spør brukeren eksplisitt:

> Ser planen riktig ut? Juster gjerne før jeg begynner å implementere.

Hvis brukeren avviser helt: gå tilbake til starten av steg 2 og gjenta med ny input. Hvis brukeren ber om justeringer: oppdater kun de delene brukeren peker på, presenter oppdatert plan, og vent på ny godkjenning.

Ikke gå videre til steg 4 før brukeren har godkjent planen.

## Steg 4 – Implementasjon

Ta rollen som implementasjonsteam.

Input:

- Godkjente brukerhistorier.
- Godkjent arkitektplan.
- Prosjektets instruksjonsfiler.

Oppdrag:

- Implementer featuren i små, trygge iterasjoner.
- Følg TDD med mindre featuren kun involverer konfigurasjon, infrastruktur eller UI-markup uten forretningslogikk. I alle andre tilfeller:
  1. Skriv eller oppdater tester først.
  2. Kjør testene og bekreft at relevante tester feiler når forventet.
  3. Implementer minste nødvendige kode.
  4. Kjør testene igjen.
  5. Gjenta til testene er grønne.
- Følg eksisterende kodekonvensjoner.
- Ikke utvid scope uten ny godkjenning.
- Hvis separate arbeidsstrømmer er uavhengige, kan de implementeres parallelt dersom miljøet støtter det.
- Hvis miljøet støtter commits, commit etter en grønn og logisk iterasjon.
- Hvis miljøet ikke støtter commits, foreslå en passende commitmelding.

## Steg 5 – Refaktoreringsgjennomgang

Utfør en refaktoreringsgjennomgang av endrede filer.

Hvis miljøet støtter en `/simplify`-skill eller tilsvarende refaktoreringsverktøy, bruk den.  
Hvis ikke, gjennomfør gjennomgangen manuelt.

Fokuser på:

- duplisering,
- gjenbruk,
- navngiving,
- lesbarhet,
- unødvendig kompleksitet,
- modulgrenser,
- single responsibility,
- testbarhet,
- dødkode,
- for brede abstraheringer.

I dette steget betyr "funn" bare duplisering, navngiving, dødkode og lesbarhet. Fiks alle slike funn før arkitektgjennomgangen. La arkitekturmessige funn som modulgrenser, ansvarsdeling og brede abstraheringer stå til steg 6.

Ikke vurder eller gjør arkitekturendringer i dette steget. Hvis et funn krever endringer i modulgrenser, ansvar eller andre arkitekturvalg, dokumenter det kort og løft det til steg 6 i stedet.

## Steg 6 – Arkitektgjennomgang

Ta rollen som arkitekt på nytt.

Input:

- Godkjente brukerhistorier.
- Godkjent arkitektplan.
- Endrede filer.
- Testresultater.

Oppdrag:

- Sammenlign implementasjonen med brukerhistoriene.
- Sammenlign implementasjonen med den godkjente planen.
- Sjekk for:
  - anti-patterns,
  - duplisering,
  - uklare ansvarsgrenser,
  - unødvendig kompleksitet,
  - manglende tester,
  - edge cases som ikke er håndtert,
  - avvik fra prosjektets konvensjoner.
- Gi konkret tilbakemelding:
  - Hva er bra?
  - Hva bør fikses?
  - Hva er kritisk før merge?
  - Hva kan eventuelt tas senere?
- Hvis implementasjonen avviker fra planen, forklar:
  - hva som avviker,
  - hvorfor det avviker,
  - om avviket er akseptabelt.
- Hvis du oppdager at brukerhistoriene var ufullstendige eller feil avgrenset, gå tilbake til steg 1 med et konkret endringsforslag og be brukeren godkjenne reviderte historier før videre arbeid.

Presenter gjennomgangen til brukeren.

Hvis det finnes kritiske funn som kan fikses uten å endre godkjente brukerhistorier eller den godkjente planen, bytt midlertidig til implementasjonsteamet, fiks dem, kjør relevante tester, og bytt deretter tilbake til arkitektrollen for å verifisere resultatet. Hvis et kritisk funn krever endring i scope eller plan, stopp og be brukeren godkjenne reviderte historier eller plan før du endrer kode.

## Ferdigkriterier

Featurearbeidet er ferdig når:

- brukerhistoriene er oppfylt,
- akseptansekriteriene er dekket av tester eller verifiserbar oppførsel,
- relevante tester er grønne,
- refaktoreringsgjennomgang er utført,
- arkitektgjennomgang er utført,
- kritiske funn er fikset,
- brukeren har fått en kort oppsummering av hva som ble endret.

## Feature-beskrivelse

`$ARGUMENTS`