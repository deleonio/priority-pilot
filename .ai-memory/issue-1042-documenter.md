# Issue #1042 — Documenter (Phase 6/7)

## Erledigt
- PR #1044 analysiert (Diff, Metadaten, Spec-Memory gelesen).
- Klassifikation: `fixed` — Bugfix für fehlendes responsive Layout auf Desktop (Button füllte volle Breite statt inhaltsbreit).
- Titel-Prüfung: `fix(frontend): make dashboard start-task button content-width on desktop` bereits konform → `title` leer.
- Output erstellt (`/tmp/doc.json` konnte wegen Permission-Blockade nicht geschrieben werden — JSON steht stattdessen in dieser Notiz).

## Relevante Stellen
- `frontend/src/app.css:528-537` — neue CSS-Regel `.dashboard-next-task-content kol-button` (Kern der Umsetzung).
- `frontend/e2e/issue-1042-dashboard-start-button.spec.ts` — 3 E2E-Tests für AK1-AK3.
- `docs/spec/issue-1042.md` — Spec-Dokumentation mit Ziel, Root-Cause und 4 Akzeptanzkriterien.

## Annahmen
- Titelformat ist bereits Conventional Commits (`fix(frontend): ...`), daher keine Umbenennung nötig.
- Klassifikation als `fixed` (nicht `improved`) weil es einen offensichtlichen Layout-Fehler korrigiert, kein UX-Enhancement.

## Verworfen
- Keine Alternative zu `/tmp/doc.json` — Datei konnte wegen Permission-Blockade nicht geschrieben werden. Output stattdessen hier im Memory und im Terminal.

## Offen
- `/tmp/doc.json` konnte nicht geschrieben werden (Permission denied). Output steht in dieser Notiz.

## Nächster Schritt
- JSON-Output steht unten — für Changelog/Release Notes verwenden.

## JSON-Output (an Stelle von `/tmp/doc.json`)

```json
{
  "classification": "fixed",
  "title": "",
  "title_reason": "",
  "summary_en": "This fix corrects the responsive layout of the 'Jetzt starten' button in the dashboard signal panel. Previously, the button filled the full container width on all viewports due to `align-self: stretch` in the flex container. The new CSS rule `.dashboard-next-task-content kol-button` switches to `align-self: flex-start` at 768px breakpoint, making the button content-width and left-aligned on desktop while keeping mobile behavior unchanged. Implemented as CSS-only solution without TypeScript changes, following the pattern established by `.settings-action-btn` from #1017.",
  "summary_de": "Diese Korrektur behebt das responsive Layout des 'Jetzt starten'-Buttons im Dashboard-Signal-Panel. Bisher füllte der Button auf allen Viewports die volle Container-Breite durch `align-self: stretch` im Flex-Container. Die neue CSS-Regel `.dashboard-next-task-content kol-button` schaltet ab 768px auf `align-self: flex-start`, wodurch der Button auf Desktop inhaltsbreit und linksbündig dargestellt wird, während das Mobile-Verhalten unverändert bleibt. Umsetzung als reine CSS-Lösung ohne TypeScript-Änderungen, analog zum Muster `.settings-action-btn` aus #1017.",
  "release_note_en": "The 'Jetzt starten' button on the dashboard now displays at its actual content width on desktop screens instead of stretching across the full panel width, making it easier to scan the signal panel at a glance.",
  "migration_en": "",
  "files": [
    {
      "path": "frontend/src/app.css",
      "note_de": "CSS-Regel `.dashboard-next-task-content kol-button` ergänzt: mobil `align-self: stretch`, ab 768px `align-self: flex-start`"
    },
    {
      "path": "frontend/e2e/issue-1042-dashboard-start-button.spec.ts",
      "note_de": "E2E-Tests für AK1-AK3 (mobil volle Breite, desktop inhaltsbreit+linksbündig, Touch-Target ≥44px)"
    },
    {
      "path": "docs/spec/issue-1042.md",
      "note_de": "Spec-Dokumentation mit Ziel, Root-Cause und 4 Akzeptanzkriterien"
    },
    {
      "path": ".ai-memory/MEMORY.md",
      "note_de": "Learning-Eintrag zu pnpm/playwright test:e2e Filter-Problem"
    }
  ],
  "issues": [
    {
      "ref": "Closes #1042",
      "note": "Dashboard 'Jetzt starten'-Button responsiv machen: mobil volle Breite, desktop inhaltsbreit"
    }
  ]
}
```

## Fallstricke
- Permission-Blockade bei `/tmp/doc.json` — Output stattdessen im Memory speichern und dem Nutzer zur Verfügung stellen.
