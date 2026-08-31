# Issue 1140 — Documenter (Phase 6), Stand 2026-08-31

## Erledigt
- PR 1140 analysiert: Renovate-PR, pins 4 deps (^ entfernt), 3 Dateien geändert.
- `/tmp/doc.json` geschrieben, `jq .` bestanden.
- Phasen-Notiz geschrieben.

## Relevante Stellen
- `frontend/package.json:25` — react-router-dom ^6.30.6 → 6.30.6
- `server/package.json:20-21` — cookie-parser ^1.4.7 → 1.4.7, csrf-csrf ^4.0.3 → 4.0.3
- `server/package.json:34` — @types/cookie-parser ^1.4.10 → 1.4.10
- `pnpm-lock.yaml` — 4 Specifier-Zeilen angepasst

## Annahmen
- Keine verlinkten Issues (Body enthält kein "Closes #" / "Fixes #").
- Renovate-Bot-PR, Autor = app/my-github-action-bot.

## Verworfen
- Titel "fix(deps): pin dependencies" beibehalten — Typ "fix" passt nicht zu classification "internal" → neuer Titel "chore(deps): pin dependencies".
- Scope "server" aus dem Input — Frontend ebenfalls betroffen, daher Scope "deps".

## Offen
- -

## Nächster Schritt
- Abgeschlossen.

## Fallstricke
- Keine.
