# Spec #2559 — E2E-Specs auf 375×812 umstellen

## Ziel

Mobil-E2E-Specs prüfen die verbindliche Größe 375×812 (`.ai-knowledge/project.md`, Mobile-First),
nicht mehr 375×667. Eine Konstante statt Zahlen je Spec.

## Vorbedingung

`frontend/e2e/**/*.spec.ts` setzen Viewports einzeln; 39 Stellen in 31 Dateien nutzen Höhe 667,
16 Dateien definieren `MOBILE` lokal.

## Schritte / Erwartetes Ergebnis

1. `frontend/e2e/helpers.ts` exportiert `MOBILE = { width: 375, height: 812 } as const`.
2. Alle Mobil-Setzungen (`setViewportSize`, `test.use({ viewport })`, Viewport-Tupel,
   Config-Objekte) nutzen `MOBILE`; die 16 lokalen Duplikate sind auf den Import konsolidiert.
3. `heart-balance.spec.ts` prüft die Höhen-Assertion gegen 812.
4. Testtitel mit „375×667" lauten „375×812".
5. Außerhalb davon bleiben Desktop-Viewports, Sonderfälle (320er, 375×800, 768er) und die PLZ
   „81667 München" (`issue-1061-task-address.spec.ts`) unverändert.
6. Die volle E2E-Suite bleibt grün (CI, sharded).

## Prüfung

Guard `.github/scripts/e2e-viewport.test.ts` (`pnpm test:scripts`): keine eigenständige Zahl 667
in Specs (AK1), `MOBILE` aus `helpers.ts` (AK2), keine lokalen Duplikate (AK2). Titel (AK3) und
Suite-Grün (AK4) per Review-Grep bzw. CI.
