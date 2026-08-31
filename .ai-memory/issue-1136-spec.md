# Issue 1136 — Spec (Phase 3), Stand 2026-08-31

**ERGEBNIS: Rote Spec-Tests + Spec + Draft-PR.** Rote Tests für AK1–AK4 gemäß Harness-Kommentar
(issuecomment-5473060220, O1-Bugfix). Spec `docs/spec/issue-1136.md` im selben Commit.

## Erledigt
- Branch `ai/harness/1136` fortgeführt; vorher `git merge origin/main` (Branch hing 2 Commits hinter main: Release v0.1.645 + #1139).
- Spec erstellt: `docs/spec/issue-1136.md` (AK1–AK4, Testtabelle, Impl-Vorbehalte).
- AK1 rot: `frontend/src/lib/auth.test.ts` — Test `AC-1136-1`: Spy auf `AbortSignal.timeout` (liefert echtes `timeout(0)`-Signal, weil Node-Abort-Timer Fake-Timern nicht folgen), fetch-Mock resolved nie und rejected auf `abort` → aktuell Timeout nach 5 s (checkAuth übergibt kein Signal). Verifiziert rot.
- AK1/AK3 rot: `frontend/src/Root.test.tsx` (NEU) — `AC-1136-2` (Abort → `role="alert"` mit „neu laden" statt Spinner) und `AC-1136-3` (genau 1 fetch-Aufruf, kein Redirect). Beide rot, weil der Spinner nie endet — exakt der Bug. KolSpin + `./App` via `vi.mock` + `createElement` gestubbt. `AC-1136-4` (`?error=access_denied` → LoginPage-Alert, kein stiller Versuch) ist grüner Guard (Root.tsx:27 existiert bereits).
- AK2 rot: `server/src/express/auth.test.ts` — `GET /auth/google/callback` ohne Session muss 302 auf `/?error=` liefern (aktuell `/auth/error` → rot, verifiziert); zweiter Test: `GET /auth/error` bleibt JSON-Fallback 400 (grüner Guard gegen Entfernung).
- AK4 rot: `frontend/e2e/google-signup.spec.ts` (NEU) — Session via `POST /auth/test-login` → Cookie in Browser-Kontext → `/` zeigt Dashboard ohne Spinner, Viewport 375×667. Rot verifiziert: 404, weil das E2E-Backend nicht mit `NODE_ENV=test` startet (siehe Fallstricke).

## Relevante Stellen
- `frontend/src/lib/auth.ts:8-20` — `checkAuth()`; hier `AbortSignal.timeout(30000)` + Signal an fetch binden.
- `frontend/src/Root.tsx:78-80` — `.catch(() => setAuthState('error'))` existiert; Fehler-State `Root.tsx:95-97` existiert → AK1-Root-Teil ist nur Verdrahtung über die Rejection.
- `server/src/express/routes/auth.ts:179` UND `:192` — beide failureRedirect-Stellen umstellen (nur :179 ist testbar).
- `server/src/express/routes/auth.ts:236-269` — `/auth/test-login` nur bei `NODE_ENV=test`; e2e-Webserver startet ohne → AK4 404.
- `frontend/playwright.config.ts` (webServer env, ~Zeile 60-80) — Impl muss dort `NODE_ENV=test` + `GOOGLE_ALLOWED_EMAILS` setzen (isEmailAllowed liefert bei leerer Allowlist false).
- `frontend/e2e/login.spec.ts` AK3a/AK5 — `?error=`-Meldung + Mobile 375 px bereits vorhanden → Dedup, kein neuer Test.

## Annahmen
- `?error=<code>`-Wert: Test prüft nur Präsenz des Parameters (Google-Code-Durchreichung ist Impl-Freiheit; LoginPage hat Fallback-Meldung für unbekannte Codes).
- Abort-Spy-Muster (echtes `timeout(0)` statt Fake-Timer) akzeptiert als deterministischer Nachweis des 30-s-Limits — die 30000-Assertion steht im Unit-Test (`requestedTimeoutMs`), nicht in Root.
- AK4-Test ist erst nach Impl-Config-Änderung lauffähig; roter Grund ist dokumentiert (404), nicht ein falscher Selektor.

## Verworfen
- E2E für AK2 (`?error=`-Meldung, Mobile) — bereits `login.spec.ts` AK3a/AK5 (Dedup).
- E2E für silent-Loop-Guards — bereits `silent-login.spec.ts` AK3/AK4 (Dedup); neuer AK3-Aspekt (genau 1 checkAuth nach Fehler) sitzt im Root-Unit-Test.
- Fake-Timer für Abort-Test — Node-interne Abort-Timer folgen `vi.useFakeTimers()` nicht (sonst wäre der Test grün-falsch); echtes `timeout(0)` stattdessen.
- Test der `silentPending`-Callback-Verzweigung im API-Test — Session-Marker ist von außen nicht setzbar; Absicherung läuft über Negativ-Assertion (kein `silent=` im manuellen Pfad) + bestehende silent-E2E.
- Test des `session.regenerate`-Fehlerfalls (`auth.ts:192`) — ohne injizierbaren Session-Fehler nicht deterministisch; im PR-Spec als Impl-Vorbehalt vermerkt.

## Offen
- -

## Nächster Schritt
- Impl-Phase: `AbortSignal.timeout(30000)` in `checkAuth()`; failureRedirect an `auth.ts:179` **und** `:192` auf `/?error=<code>`; `frontend/playwright.config.ts`-Webserver-Umgebung (`NODE_ENV=test`, `GOOGLE_ALLOWED_EMAILS`) für AK4.

## Fallstricke
- `docs/spec`-Tabelle wird von Prettier neu formatiert — `npx prettier --write` vor dem Commit ausführen, sonst schlägt der Gate fehl.
- `vi.mock`-Fabriken mit JSX schlagen wegen Hoisting fehl → `createElement` aus `react` verwenden.
- E2E-Backend hat `GOOGLE_ALLOWED_EMAILS=''` → `isEmailAllowed` liefert false; ohne Env-Setzung bleibt `/auth/test-login` auch bei `NODE_ENV=test` auf 401.
- Chromium-Browser waren im Runner-Cache nicht installiert → `npx playwright install chromium` nötig, um E2E lokal zu verifizieren (~115 MB).
- Playwright-`baseURL` ist als Test-Fixture destrukturierbar; Set-Cookie via `login.headersArray()` (nicht `.headers()`, dort sind Multiple/Set-Cookie nicht einzeln lesbar).
