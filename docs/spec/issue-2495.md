# Spec #2495 — Server: Datenverlust und stille Fehleingaben bei Tasks und Scores verhindern

## Ziel

Drei Server-Pfade verhalten sich bei Fehlern bzw. falschen Eingaben still falsch. Nach dieser
Spec gilt: der Merge geschieht ganz oder gar nicht, der Checklisten-Done-Guard greift auch beim
Anlegen, und ein ungültiger `taskId`-Filter wird abgewiesen.

## Vorbedingungen

- Eingeloggter Nutzer; Tasks bzw. Care-Suggestion-Rejections gehören ihm (Datenisolation unberührt).

## AK1 — Merge ganz oder gar nicht (`POST /tasks/import/merge`)

- **Schritt:** Ziel-Task und Dublette gehören dem Nutzer; das Speichern des Ziel-Tasks scheitert
  (Test-Störfall: `Task.prototype.save` wirft für den Ziel-Task).
- **Erwartetes Ergebnis:** Anfrage scheitert mit 500; **beide** Tasks existieren danach unverändert
  weiter — die Dublette ist nicht gelöscht, der Ziel-Task trägt unveränderte Frist/Priorität.
- **Umsetzung:** Reihenfolge im Handler tauschen — erst `keep.save()`, dann `duplicate.destroy()`;
  `destroy` läuft nur nach erfolgreichem `save`.

## AK2 — Done-Guard auch beim Anlegen (`POST /tasks`)

- **Schritt:** `POST /tasks` mit `status: 'Done'` und mindestens einem offenen Checkpunkt
  (mitgesendete Checkliste).
- **Erwartetes Ergebnis:** 409 mit exakt derselben Meldung wie der PATCH-Guard
  („Der Task kann nicht auf „Erledigt“ gesetzt werden, solange noch Checkpunkte offen sind.“);
  der Task wird nicht angelegt. Spiegel-Test: PATCH liefert die Referenzmeldung, POST muss sie
  wörtlich wiedergeben.
- **Kontrollfall:** `status: 'Done'` ohne offene Checkpunkte (keine bzw. vollständig abgehakte
  Checkliste) legt den Task wie bisher an (201).

## AK3 — `taskId` der Rejections-Historie validieren (`GET /scores/care-suggestions/rejections`)

- **Schritt:** `?taskId=abc` — Parameter vorhanden, aber keine Ganzzahl.
- **Erwartetes Ergebnis:** 400 statt stiller Filter-Ausfall (bisher: `Number('abc')` → `NaN` →
  `Number.isInteger` falsch → Filter entfällt → alle Einträge).
- **Bestandsverhalten:** fehlender Parameter und `?taskId=` (leerer String) liefern weiterhin alle
  eigenen Einträge; eine gültige `taskId` filtert wie bisher (bereits durch den #1977-Test
  „AK2: POST persistiert Grund je taskId und je templateKey“ gedeckt — kein Duplikat).

## Tests

- TF1: `server/src/express/taskImportAnalysis.test.ts` — Merge-Fehlerfall (API, node:test)
- TF2: `server/src/express/tasks-checklist.test.ts` — POST-Done-Guard + Kontrollfall (API)
- TF3: `server/src/express/scores-care-suggestions.test.ts` — `taskId=abc` → 400 (API)
