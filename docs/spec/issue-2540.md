# Spec #2540 — CSRF-Schutz greift, sobald die Anmeldung aktiv ist

Gate: `server/src/express/index.ts` (CSRF-Middleware hinter `GET /auth/csrf`), Cookie-Logik in `csrf.ts`.

## Regel

CSRF ist aktiv, wenn `SESSION_SECRET` gesetzt ist **und** `NODE_ENV !== 'test'` (bisher: nur `NODE_ENV === 'production'`).
`NODE_ENV=test` bleibt ausgenommen, damit die E2E-Suite direkt über `page.request` seeden kann (PO-Entscheidung 2026-10-12).
Cookie-Name/-Flags bleiben an production gekoppelt (`__Host-csrf` + `secure` nur in Produktion; Dev: `csrf` über http).

## AK1 — Aktiv bei development + SESSION_SECRET

- Vorbedingung: `SESSION_SECRET` gesetzt, `NODE_ENV=development`.
- Schritte: schreibender Request ohne `x-csrf-token` / mit Token + Cookie aus `GET /auth/csrf`.
- Erwartung: 403 ohne Token; mit Paar läuft er in die Fachlogik (2xx bzw. dort definierter Status).

## AK2 — Ausnahme NODE_ENV=test

- Vorbedingung: `NODE_ENV=test`.
- Erwartung: schreibender Request ohne Token erreicht die Fachlogik (kein 403).

## AK3 — Bestehende Ausnahmen

- Bearer-Requests (`isApiTokenRequest`) und `X-Client-Channel: play` brauchen auch bei aktivem CSRF kein Token.

## AK4 — Tests

- `server/src/express/csrf.test.ts` deckt AK1-AK3; E2E-Suite bleibt unverändert grün (NODE_ENV=test).
