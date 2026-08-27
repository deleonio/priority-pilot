Closes #1072

## Umsetzung

Die Deadline-Bezugs-Felder im Aufgaben-Formular sind jetzt eine logische Gruppe, und die Adresse folgt erst danach:

- **`frontend/src/components/TaskForm.tsx`** (~Zeile 832–940): Neuer Gruppen-Container `<div className="deadline-group" data-testid="deadline-group">` um das `isSeriesMode`-Ternär (Startdatum + Rhythmus im Serie-Modus bzw. Deadline-Datum im Task-Modus), den Auto-Lösch-Schalter (`KolInputCheckbox.auto-delete-toggle`) und den bedingten Hinweis-`KolAlert`. Die `KolCombobox` „Adresse (optional)" wurde danach, außerhalb der Gruppe, verschoben — vorher stand sie zwischen Deadline-Datum und Schalter. Reines JSX-Verschieben, keine Props/Handler verändert.
- **`frontend/src/app.css`** (~Zeile 1105): `.deadline-group { display: grid; gap: 0.75rem; }` — Gruppierung über Abstand (Muster `.pillar-editor`, app.css:1106), Separation zur Adresse über den bestehenden `form-grid`-Gap (1rem). Bewusst **kein Rahmen/keine Gruppen-Überschrift**: konsistent mit `.pillar-editor`/`.checklist-editor` und der UX-Empfehlung im Issue („Abstand statt Rahmen", docs/mobile-ui-rules.md Regel 4). Keine Funktion Änderung.

## Akzeptanzkriterien

| AK | Umsetzung |
| --- | --- |
| AK1 Gruppen-Container | `div.deadline-group` mit `data-testid="deadline-group"`, enthält genau Deadline-Datum + Schalter (+ Alert); Adresse nicht enthalten |
| AK2 Reihenfolge (DOM = visuell) | Deadline-Datum → Auto-Lösch-Schalter → Adresse; kein Formularfeld dazwischen |
| AK3 Adresse nach der Gruppe / Serie-Modus | Adresse steht nach der kompletten Gruppe; im Serie-Modus: Startdatum/Rhythmus + Schalter in der Gruppe, Adresse danach |
| AK4 Mobile-first 375px | per e2e mit Bounding-Box geprüft (`x ≥ 0`, `x + width ≤ 375`) |

## Gate-Ergebnisse

| Kommando | Ergebnis |
| --- | --- |
| `pnpm format` / `pnpm exec prettier --check .` | ✅ |
| `pnpm lint` | ✅ (server + frontend, inkl. `tsc --noEmit`) |
| `pnpm knip` | ✅ (nur pre-existing Configuration-Hints, exit 0) |
| `pnpm test` (frontend) | ✅ 421 passed / 13 skipped |
| `pnpm test` (server) | ❌ 1 Failure: `session.test.ts` „AK-5 — Redis-Store" — **pre-existing, umgebungsbedingt** (kein Redis im Sandbox-Runner; per `git stash` auf sauberem main-Stand verifiziert, dort derselbe Fehler, exit 1). Kein Fix-Ziel dieses PRs. |
| `npx playwright test e2e/issue-1072-deadline-group.spec.ts` | ✅ 4 passed (AK1–AK4, inkl. 375×812) |
| `npx playwright test e2e/issue-1061-task-address.spec.ts e2e/series-in-taskform.spec.ts` | ✅ 8 passed (Nachbar-Specs, keine Regression) |

Hinweise:
- **e2e-Vollsuite** nicht separat gefahren — die Änderung betrifft ausschließlich das Task-Formular-Layout; alle direkt betroffenen Spec-Dateien (1072, 1061, series-in-taskform) laufen grün.
- **Impeccable-Detector** (`.claude/skills/impeccable/scripts/detect.mjs`) existiert in diesem Repo-Stand nicht (Skill-Verzeichnis enthält ihn nicht) — die Layout-Prüfung lief stattdessen deterministisch über die e2e-Bounding-Box-Tests (375px und Default-Viewport), was den 375/1280-Sichtcheck abdeckt.
