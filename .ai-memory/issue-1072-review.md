# Issue 1072 — Review-Phase / Kreuzverhör (2026-08-27)

## Erledigt
- MODE = Kreuzverhör (kein `<!-- ai-review -->`-Kommentar vorhanden), Closing-Issue #1072 vorhanden (AKs aus KI-ANALYSE-Block gelesen).
- Vollständige Diff-Prüfung: 4 Dateien, +279/-83, 2 Commits (`fe653e00` rote Tests, `a3968cac` feat).
- Separation of Duties verifiziert: `git diff fe653e00 a3968cac -- frontend/e2e/issue-1072-deadline-group.spec.ts` ist leer — Spec-Tests unverändert grün gezogen.
- Kein Test-Pflege-Bedarf: grep über `frontend/src/components/*.test.tsx` + `frontend/e2e/` zeigt keine Assertions auf die alte Feldreihenfolge (TaskForm.test.tsx:476-511 arbeitet per `getByLabelText`, ordnungssagnostisch); einziger `auto-delete-toggle`-e2e ist die neue 1072-Spec selbst.
- Custom-Styling-Justification im PR-Body vorhanden (div+grid statt KolFieldset, Abstand statt Rahmen) → kein KoliBri-first-Finding.
- CI geprüft: verify/precheck/e2e(4) pass, e2e(1-3) pending, review pending (= dieser Lauf).
- TITLE GATE ausgeführt: alter Titel „Aufgaben-Form Deadline-Felder gruppieren (#1072)" → `feat(frontend): group deadline fields in task form (#1072)` (Conventional Commits, 58 Zeichen).
- Inline-Review gepostet (event=COMMENT, review id 5045487954): 1 Finding F1 in TaskForm.tsx:874.
- Sammelkommentar ERSTELLT (noch nicht vorhanden): https://github.com/deleonio/priority-pilot/pull/1074#issuecomment-5445001332 (comment id 5445001332), Verdict needs-fixup, Review-Typ Kreuzverhör.
- Keine Labels gesetzt, kein Code geändert.

## Relevante Stellen
- `frontend/src/components/TaskForm.tsx:874` — F1: Else-Zweig des `isSeriesMode`-Ternärs umschließt nach dem Move genau ein Element (`KolInputDate` „Deadline (optional)") in einem leeren `<>…</>`-Fragment; Serie-Zweig (:836-872) braucht sein Fragment weiterhin.
- `frontend/src/app.css:1105-1112` — `.deadline-group { display: grid; gap: 0.75rem; }`.
- `frontend/src/app.css:955-960` — `.form-grid` einspaltig, `gap: var(--pp-gap-base)` = 1rem (app.css:119) → Gruppen-Gap 0.75rem < 1rem trägt die visuelle Nähe; Gruppen-div ist daher sicher ein Grid-Item.
- `frontend/e2e/issue-1072-deadline-group.spec.ts` — 4 Tests decken AK1-AK4 (375×812 per Bounding-Box inkl. `x + width ≤ 375`), tests können real fehlschlagen (vorher: Testid fehlte + Adresse zwischen Deadline und Schalter).

## Annahmen
- AK1 „enthält genau Deadline + Schalter": Test prüft Enthaltensein beider + `Adresse (optional)` count 0, aber nicht, dass sonst kein Feld in der Gruppe liegt — als ausreichend gewertet (Abschlussprüfung auf „keine weiteren Kinder" wäre am Shadow-DOM-Tag-Set brittel).
- Edit-Formular nicht separat getestet: Ziel im Spec nennt „Anlegen und Bearbeiten", aber beide nutzen dieselbe TaskForm-Instanz/JSX — kein eigener AK.

## Verworfen
- needs-human: keine Entscheidung offen — Gestaltung (Abstand statt Rahmen/Label) ist im Issue selbst als Optionsmenge („Rahmen, Überschrift oder Abstände") zugelassen und advisory markiert.
- Finding „visuelle Gruppierung zu schwach" (0.75 vs 1rem nur 25 % Differenz): AK1-Messkriterium ist Container/Sichtbarkeit, Gestaltungs-Freiheit im Spec explizit — keine Grundlage für einen Blocker.
- Finding „AK1-Test prüft Exklusivität nicht vollständig" → s. Annahmen, tautologischer Aufwand.

## Offen
- F1 offen (fixup): Fragment in TaskForm.tsx:874 auflösen. Verdict needs-fixup → Pipeline setzt Label + startet Fixup-Phase.

## Nächster Schritt
- Fixup-Phase: einzeilige Bereinigung (Fragment auflösen, `KolInputDate` direkt als Else-Wert), `npx playwright test e2e/issue-1072-deadline-group.spec.ts` im frontend-Verzeichnis gegenprüfen; danach Fixup-Nachweis-Review (MODE = Fixup-Verifikation, Sammelkommentar id 5445001332 PATCH-en, F1 nach „Behobene Anmerkungen" verschieben).

## Fallstricke
- Sammelkommentar ist CREATE gewesen, nicht PATCH — nächste Runde per `gh api repos/{owner}/{repo}/issues/1074/comments` nach `<!-- ai-review -->` filtern und comment id 5445001332 aktualisieren; Finding-Nummern stabil lassen (F1 bleibt F1).
- `gh pr checks` zeigt die eigenen Review-Runs als `review pending` — kein Grund zu warten; Verdict-Kanäle (Datei + letzte Ausgabezeile) sind massgebend.
- PR-Titel wurde in dieser Runde geändert (Titel-Gate); Merge-Commit-Titel folgt neuem Conventional-Format.
