# Review PR #1079 (fix/security-code-scanning) — Kreuzverhör Runde 1

## Erledigt
- MODE bestimmt: kein `<!-- ai-review -->`-Kommentar vorhanden → Kreuzverhör (Erstrunde).
- Kein Closing-Issue (`closingIssuesReferences: []`) → „Review ohne Issue", PR-Beschreibung ist massgebend.
- Vollständigen Diff gelesen (13 Dateien, +256/−3): Rate-Limiter auth.ts/pillars.ts, csrf.ts + index.ts-Registrierung, Workflow-Permissions, csrf.test.ts, api.ts/api.test.ts.
- Verifiziert: `app.set('trust proxy', 1)` existiert (server/src/express/index.ts:53) → Rate-Limit-keyGenerator korrekt hinter Caddy.
- Verifiziert: Session-Shape `req.session.user = { id, … }` (auth.ts:82,124,263; requireAuth.ts:25) → `getSessionIdentifier: req.session?.user?.id` in csrf.ts ist korrekt.
- Verifiziert: startTestServer unterstützt `sessionStore`-Dep (server/src/test/helpers.ts:45-49), setzt NODE_ENV selbst nicht → Produktionstest valide.
- Verifiziert: Workflows nutzen nur checkout/pnpm/setup-node/upload-artifact/tailscale → `contents: read` reicht.
- CI geprüft: e2e-Shard 2 ROT — 1 echter Failure `keyboard-shortcuts.spec.ts:261` AK8 (`expect(created).toBeDefined()` → undefined), Serien-Anlage per Strg+Enter; Spec war NICHT Teil der lokalen Teilmenge des Autors (crud, pillar-crud, issue-930, smoke, series, api-v1-proxy).
- Titel-Gate: PR-Titel war deutsch + 76 Zeichen → umbenannt in `fix(security): rate limiting, csrf protection, workflow permissions` (70 Zeichen, englisch, lowercase).

## Relevante Stellen
- server/src/express/csrf.ts — Double-Submit via csrf-csrf v4, Prod-Gate, getSessionIdentifier session-gebunden.
- server/src/express/index.ts:117-132 — cookie-parser NACH session, /auth/csrf-Route, Prod-Registrierung Protection+ErrorHandler.
- frontend/src/api.ts:39-70 — ensureCsrfToken + client.use-Middleware (onRequest Header, onResponse 403→Cache weg), logout/lektorat manuell.
- server/src/express/csrf.test.ts — echte Produktionstests (Token-Ausstellung, 403 ohne, Durchlass mit Paar→401).
- frontend/e2e/keyboard-shortcuts.spec.ts:261 — der rot laufende Serien-Write-Pfad.

## Annahmen
- e2e-Failure AK8 könnte auch Flake sein (PR-Body nennt series.spec.ts:552 als bekannten Batch-Flake) — Kausalität nicht bewiesen, deshalb als Verifikations-Finding statt Regressions-Beweis formuliert.

## Verworfen
- Bedenken „trust proxy fehlt → Limiter wirkungslos": widerlegt, index.ts:53 setzt es.
- Bedenken „getSessionIdentifier trifft Session-Shape nicht": widerlegt, user.id stimmt.
- Vite-Proxy-Verdacht für /api/v1/auth/csrf: vite.config.ts:23 streift Präfix, Route erreichbar.

## Offen
- F1 (🟡): CI e2e (2) rot, keyboard-shortcuts.spec.ts:261 — Flake-vs-Regression durch CSRF-Middleware klären (Spec lokal laufen lassen, Shard re-run).
- F2 (🟡): Frontend-CSRF-Middleware (api.ts) ohne assertion-Test — api.test.ts erweitert nur den Mock (`use: mockUse`), prüft nichts.

## Nächster Schritt
- Runde 1 ABGESCHLOSSEN: Review 5047304052 (2 Inline-Kommentare, IDs 3877339659/3877339664) + Sammelkommentar 5447464222 erstellt, Titel umbenannt, Verdict `needs-fixup` nach /tmp/claude-verdict.
- Fixup-Runde (nächster Lauf): MODE=Fixup-Nachweis — nur Delta ab updatedAt des Sammelkommentars; F1 (e2e-AK8 Flake-vs-Regression) und F2 (Frontend-Middleware-Test) abhaken.

## Fallstricke
- Finding-Nummern stabil halten: F1 = CI/e2e-AK8, F2 = fehlender Frontend-Middleware-Test.
- Keine Labels setzen (Workflow macht das).
- Beim Sammelkommentar: genau EIN `<!-- ai-review -->`-Kommentar anlegen (noch keins vorhanden), Footer `Review-Typ: Kreuzverhör`.
