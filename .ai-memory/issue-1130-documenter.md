# Issue 1130 — Documenter (Phase 6), Stand 2026-08-30

## Erledigt
- PR 1131 analysiert: `gh pr view 1131 --json ...` + `gh pr diff 1131` gelesen.
- `/tmp/doc.json` geschrieben, `jq .` validiert.
- Titel bereits konform (conventional commits, ≤72 Zeichen) → `title` leer.
- Klassifikation: `internal` (Refactoring + Tests, kein Nutzerimpact).
- 7 relevante Dateien gelistet, Issue `Closes #1130` verknüpft.

## Relevante Stellen
- `server/src/express/http-error.ts` — neues Zentralmodul (sendError, handleWriteError, parseId).
- `server/src/express/http-error.test.ts` — 9 Unit-Tests für das neue Modul.
- `server/src/express/routes/{tasks,series,scores,llmProviders,geoConfig,lektorat,pillarAdvisor,pillars,push,suggestPillars}.ts` — 9 Routendateien, lokale Kopien durch Import ersetzt.
- `server/src/express/index.ts` — 3 Inline-500er durch sendError ersetzt.

## Annahmen
- Kein Nutzerimpact → `internal` korrekt (keine API-Vertragsänderung, bestehender error-contract.test.ts unverändert grün).
- `title_reason` leer weil Titel bereits konform.

## Verworfen
- Klassifikation `improved` — kein Funktionszuwachs, nur Code-Organisation.
- Klassifikation `fixed` — kein Bugfix.

## Offen
- -

## Nächster Schritt
- Dokumentation abgeschlossen; keine weitere Aktion für dieses Ticket.

## Fallstricke
- `title_reason` nur bei Rename auszufüllen; leerer String + leerer title_reason ist der reguläre Fall für bereits konforme Titel.