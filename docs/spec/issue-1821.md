# Spec: Erledigte Aufgaben bearbeitbar (#1821)

## Ziel

Löst die Done-Bearbeitungssperre aus #1438 ab (Entscheidung: Wortlaut „erledigte Aufgaben dürfen
geändert werden, Balance ggf. neu berechnen"). Reopen (#1438 AK2/AK2b/AK3) und Idempotenz (AK5, AK6b) bleiben.

## Regeln

- AK1: `PATCH /tasks/:id` auf einen Done-Task mit beliebigen Feldern (auch `userId`) ohne `status` → 200, Felder übernommen, Status bleibt `Done`.
- AK2: dasselbe mit `status: "Done"` → 200.
- AK3: Ändert der PATCH `estimatedEffort`, `priority` oder `deadline` eines Done-Tasks, werden `punkte`/`pünktlich` des bestehenden ScoreEntry per `berechneScore(deadline, zeitpunkt, estimatedEffort × priority)` neu berechnet. `zeitpunkt` bleibt, es bleibt genau ein ScoreEntry.
- AK4: Bearbeiten ohne Statuswechsel löst keinen Erledigt-/Meilenstein-Push aus.
- AK5: MCP `task_update` mit inhaltlichem Feld auf erledigter Aufgabe gelingt (gleiche Route).
- AK6: UI — Speichern einer erledigten Aufgabe ohne Fehlerdialog, bleibt erledigt, neuer Titel (auch 375 px).

## Aufsatzpunkt

`server/src/express/routes/tasks.ts:758-772` (Sperre entfernen), Neuberechnung analog `awardScoreOnDone` (`:526`).
