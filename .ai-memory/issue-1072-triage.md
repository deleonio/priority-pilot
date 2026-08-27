# Issue 1072 — Triage-Phase (abgeschlossen 2026-08-27)

## Erledigt
- Initial-Triage: Issue-Body + Kommentare geladen (einziges Kommentar = github-actions Quality-Bot, keine Entscheidungen).
- Analyse verfasst und mit Routing-Tabelle in den Issue-Body geschrieben (`gh issue edit 1072 --body-file .ai-memory/issue-1072-body.md`, stand=2026-08-27T20:15:04Z). Body-Datei liegt weiterhin unter `.ai-memory/issue-1072-body.md`.
- Labels gesetzt: `ai:needs-analyse` entfernt, `ai:analysed` + `ai:needs-ux-ui` gesetzt (Ampel 🟢, ux: ja).
- Copyedit im Body: nur Tippfehler „letzes"→„letztes" im Soll-Block; Inhalt unverändert. Titel unverändert (zutreffend).
- Kein Ping-Kommentar (keine offenen Fragen), kein autonomes Schließen (IST im Code nachweislich nicht erfüllt).

## Relevante Stellen
- `frontend/src/components/TaskForm.tsx:873-934` — der zu ändernde Abschnitt: KolInputDate „Deadline (optional)" (:873) → KolCombobox „Adresse (optional)" (:894) → KolInputCheckbox `auto-delete-toggle` (:917) → bedingtes KolAlert (:929). Serie-Modus-Zweig mit Startdatum/Rhythmus: :830-870.
- `frontend/src/components/TaskForm.tsx:1001` + `frontend/src/app.css:1106` — Muster `.pillar-editor` (Grid-Gap-Gruppen-Container mit Label-Span).
- `frontend/src/components/TaskForm.tsx:1095` + `frontend/src/app.css:1770` — Muster `.checklist-editor` (zweites Gruppen-Muster).
- `frontend/e2e/issue-1061-task-address.spec.ts` — E2E-Vorbild für Tests gegen das Adresse-Feld im Task-Formular.
- `frontend/e2e/series-in-taskform.spec.ts:74-96` — Modus-Wechsel-Tests, die grün bleiben müssen (Feld-Sichtbarkeit ändert sich nicht).

## Annahmen
- „Adresse als letztes Feld" = direkt nach der Deadline-Gruppe (vom Issue selbst so definiert: „also nach der gesamten Deadline-Gruppe"); Beschreibung/Säulen/Checkliste danach bleiben unverändert.
- Checkbox „Aufgaben nach Deadline löschen" (Issue-Wortlaut) = „Automatisch löschen nach 3 Tagen bei verpasster Deadline" (Code-Wortlaut) — dasselbe Feld, Label unverändert.
- Serie-Modus bekommt dieselbe Reihenfolge (geteilte Felder), kein separates AK dafür außer AK3-Halbsatz.

## Verworfen
- needs-human wegen „letztes Feld im Formular"-Doppeldeutigkeit — nein: der Soll-Satz definiert die Lesart selbst, Messkriterium 2 ist nur lax formuliert.
- Titel-Änderung — Titel ist zutreffend, kein substantieller Fehler.

## Offen
- -

## Nächster Schritt
- UX-Phase (Routing: ux ja, sonnet, low): advisory UX-Review zur Gruppen-Darstellung (Rahmen vs. Überschrift vs. Abstände), KI-UX-Block in den Issue-Body.

## Fallstricke
- KoliBri-Hosts sind block-level (width:100%) — Flex-Row-Falle aus MEMORY.md beachten, falls die Gruppe mehrspaltig werden soll.
- E2E-Reihenfolge per boundingBox() prüfen, nicht per scrollWidth (App-Shell clippt overflow-x); Viewport 375x812 mitprüfen.
- Routing-Tabelle bleibt ASCII-only (Maschinen-Parser `resolve-phase-routing.sh`); Ampel-Emoji 🟢 ist im Analyse-Block ok, nicht in der Tabelle.
