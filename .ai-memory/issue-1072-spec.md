# Issue 1072 — Spec-Phase (2026-08-27)

## Erledigt
- Branch `feat/issue-1072-deadline-group` von `main` erstellt; Commit `fe653e00` „test: red spec tests for #1072" gepusht.
- Spec neu angelegt: `docs/spec/issue-1072.md` (Ziel/IST/Soll/Schritte/Erwartetes Ergebnis/Gestaltung aus KI-UX/Abgrenzung).
- Rote Tests: `frontend/e2e/issue-1072-deadline-group.spec.ts` — 4 Tests (AK1 Gruppen-Container, AK2/AK3 Reihenfolge Task-Modus, AK3 Serie-Modus, AK4 375x812 inkl. `x+width ≤ 375`).
- Draft PR #1074 erstellt, Titel = Issue-Titel wörtlich + „(#1072)", Body mit „Closes #1072". `gh pr view` bestätigt: nr 1074, draft true.
- Keine Labels gesetzt, kein Ping-Kommentar.

## Relevante Stellen
- `docs/spec/issue-1072.md` — der Contract für Phase 4 (AK1-AK4 + Gestaltungsvorgabe Abstand+Label à la `.pillar-editor`).
- `frontend/e2e/issue-1072-deadline-group.spec.ts` — Selektoren: `getByTestId('deadline-group')`, `getByLabel('Deadline (optional)')`, `kol-input-checkbox.auto-delete-toggle`, `getByLabel('Adresse (optional)')`, Serie-Switch `getByTestId('mode-switch')`.
- `frontend/src/components/TaskForm.tsx:873-934` — umzubauender JSX-Abschnitt (Deadline → Adresse → Schalter → Alert).
- `frontend/e2e/issue-1061-task-address.spec.ts` / `series-in-taskform.spec.ts:50-59` — Vorbilder für openForm/modeSwitch-Helfer.

## Annahmen
- Gruppen-Testid heißt `deadline-group` (Analyse-Block schlägt sie vor); Phase 4 muss exakt diesen `data-testid` setzen, sonst bleiben die Tests rot.
- Serie-Modus: Gruppe enthält Startdatum/Rhythmus + Schalter (Adresse draußen) — AK3-Halbsatz so interpretiert.
- KolInputDate/KolCombobox Labels sind per `getByLabel` auffindbar (in 1061/1063-Specs bewiesen); `kol-input-checkbox` trägt die Klasse `auto-delete-toggle` am Host.

## Verworfen
- jsdom-Test in `TaskForm.test.tsx` — jsdom rendert KoliBri-Hosts ohne Layout; Reihenfolge/Gruppierung nur per e2e messbar (vgl. Kommentar in issue-1061-Spec).
- Test auf bedingten KolAlert in der Gruppe — Verhalten existiert bereits und ist funktional, kein eigener AK; würde dedup gegen bestehende #546-Abdeckung verstoßen.
- Playwright-Lauf zur Rot-Verifikation in dieser Sandbox — kein Chromium installiert (Memory 08-20); Rot-Zustand folgt zwingend daraus, dass `deadline-group`-Testid nicht existiert.

## Offen
- `gh pr view --json closingIssuesReferences` liefert für DRAFT-PRs `[]` — „Closes #1072" steht im Body und greift erst beim Ready-Stellen/Merge. Kein Blocker.

## Nächster Schritt
- Impl-Phase (Routing: sonnet/medium): JSX-Reihenfolge in TaskForm.tsx ändern (Deadline+Schalter+Alert in `div.deadline-group` mit `data-testid="deadline-group"`, Combobox danach; auch im Serie-Zweig), CSS-Gruppe à la `.pillar-editor` (app.css:1106), dann die 4 Tests grün ziehen.

## Fallstricke
- `getByLabel('Deadline (optional)')` ist im Serie-Modus hidden (bestehendes AK4-Verhalten #1063) — AK1/AK2-Tests daher bewusst nur im Task-Modus.
- Bounding-Box statt scrollWidth (App-Shell clippt overflow-x); Toggle per Klassen-Selektor statt `getByRole('checkbox')` — es gibt mehrere Checkboxen (mode-switch).
- Prettier meckert über unformatierte e2e-Datei → vor Commit `prettier --write` (erledigt).
