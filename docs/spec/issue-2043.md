# Issue 2043 — Gemeinsame Fünf-Faktor-Bewertung für /next und /suggestions

Basis: Issue #2043 + KI-ANALYSE-Block (Harness-Kommentar, stand 2026-10-01T14:20:24Z). Teil von #1963.

## Ziel

`GET /next` und `GET /suggestions` ordnen nach derselben Bewertung mit fünf Faktoren: Priorität,
Entsperr-Wirkung, Balance, Deadline, Aufwand. Die Bewertung liefert je Faktor einen Beitrag
(`W_x · n_x`); der Score ist deren Summe. Keine DTO-/OpenAPI-Änderung (Aufschlüsselung folgt in #2044).

## Vertrag

- Neuer Export `bewerteKandidaten(userId?: number, now?: Date)` in `server/src/logics/find.ts`:
  liefert die freien Kandidaten (gleiche Vorstufe wie heute) vor dem Post-Filter, sortiert nach
  Score absteigend, als `{ task, score, beitraege: { prio, entsperr, balance, deadline, aufwand } }`.
- `findNextImportantTask` = Rang 1 dieser Bewertung (`null` ohne freie Tasks);
  `findSuggestedTasks` = dieselbe Bewertung, danach Post-Filter (`MAX_PRO_SAEULE`/`MAX_VORSCHLAEGE`).
- `entsperr`: wächst monoton mit der Zahl offener (nicht `Done`) Nachfolger (`dependents`); ohne Nachfolger 0.
- `aufwand`: geringerer `estimatedEffort` ⇒ höherer Beitrag. (Eine „fehlende Angabe" gibt es nicht:
  das Feld ist `NOT NULL`, Default 0.5, Bereich 0.1–1.)

## Akzeptanzkriterien

- AK1: `/next` = Rang 1 der `/suggestions`-Bewertung.
- AK2: mehr offene Nachfolger ⇒ höher; keine ⇒ Beitrag 0.
- AK3: geringerer Aufwand ⇒ höher.
- AK4: Score = Summe der Faktor-Beiträge (Toleranz 1e-9).
- AK5: Priorität/Deadline/Balance behalten ihre Wirkrichtung (Bestandstests).
- AK6: ohne freie Tasks `/next` ⇒ `null` (Bestandstest „Leerfall").
