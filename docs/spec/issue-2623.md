# E2E-Seed der Überlast-Mindestmenge aus der Server-Konstante — Balamentum

**Stand:** 2026-10-15
**Ziel:** `seedMindestErledigungen` (Test-Infrastruktur) leitet die Schleifen-Obergrenze aus `UEBERLAST_MINDEST_ERLEDIGUNGEN` (`server/src/logics/careDeficit.ts`) ab — kein Literal `3` mehr in `frontend/e2e/helpers.ts`. Ändert jemand die Server-Konstante, säen die Care-Specs automatisch die neue Mindestmenge; ein stilles Auseinanderlaufen von Server-Schwelle und E2E-Seed wird ausgeschlossen.

## Vorbedingung

- `UEBERLAST_MINDEST_ERLEDIGUNGEN` ist eine exportierte Konstante in `server/src/logics/careDeficit.ts` (Z. 25, aktuell `3`) und wird von der Überlast-Auswertung (`bewerteCareDefizit`) als Mindestmenge gelesen.
- `seedMindestErledigungen` in `frontend/e2e/helpers.ts` legt Erledigungen per API an (OHNE Säulen-Beitrag, #2527-Kommentar bleibt); ihr Loop nutzt aktuell das Literal `3`.

## Vertrag (AK1)

Die Schleifen-Obergrenze von `seedMindestErledigungen` muss aus `UEBERLAST_MINDEST_ERLEDIGUNGEN` abgeleitet sein — in einer von zwei Varianten:

1. **Direkt-Import (bevorzugt):** `helpers.ts` importiert `UEBERLAST_MINDEST_ERLEDIGUNGEN` aus dem Server-Paket und nutzt den Identifier als Obergrenze. Die Quelle sichert das Typsystem (`pnpm --filter frontend lint`, tsc über `e2e`) — kein zusätzlicher Unit-Test nötig; der Guard-Test akzeptiert diese Variante strukturell.
2. **Spiegel-Konstante (Fallback, falls der paketübergreifende Pfad im Playwright-ESM-Loader nicht auflöst):** `helpers.ts` definiert eine benannte Konstante mit Literalwert; ein automatischer Guard-Test (`server/src/logics/careDeficit.test.ts`) liest `frontend/e2e/helpers.ts` und asserted Spiegelwert == `UEBERLAST_MINDEST_ERLEDIGUNGEN`. Der Guard wird rot, wenn die Server-Konstante ohne den Spiegel geändert wird.

Unabhängig von der Variante gilt: ein bloßes Literal direkt in der Schleife verletzt AK1.

## Erwartetes Ergebnis (AK2)

- Die vier nutzenden Specs (`issue-1793-care-hint`, `issue-1977-care-rejection`, `issue-2063-care-hint-i18n`, `issue-2522-care-hint-refresh`) laufen nach der Umstellung grün — die Signatur von `seedMindestErledigungen` (`(page: Page)`) bleibt unverändert, die Specs brauchen keine Anpassung.
- `CARE_FENSTER_TAGE` und `zaehleErledigungen` bleiben unangetastet; das Seeding bleibt „OHNE Säulen-Beitrag".
