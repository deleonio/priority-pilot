# Issue 1168 / PR #1170 — Review (Kreuzverhör, Runde 1), Stand 2026-09-02T07:24:00Z

**ERGEBNIS: VERDICT needs-fixup.** Marker `<!-- ai-review -->` fehlte → Initial-Cross-Examination der ganzen PR. Titel war nicht Conventional-Commits-konform → umbenannt. Feature-Umsetzung selbst sauber, aber 2 neue e2e-Tests rot (testfremde Fixture-Bugs) → Gate-Regel „rote Tests verhindern 🟢" greift.

## Erledigt

- Marker-Suche (`gh api .../issues/1170/comments`, Filter `<!-- ai-review -->`): kein Treffer → MODE Kreuzverhör.
- PR-Diff komplett gelesen (810 Zeilen, `/tmp/pr1170.diff`), Harness-Marker-Kommentar auf Issue #1168 gelesen (AK1–AK8 + TF1–TF8, Ampel 🟢 aus Analyse+UX+Spec+Impl-Phasennotizen).
- Zwei Kernbehauptungen des PR-Body/Impl-Notiz verifiziert (nicht blind übernommen):
  - `server/src/models/task.ts:113-116` — `priority` Sequelize-Validierung `max: 5` bestätigt.
  - `server/src/express/routes/tasks.ts:152-159` — Route validiert zusätzlich `priority > 5` → 400 mit Meldung.
  - `frontend/src/api.ts:192-193` — `api.updateTask` nutzt `client.PATCH`, nicht PUT — bestätigt TF6-Diagnose.
  - `frontend/src/App.tsx:431-443` (`completeTask`) ist feldgleich zu `handleDoneToggle` (Z.382-398) — kein Feldverlust, etabliertes Muster.
  - `deleteFallbackRef` (App.tsx:304, `<main className="app">`) als `fallbackFocusRef` für `CompleteTaskDialog` — identisches Wiederverwendungsmuster wie beim Delete-Dialog, kein neuer Bug.
  - `grep onStartTask frontend/src/` — nur noch 2 Kommentar-Referenzen in `Dashboard.test.tsx`, keine Code-Regression.
- Review mit 2 Inline-Findings gepostet (`gh api .../pulls/1170/reviews`, event=COMMENT, review id `5086757485`): Zeile 58 (TF3 Prioritäts-Seed >5) und Zeile 114 (TF6 PUT-statt-PATCH-Mock) in `frontend/e2e/issue-1168-dashboard-done-button.spec.ts`.
- Titel-Gate: alter Titel „Dashboard: Button 'Jetzt starten' durch 'Erledigt' mit Bestätigungsdialog ersetzen (#1168)" war Deutsch/nicht Conventional-Commits → `gh pr edit 1170 --title "feat(frontend): replace dashboard start button with done dialog"`.
- Sammelkommentar `<!-- ai-review -->` neu erstellt (`gh pr comment 1170`, `https://github.com/deleonio/priority-pilot/pull/1170#issuecomment-5506004907`): Review-Status 🟡 needs-fixup, 2 offene Findings, Footer „Review-Typ: Kreuzverhör".

## Relevante Stellen

- `frontend/e2e/issue-1168-dashboard-done-button.spec.ts:58` — Finding 1 (Seed-Priorität 9 > max 5).
- `frontend/e2e/issue-1168-dashboard-done-button.spec.ts:114` — Finding 2 (Mock fängt PUT statt PATCH ab).
- `frontend/src/App.tsx:428-443` — `completeTask`, korrekt.
- `frontend/src/components/CompleteTaskDialog.tsx` — neue Komponente, 1:1 nach `docs/spec/issue-1168.md`, keine Findings.

## Annahmen

- Beide Rotursachen sind reine Testfixture-Bugs, keine Produktivcode-Bugs — durch eigene Code-Lektüre (Model+Route+api.ts) verifiziert, nicht nur aus dem PR-Body übernommen.
- Klassifikation „fixable" statt „decision": kein ADR/keine menschliche Entscheidung wird überstimmt, der Fix ist mechanisch (Zahlenwert bzw. HTTP-Methoden-String) und vom Autor selbst bereits vorgeschlagen.

## Verworfen

- 🟢-Verdict trotz roter Tests, weil die Rotursache "testfremd" ist — Skill-Regel kennt nur eine Ausnahme (reines Styling/Layout), die hier nicht greift (AK2/AK4/AK5/AK6 sind funktionale Kernkriterien).
- needs-human — kein Entscheidungs-Finding, kein ADR/Produktfrage betroffen, reine Testkorrektur.

## Offen

- -

## Nächster Schritt

- Fixup-Phase (Label `ai:needs-fixup`): die zwei genannten Testzeilen korrigieren (Priorität ≤5, `'PUT'`→`'PATCH'`), TF3/TF6 grün verifizieren, dann Folge-Review (MODE Fixup-Verifikation, Marker jetzt vorhanden) nur den Diff seit `updatedAt` des Sammelkommentars prüfen.

## Fallstricke

- Marker-Suche lief über `gh api repos/.../issues/1170/comments` (PR-Kommentare liegen unter der Issue-API, nicht `/pulls/.../comments` — das wären nur Inline-Review-Kommentare).
- Beim Bewerten von "testfremd"-Behauptungen im PR-Body: immer selbst nachprüfen (Model-Constraint, Route-Validierung, tatsächliche HTTP-Methode im generierten Client) statt der Selbstdiagnose des Autors blind zu vertrauen — hier stimmte sie, aber genau das war der Prüfschritt.
