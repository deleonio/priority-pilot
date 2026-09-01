# Auth-Check mit Timeout — kein Dauerspinner nach Google-Authentifizierung

**Stand:** 2026-09-01

## Timeout des Auth-Checks

- Der Authentifizierungs-Check (`GET /api/v1/auth/me`) bricht nach **30 s** ab — der Fetch erhält ein `AbortSignal` aus `AbortSignal.timeout(30000)`.
- Löst das Signal ab, verlässt die App den Ladezustand und rendert den Fehler-State (`role="alert"`, Text nennt „Seite neu laden" als manuellen Ausweg) statt des Spinners.
- Die 30-s-Grenze gilt nur für den `/auth/me`-Check; die Google-Top-Level-Navigation selbst ist clientseitig nicht abbrechbar.

## OAuth-Fehler im manuellen Login

- Ein OAuth-Fehler im manuellen Pfad (kein `silentPending` in der Session) leitet auf `/?error=<code>` um; die Login-Seite rendert die passende Meldung (`access_denied`, `invalid_email`, Fallback „unbekannter Fehler").
- Der stille Pfad leitet bei Interaktionsfehlern mit `silentPending` auf `/?silent=unavailable` um (Loop-Guards bleiben wirksam).
- Die Route `GET /auth/error` existiert als API-Fallback (rohes JSON 400) und wird vom failureRedirect nicht adressiert.

## Kein Auto-Retry, keine Schleife

- Der Auth-Check läuft pro Seitenaufruf genau einmal; es gibt keinen automatischen zweiten Versuch, keinen zweiten Redirect auf `/auth/google/silent` und keine Weiterleitung auf Google ohne Nutzerklick.
- `?error=…` zeigt die Login-Seite mit Fehlermeldung, ohne einen stillen Login-Versuch zu starten.

## Neu-Nutzer-Sign-up

Nach dem ersten Login ist die App (Dashboard) erreichbar, ohne dass ein Lade-Spinner hängen bleibt — auch auf mobilem Viewport (375 px).
