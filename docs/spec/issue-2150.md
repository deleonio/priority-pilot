# /scores/balance: kein Doppel-Lesen, Doku-Stand #1965

**Stand:** 2026-10-03 (Spec-Phase #2150, Findings aus dem Review von PR #2148)

## Ziel

Ein `GET /scores/balance`-Request lädt die `ScoreEntry`-Liste und berechnet den Streak nur
**einmal** je Request. Die überholte Aussage in `docs/spec/issue-1362.md` (Punkte-Badge kann
nach Wiedereröffnen erlöschen) wird an den Sticky-Stand von #1965 angepasst.

## Vorbedingung

Eingeloggter Nutzer (Auth-Gate wie bisher), Task mit Säulenanteilen erledigt (erzeugt
`ScoreEntry`-Bestand). Antwort-Vertrag von `GET /scores/balance` bleibt unverändert
(`BalanceStatusDto`).

## Verhalten

1. **AK1 — ein Leselauf je Request:** Die Route lädt `ScoreEntry.findAll` genau einmal (im
   bestehenden `Promise.all`) und reicht die geladenen Entries bzw. den daraus berechneten
   Streak/die Punktesumme an `meilensteinStandVon` weiter, statt den zweiten Vollzugriff über
   `meilensteinStandVon(userId, zeitZone)` zu erlauben. Felder und Werte der Antwort bleiben
   exakt wie bisher (Abgedeckt durch die bestehenden #1423-Tests, die grün bleiben müssen).
2. **AK2 — Rückfallverhalten:** `meilensteinStandVon` nimmt optional vorbereitete Daten
   entgegen; ohne Übergabe verhält sie sich exakt wie bisher (eigener `ScoreEntry.findAll`,
   Streak-Berechnung, Sticky-Merge). `GET /scores/meilensteine` bleibt unbeeinflusst
   (bestehende Tests in `server/src/express/scores-milestones.test.ts` decken das ab — kein
   neuer Test).
3. **AK3 — Doku-Stand:** `docs/spec/issue-1362.md` behauptet nicht mehr, ein Punkte-Badge
   könne nach dem Wiedereröffnen einer erledigten Aufgabe wieder erlöschen; die Passage
   beschreibt den Sticky-Stand von #1965 (einmal erreicht bleibt erreicht). Reine
   Doku-Änderung, kein Test (ADR 0001 — Nachweis per Dateiinhalt im PR-Body).

## Tests

| TF  | AK  | Datei                                       | Kern                                                                              |
| --- | --- | ------------------------------------------- | --------------------------------------------------------------------------------- |
| TF1 | AK1 | `server/src/express/scores-balance.test.ts` | Zähler um `ScoreEntry.findAll`: während eines Balance-Requests genau 1 Aufruf     |
| TF2 | AK2 | `server/src/logics/milestones.test.ts`      | Mit übergebenen Entries: identisches Ergebnis, kein erneuter `ScoreEntry.findAll` |
| TF3 | AK3 | —                                           | Doku-Änderung, kein Test (ADR 0001)                                               |

TF1 ist rot, solange die Route + `meilensteinStandVon` je Request zweimal lesen (Assert
`1`, tatsächlich `2`). TF2 ist rot, solangen übergebene Daten ignoriert werden (Zähler
steigt beim zweiten Aufruf, obwohl Daten vorliegen).
