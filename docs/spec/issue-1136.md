# Auth-Härtung: kein Dauerspinner nach Google-Authentifizierung (#1136)

**Stand:** 2026-08-31

Nach dem Redirect aus dem Google-OAuth-Flow kann die App im Lade-Spinner hängen: `checkAuth()`
fragt `GET /api/v1/auth/me` ohne jede Zeitgrenze ab — antwortet der Server nicht (oder dauert es
zu lang), bleibt `Root.tsx` dauerhaft in `loading`/`silentPending` und der Nutzer sieht endlos
„Authentifizierung wird geprüft …". Zudem leitet der manuelle OAuth-Pfad bei einem Fehler bislang
auf die rohe JSON-Route `/auth/error` statt auf die im Frontend bereits verdrahtete
Fehler-Weiche `/?error=<code>`. Scope ist der Bugfix O1 (bindende Entscheidung, 2026-08-31) —
kein Profil-Erstellungs-Flow und keine Säulen-Parität (separates Folge-Ticket).

## Timeout des Auth-Checks (AK1)

- `checkAuth()` bricht einen hängenden `/api/v1/auth/me`-Request nach **30 s** ab — der Aufruf von
  `fetch` erhält ein `AbortSignal` aus `AbortSignal.timeout(30000)`; das Signal wird an genau
  diesen einen Request gebunden (kein globaler Timer ohne Abort).
- Löst das Signal ab, rejected `checkAuth()` (Abort-Fehler) statt sich auf ewig zu warten.
- `Root.tsx` verlässt daraufhin `loading`/`silentPending` und rendert den bestehenden Fehler-State
  (`role="alert"`, Text nennt „Seite neu laden" als manuellen Ausweg) statt des Spinners.
- Der 30-s-Grenze gilt nur für den `/auth/me`-Check. Die Google-Top-Level-Navigation selbst ist
  clientseitig nicht abbrechbar (Entscheidung 3, mit O1 abgenickt).

## OAuth-Fehler im manuellen Login (AK2)

- Ein OAuth-Fehler im **manuellen** Pfad (kein `silentPending` in der Session) leitet auf
  `/?error=<code>` um — nicht mehr auf `/auth/error`. LoginPage rendert dafür bereits die passende
  Meldung aus `ERROR_MESSAGES` (`access_denied`, `invalid_email`, Fallback „unbekannter Fehler").
- Der **stille** Pfad bleibt unverändert: Interaktionsfehler mit `silentPending` leiten weiterhin
  auf `/?silent=unavailable` (Loop-Guards von #396 dürfen nicht ausgehebelt werden).
- Die Route `GET /auth/error` bleibt als API-Fallback erhalten (rohes JSON 400) — sie wird vom
  failureRedirect nicht mehr adressiert.

## Kein Auto-Retry, keine Schleife (AK3)

- Nach dem Fehler erfolgt kein automatischer zweiter Versuch: `checkAuth()` läuft pro Seite genau
  einmal, es gibt keinen zweiten Redirect auf `/auth/google/silent` und keine Weiterleitung auf
  Google ohne Nutzerklick.
- Die Guards `shouldAttemptSilentLogin` (`?silent=unavailable`, `?error=`, „pp_just_logged_out",
  „pp_silent_attempted") bleiben unverändert intakt — insbesondere zeigt `?error=…` die
  Login-Seite mit Fehlermeldung, ohne einen stillen Versuch zu starten.

## Neu-Nutzer-Sign-up-Pfad (AK4)

- E2E deckt den Pfad „erster Login → App/Dashboard erreichbar, kein Dauerspinner" mit einer echten
  Backend-Session ab: Session-Erzeugung über `POST /auth/test-login` (nur `NODE_ENV=test`
  registriert), danach zeigt `/` das Dashboard ohne Spinner — auch auf mobilem Viewport (375 px).
  Ein echter Google-Zyklus ist in CI nicht durchlaufbar; die Browser-Level-Mock-Variante
  („authentifiziert sieht Haupt-App") ist bereits durch `login.spec.ts` AK4 abgedeckt.

## Tests

| AK      | Test                                                                                                    | Datei                                      |
| ------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| AK1     | Unit: `AbortSignal.timeout(30000)` wird an den `/auth/me`-Fetch gebunden; Abbruch → Rejection           | `frontend/src/lib/auth.test.ts`            |
| AK1/AK3 | Render-Test: Abbruch → Fehler-Alert statt Spinner; genau ein `checkAuth`-Aufruf, kein Redirect          | `frontend/src/Root.test.tsx`               |
| AK3     | Render-Test: `?error=` → LoginPage mit Alert, kein stiller Versuch (Regression, Guard)                  | `frontend/src/Root.test.tsx`               |
| AK2     | API-Test: Callback ohne Session → 302 auf `/?error=…` (nicht `/auth/error`, nicht `silent=unavailable`) | `server/src/express/auth.test.ts`          |
| AK2     | API-Test-Guard: `GET /auth/error` bleibt als JSON-Fallback (400)                                        | `server/src/express/auth.test.ts`          |
| AK2     | E2E `?error=`-Meldung + Mobile 375 px bereits vorhanden → Dedup, kein neuer Test                        | `frontend/e2e/login.spec.ts` AK3a/AK5      |
| AK4     | E2E: Session via `/auth/test-login` → Dashboard ohne Spinner, 375 px                                    | `frontend/e2e/google-signup.spec.ts` (neu) |

## Impl-Vorbehalte (außerhalb dieses Spec-PRs)

- `failureRedirect` hat **zwei** Stellen (`server/src/express/routes/auth.ts:179` und `:192` im
  `session.regenerate`-Fehlerfall) — beide müssen auf den manuellen Fehlerpfad umgestellt werden.
  Der API-Test erreicht nur die failureRedirect-Stelle; der regenerate-Fehlerfall ist ohne
  injizierbaren Session-Fehler nicht deterministisch testbar.
- Für AK4 muss die E2E-Webserver-Umgebung (`frontend/playwright.config.ts`) das Backend mit
  `NODE_ENV=test` und einer erlaubten Test-E-Mail (`GOOGLE_ALLOWED_EMAILS`) starten — sonst ist
  `/auth/test-login` nicht registriert bzw. lehnt ab.
