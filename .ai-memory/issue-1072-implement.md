# Issue 1072 — Impl-Phase (2026-08-27)

## Erledigt
- Branch `feat/issue-1072-deadline-group` (Draft PR #1074) ausgecheckt; rote Spec-Tests `frontend/e2e/issue-1072-deadline-group.spec.ts` unverändert übernommen.
- `frontend/src/components/TaskForm.tsx` (~:832-940): Gruppen-Container `<div className="deadline-group" data-testid="deadline-group">` um das `isSeriesMode`-Ternär (Startdatum/Rhythmus bzw. Deadline-Datum) + `KolInputCheckbox.auto-delete-toggle` + bedingten `KolAlert`; `KolCombobox` „Adresse (optional)" danach außerhalb der Gruppe verschoben (vorher stand sie zwischen Deadline und Schalter). Funktional null Änderung — reines JSX-Verschieben, Props unangetastet.
- `frontend/src/app.css` (~:1105): `.deadline-group { display: grid; gap: 0.75rem; }` direkt unter `.pillar-actions`, Muster `.pillar-editor` (app.css:1106). Kein Label/Rahmen (Gruppierung via Abstand, form-grid-Gap 1rem trennt zur Adresse) — UX-Empfehlung „Abstand statt Rahmen".
- Chromium installiert (`pnpm exec playwright install chromium`), Gate + e2e laufen.

## Relevante Stellen
- `frontend/src/components/TaskForm.tsx:832-940` — neuer Gruppen-Container + neue Feldreihenfolge (Deadline-Gruppe → Adresse).
- `frontend/src/app.css:1105-1112` — `.deadline-group` (grid, gap 0.75rem).
- `frontend/e2e/issue-1072-deadline-group.spec.ts` — Contract (4 Tests, Selektoren testid `deadline-group`, `getByLabel`, `.auto-delete-toggle`).

## Annahmen
- Gruppen-Absetzung ohne sichtbaren Rahmen/Label genügt AK1 („z.B. durch Rahmen, Überschrift oder Abstände") — Messung im Test ist nur Sichtbarkeit/Enthaltensein.
- Serie-Modus: ganze Feldgruppe (Startdatum+Rhythmus+Schalter+Alert) in `.deadline-group`, Adresse außen — Deckung mit AK3-Test.

## Verworfen
- `fieldset`/`KolFieldset` (KI-UX-Option) — zwei Felder mit eigenen Labels; div+Grid ist BITV-konform und konsistenter zu `.pillar-editor`; hätte Label-Dopplung gerisikiert.
- Gruppen-Überschrift — nicht getestet, kein Issue-AK, would add content; Abstand reicht.

## Offen
- -

## Nächster Schritt
- erledigt: Commit `a3968cac` gepusht, PR #1074 Body erweitert + `gh pr ready` (draft=false, OPEN). Phase abgeschlossen — nächster Schritt ist Review (Kreuzverhör), nicht Impl.

## Fallstricke
- Prettier hat die JSX-Einrückung des verschobenen Blocks komplett neu gesetzt — diff größer als die logische Änderung (95+/83-), nur Umformatierung.
- e2e braucht Chromium-Install in frischer Sandbox (Memory 08-20); gezielt per `npx playwright test e2e/<datei>` im frontend-Verzeichnis (Memory 08-26).
