# Spec #2798 — Server: drei Nits der Request-Validation aus PR 2786 bereinigen

## Ziel

Reines Cleanup aus dem Review von PR 2786 (#2772): zwei Spec-Typos, ein temporärer dynamischer
Import und ein Helfer-Name, der die `validate*`-Konvention des Moduls bricht. Kein Verhalten
ändert sich — der API-Vertrag aus #2772 (Meldungen, Statuscodes, Normalisierungen) bleibt
unberührt.

## Voraussetzungen

- Die Nits liegen in `docs/spec/issue-2772.md`, `server/src/logics/requestValidation.test.ts`
  (dynamischer Import `loadHelper`) und `server/src/logics/requestValidation.ts` (`queryString`,
  Z. 196) samt 4 Importzeilen (scores, journal, users, groups) und 12 Aufrufstellen
  (scores 8, journal 2, users 1, groups 1).
- Guard sind die bestehenden Suiten: `server/src/logics/requestValidation.test.ts` (inkl.
  Dedup-Spiegel) und die TF3-Route-Tests (`scores-balance-history.test.ts`,
  `journal-stats.test.ts`, `users-search.test.ts`, `groups-duo.api.test.ts`).

## Bereinigungen

1. **Spec-Typos (`docs/spec/issue-2772.md`)** — „parst" statt „paritt" (Voraussetzungen-Bullet zu
   Express-Query-Arrays) und „Die exakten Fehlertexte" statt „Die exakte Fehlertexte".
   → im Spec-PR erledigt (docs/spec-Scope der Spec-Phase).
2. **Statischer Import (`requestValidation.test.ts`)** — `validateNonEmptyString` wandert in den
   statischen Import-Block am Dateikopf (wie die Nachbar-Helfer); der dynamische `loadHelper`-
   Import samt Rot-Zustand-Kommentar („bis der Export existiert") wird ersatzlos entfernt.
3. **Sprechender Name** — der Query-Einzelwert-Helfer `queryString` trägt einen Namen nach der
   `validate*`-Konvention des Moduls (`validateQueryEinzelwert`); Definition, alle 4 Importzeilen
   und alle 12 Aufrufstellen sind mitgeändert; `grep -rn "queryString" server/src` liefert danach
   0 Treffer.

## Testfälle

Keine neuen Tests — Refactoring ohne Verhaltensänderung (Analyse #2798): ein Test auf Namen oder
Import-Style wäre ein reiner String-Matcher ohne Zähne (ADR 0001). Die bestehenden Suiten
bleiben unverändert grün (AK4); AK3 ist mechanisch per grep verifizierbar.

## Offene Fragen

- keine
