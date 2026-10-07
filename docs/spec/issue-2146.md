# Spec #2146 — Fürsorge-Vorschläge für jede Säule

Ergänzt `issue-1791.md`.

## Ziel

Jede defizitäre Säule eines Nutzers bekommt mindestens einen übernehmbaren Vorschlag, Standard- wie eigene Säule, im Free-Paket und ohne LLM.

## Regeln

- Kuratierte Vorlagen werden über den Säulen-Key (`Pillar.key`) der Nutzer-Säule zugeordnet, nie über die ID. Säulen-IDs gibt es pro Nutzer.
- Das gilt auch für den Erholungspfad bei Überlast (Pause, Körper, Mentale Gesundheit): `saeuleId` ist die ID der Säule des Nutzers.
- Eine Säule ohne Vorlage (eigene Säule, Key `null` oder unbekannt) und ohne offene Aufgabe bekommt genau einen generischen Vorschlag (`typ: 'vorlage'`) mit dem Säulennamen in Titel oder Beschreibung, in allen zehn `CARE_SPRACHEN`.
- Der generische Vorschlag hat einen `templateKey` je Säule, die Ablehnung wirkt nur auf diese Säule (`CARE_ABLEHNUNG_TAGE`).
- Verteilung: Ziel-Säule 50 %, Rest gleichmäßig; Übernahme über `POST /tasks`.
- Offene Aufgaben der Säule stehen weiterhin vor jeder Vorlage. DTO unverändert.

## Tests

`server/src/express/scores-care-suggestions.test.ts`, Block `#2146` (AK1–AK7).
