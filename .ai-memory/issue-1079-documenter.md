# Issue/PR 1079 — Documenter (Phase 6), Stand 2026-08-28

## Erledigt
- PR-Metadaten geladen (`gh pr view 1079 --json …`): Titel, Body, 19 Files, Label `ai:reviewed`, Author deleonio, mergedAt 2026-08-28T19:25:03Z.
- PR-Diff geladen (`gh pr diff 1079`, 30.3 KB — Preview gelesen, Volltext in tool-results).
- Titel compliant: `fix(security): rate limiting, csrf protection, workflow permissions` — Conventional Commits, English, lowercase, ≤72 Zeichen → `title` leer.
- Klassifikation: `fixed` (Security-Härtung: Rate-Limiting, CSRF, Workflow-Permissions, URL-Check-Härtung — primär Fehlerbehebung auf Code-Scanning-Alerts).
- `/tmp/doc.json` geschrieben und mit `jq` verifiziert.
- Phasen-Notiz geschrieben.

## Relevante Stellen
- `server/src/express/csrf.ts` — NEU: CSRF-Middleware (csrf-csrf v4, Double-Submit-Cookie, Produktions-Gate).
- `server/src/express/index.ts` — Registrierung von CSRF-Middleware hinter Session + cookie-parser.
- `server/src/express/routes/auth.ts` — Rate-Limiting 30 req/min hinzugefügt.
- `server/src/express/routes/pillars.ts` — Rate-Limiting 120 req/min hinzugefügt.
- `frontend/src/api.ts` — CSRF-Token-Fetch + openapi-fetch `client.use`-Middleware für schreibende Aufrufe.
- `server/src/express/csrf.test.ts` — NEU: CSRF-Integrationstest (Produktionsmodus, Token-Ausstellung, 403, Durchlass).
- `frontend/src/api.test.ts` — Frontend-CSRF-Middleware-Tests (onRequest, 403-Cache-Invalidierung, Logout-Cache-Clear).
- `.github/workflows/ci.yml` (+ ci-multi-provider.yml, tailscale-test.yml) — `permissions: contents: read` top-level.

## Annahmen
- Kein verlinktes Issue mit „Closes #" — PR behebt Code-Scanning-Alerts direkt, kein Tracking-Issue.
- `type/scope = feat/server` aus dem Aufruf-Input ist ein CI-Metadatum; die tatsächliche Klassifikation ergibt sich aus dem PR-Inhalt (`fixed`), da der PR Security-Lücken schließt.

## Verworfen
- Klassifikation `improved` — zwar wird die Sicherheit erweitert, der Anlass ist aber das Schließen von Code-Scanning-Alerts (Fehlerbehebung), und der PR-Titel sagt selbst `fix`.
- Klassifikation `internal` — hat deutlichen Nutzer-Impact (Rate-Limiting + CSRF in Produktion).

## Offen
- -

## Nächster Schritt
- Phase abgeschlossen; `/tmp/doc.json` liegt für den Aufrufer.

## Fallstricke
- `.ai-memory/MEMORY.md` ist in der File-Liste des PRs (9 Additions) — NICHT in die `files`-Liste des Outputs aufnehmen (interne CI-Note, kein Nutzer-relevanter File).
