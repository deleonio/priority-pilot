# Issue #2565 — Login: App-Magic-Link verfällt im Browser mit bestehender Session

## Ziel

Ein Magic Link mit App-Marker (`client=app`, #2563) zeigt die Landing „In der App öffnen“ immer —
auch wenn der Browser bereits eingeloggt ist. Heute gewinnt der Zweig `authenticated` in
`AuthenticatedApp` (`frontend/src/Root.tsx:192`, Gate `authState === 'unauthenticated' && magicAppToken !== null`),
die Landing erscheint nie und der Token kann nicht an die App übergeben werden.

## Verhalten

- **AK1:** Bei bestehender Browser-Session (`GET /auth/me` → 200) zeigt `/app/?magic=<t>&client=app`
  die Landing „In der App öffnen“ mit dem Rücksprung `balamentum.app://auth/native?magic=<t>`.
- **AK2:** Ohne Session bleibt das Verhalten aus #2563 unverändert (Landing, kein stiller
  Google-Login) — durch Bestandstests abgedeckt (siehe unten).
- **AK3:** Ohne `client=app` wird der Link wie bisher im Browser eingelöst — durch Bestandstests
  abgedeckt (Verify-Pfad, `?error=`-Fall).
- **AK4:** Der Token wird im Browser in keinem der Fälle eingelöst (kein `POST /auth/magic-link/verify`).

Die Browser-Session bleibt unangetastet: kein Logout, kein Cookie-Eingriff. Die URL-Bereinigung
(`magic`/`client` verschwinden aus der Adressleiste) bleibt wie in #2563.

## Testfälle

- **TF1** (AK1+AK4, Vitest, `frontend/src/Root.test.tsx`, Block „Issue #2563“): Fetch-Mock mit
  200+User auf `/auth/me`, URL `/app/?magic=tok-2565&client=app` → Landing-Link mit
  App-Scheme-href sichtbar; kein `/auth/magic-link/verify` in den abgefangenen URLs.
- **TF2** (AK2, bestehend): `Root.test.tsx` „AK2: App-Marker-Link wird nicht im Browser eingelöst“
  und e2e „AK2 …“ bleiben grün.
- **TF3** (AK1+AK4, e2e, `frontend/e2e/issue-2563-magic-app-landing.spec.ts`): `page.route('**/auth/me')`
  mit 200+User statt 401 → Landing-Link sichtbar mit Scheme-href; Verify-POST-Mitschnitt bleibt leer.
- **TF4** (AK3+AK4, bestehend): Einlösung ohne Marker über Bestandstests gedeckt — kein neuer Test.

## Randbedingungen

- #2563-Bestandsverträge nicht brechen: Root.test.tsx-Block „Issue #2563“, e2e-Spec AK2/AK7,
  Unterbleiben des stillen Google-Logins bei App-Landing, URL-Bereinigung.
- Kein neues UI — die Landing existiert aus #2563.
