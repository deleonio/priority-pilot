# Issue 1136 — Implement (Phase 4), Stand 2026-08-31T04:35Z

## Erledigt
- **ABGESCHLOSSEN:** Gate komplett grün (format/prettier/lint/knip/test, alle exit 0); Commit `3525db02` gepusht; PR **#1149** review-ready (isDraft=false, OPEN, `Closes #1136`, Body mit Testergebnis-Tabelle + Umsetzungsanmerkungen).
- Draft-PR **#1149** (branch `ai/harness/1136`) übernommen (closingIssuesReferences enthält 1136, `Closes #1136` im Body), `git merge origin/main` (Merge-Commit 5e0002ae) — Spec-Modus, Ampel 🟢, Tests unangetastet.
- AK1 grün: `frontend/src/lib/auth.ts:9-13` — `fetch('/api/v1/auth/me', { signal: AbortSignal.timeout(30_000) })`. Root-Verdrahtung war bereits vollständig (`Root.tsx:78-80` catch → error-State `:96`), keine Root-Änderung nötig.
- AK2 grün: `server/src/express/routes/auth.ts` — Callback-Guard VOR `passport.authenticate`: ohne `req.query.code` → Redirect `/?silent=unavailable` (silent) bzw. `/?error=<code>` (manuell; Google-`error`-Param 1:1 durchgereicht, sonst `login_failed`); failureRedirect `:186` + `session.regenerate`-Fehlerfall `:199` auf `/?error=login_failed` umgestellt. `/auth/error`-Route unverändert als API-Fallback.
- AK2-Zusatz (nicht vorhersehbar): ein nackter Callback-Hit startete bei Passport NEUEN Authorization-Redirect (→ `/o/oauth2/v2/auth`) — der Spec-Test (302 auf `/?error=`) war damit nur über den Guard erreichbar, nicht über failureRedirect allein.
- AK4 grün: `frontend/playwright.config.ts` Backend-WebServer `env.NODE_ENV: 'test'` (registriert `/auth/test-login`); dafür `server/src/express/routes/auth.ts` (test-login-Block): Allowlist-Gate nur wenn Allowlist KONFIGURIERT ist (`hasAllowlist`-Const) — im auth-losen E2E-Backend (`GOOGLE_ALLOWED_EMAILS=''`) sonst 401.
- Alle roten Spec-Tests grün verifiziert: frontend vitest `auth.test.ts` + `Root.test.tsx` 10/10; server `auth.test.ts` 18/18; Playwright `google-signup` + `login` + `silent-login` 13/13.

## Relevante Stellen
- `frontend/src/lib/auth.ts:9-13` — einziger Frontend-Code-Change (Signal an fetch gebunden).
- `server/src/express/routes/auth.ts:179-191` (Guard), `:186`/`:199` (Redirects), `:250-256` (test-login-Allowlist) — Server-Changes.
- `frontend/playwright.config.ts:57-62` — NODE_ENV=test + Begründungskommentar.
- `frontend/src/Root.tsx` — bewusst UNVERÄNDERT (Fehler-Branch + Loop-Guards existierten).

## Annahmen
- `error=login_failed` als Sammelcode ist OK: LoginPage-Fallback „Ein unbekannter Anmeldefehler …“ (Analyse: Code-Durchreichung = Impl-Freiheit).
- `NODE_ENV=test` im E2E-Backend ist wirkungslos außerhalb der test-login-Registrierung (alle Produktionszweige prüfen `=== 'production'`).
- Playwright `webServer.env` mergt mit process.env (PATH bleibt) — beobachtet funktionsfähig.

## Verworfen
- GOOGLE_ALLOWED_EMAILS im E2E-Backend setzen (Spec-Vorschlag) — hätte `isAuthActive()` scharfgeschaltet → 401 auf allen API-Routen → smoke/crud/login/silent-E2E wären kaputt gegangen. Stattdessen NODE_ENV=test + Allowlist-Pass-Through im test-only-Endpunkt.
- Custom-Passport-Callback zur Code-Durchreichung — hätte `req.user`-Setup (`req.logIn`) selbst übernehmen müssen; Guard + `req.query.error`-Durchreichung leistet dasselbe ohne Risiko.
- UI/Layout-Check via Playwright MCP — keine sichtbare UI-Änderung (Fehler-UI/LoginPage unverändert); 375px-Abdeckung läuft über `google-signup.spec.ts` (AK4).

## Offen
- -

## Nächster Schritt
- Phase 5 (Review, `ai:review`): Kreuzverhör von PR #1149; Prüfschwerpunkt = Callback-Guard (neues Verhalten bei Nackt-Hit ohne `code`) + test-login-Allowlist-Pass-Through.

## Fallstricke
- Spec-Test AK2 erreicht failureRedirect NICHT: ohne `code`/`error`-Query param startet die Google-Strategie einen neuen Auth-Redirect (302 auf accounts.google.com) — der Redirect-Erwartung dient der neue Guard, nicht die failureRedirect-Umstellung (die bleibt für den `code`-vorhanden-Austausch-Fehlerfall).
- test-login: `isEmailAllowed` liefert bei LEERER Allowlist `false` (nicht throw) → im pass-through E2E-Backend wäre der Endpunkt immer 401.
- Lokal untracked liegende `issue-1136-{spec,triage}.md` blockieren `git switch` (Branch trackt sie bereits) → beiseite legen, vergleichen, danach lokale Kopie löschen.
