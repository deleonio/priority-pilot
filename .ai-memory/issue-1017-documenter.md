# Issue #1017 — Documenter PR #1018 (Kreuzverhör) — ABGESCHLOSSEN 🟢

## Erledigt
- PR #1018 analysiert: gh pr diff + gh pr view 1018 (title, body, files, labels, author)
- Issue #1017 Kontext geladen (gh issue view 1017)
- Klassifikation: **improved** (bestehende Funktion erweitert, UX-Verbesserung, kein Breaking Change)
- Titel-Check: Titel bereits konform (`feat(frontend): unify push test and geolocation action buttons`) → title leer gelassen
- /tmp/doc.json geschrieben mit allen Feldern (classification, summaries, release_note, files mit deutschen notes, issues)
- JSON mit `jq .` validiert → gültig

## Relevante Stellen
- `frontend/src/components/SettingsPage.tsx:206` + `:271` — gemeinsame Klasse `settings-action-btn` an beiden KolButton-Instanzen
- `frontend/src/app.css:1422-1438` — Mobile-First-Layout-Regel (mobil stretch, ≥768px flex-start), ersetzt `.push-test-btn`
- `frontend/e2e/settings-action-buttons.spec.ts` — neue e2e-Tests AK2-AK5, Szene mit Fake-ServiceWorker + granted-Geo
- `frontend/src/components/SettingsPage.test.tsx:136-163` — AK1-Klassen-Spiegel-Test
- `docs/spec/issue-1017.md` — Spec-Dokument mit AK1-AK6 und Messtechnik

## Annahmen
- PR-Titel ist bereits Conventional Commits conform (feat/frontend Scope) → kein Vorschlag nötig
- Klassifikation "improved" passt zu UX/Layout-Verbesserung an bestehenden Buttons (keine neue Funktion, kein Bugfix, kein Breaking Change)
- Release Note kann kurz und endnutzerorientiert sein (keine Migration nötig)

## Verworfen
- — (nichts verworfen in dieser Phase)

## Offen
- -

## Nächster Schritt
- Fertig. /tmp/doc.json liegt vor, Rendering übernimmt die nächste Phase (nicht Teil dieses Auftrags).

## Fallstricke
- Deadline-Check vor jedem Schritt: 1787659825 < 1787660393 → Zeit OK
- KEINE Dateiänderungen außer /tmp/doc.json — kein gh pr edit/comment, keine Labels (Workflow übernimmt)
- JSON darf keine Kommentare oder Trailing Commas enthalten — mit jq validiert
