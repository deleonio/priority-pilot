# Issue 1206 — Documenter (Phase 6, PR #1207), Stand 2026-09-03

## Erledigt
- PR #1207 analysiert (`gh pr view` + `gh pr diff`): Titel `feat(frontend): aggregate changelog by category with autolinks`, Autor app/my-github-action-bot, Label `ai:reviewed`, 13 Dateien (Code: changelog.ts neu 112 Z, HelpPage.tsx, app.css, HelpPage.test.tsx, help-changelog.spec.ts neu, package.json/lock; plus docs/spec/issue-1206.md und 5 .ai-memory-Notizen). Body bestätigt Closes #1206 und alle AK1–AK5 inkl. Gate-Ergebnisse.
- `/tmp/doc.json` geschrieben und per `jq empty` validiert: classification `improved`, title leer (Titel compliant, Typ passt), summaries en/de, release_note_en (Endnutzer-Sicht: Kategorien-Gruppierung, klickbare Links, kein Clipping bei 375 px, Versions-Suffix je Eintrag), migration_en leer, 7 files (note_de je), issues = [{ref: "Closes #1206"}].
- Kein `gh pr edit/comment/label` (Review-Tier, Code tabu).

## Relevante Stellen
- `frontend/src/lib/changelog.ts` — Kern des Features (Aggregation + Versions-Suffix).
- `frontend/src/components/HelpPage.tsx` — Rendering-Umbau auf Sektion je Kategorie + remark-gfm.
- `frontend/src/app.css` — Link-Styling/A11y (:focus-visible) + neue Kategorie-Klassen.
- `frontend/src/components/HelpPage.test.tsx` / `frontend/e2e/help-changelog.spec.ts` — AK1–AK4-Abdeckung.

## Annahmen
- classification `improved` statt `new`: User-sichtbare Verbesserung eines bestehenden Tabs (#1190), kein neues Feature/Endpunkt.
- Linked-Issue-Kontext nur #1206 (Body „Closes #1206", kein weiteres Fixes/Closes im Body); 1206 als Kontext-Ticket vom Aufruf genannt.

## Verworfen
- Titel-Rename — existierender Titel ist CC-compliant und Typ `feat(frontend)` passt (per Aufruf bestätigt) → title/title_reason leer.
- `.ai-memory/*`- und pnpm-lock.yaml-Dateien in `files` — nicht unter den 3-8 relevantesten (lock generiert, Notizen Prozess-Artefakte); docs/spec aufgenommen als Konztrat-Doku.
- classification `new` — Changelog-Tab existierte bereits durch #1190.

## Offen
- -

## Nächster Schritt
- Phase beendet; Aufrufer liest `/tmp/doc.json` (Changelog/Release-Notes).

## Fallstricke
- HelpPage.test.tsx-Änderungen enthalten bewusste #1190-Assertions-Änderungen (h2-je-Release → Kategorien) — nicht als Regression dokumentieren.
- Write-Tool auf /tmp braucht Freigabe in dieser Sandbox — Heredoc über Bash funktioniert und `jq empty` validiert.
