# Spec #2493 — Server-Härtung: Feedback-Scope, ICS-Schalter, CORS-Max-Age

## Feedback-Ausnahme nur für POST (AK1/AK2)

- Vorbedingung: Bearer-Token mit Scope `read`.
- Schritte: `PUT`/`PATCH`/`DELETE /feedback` → 403 „This token allows read access only." `POST /feedback` bleibt erlaubt (#1890).

## ICS-Schalter nur im Test (AK3/AK4)

- `ICS_ALLOW_INTERNAL_HOSTS=1` wirkt nur bei `NODE_ENV=test`. Sonst wirft `fetchIcs` für interne Adressen „Kalender-Adresse zeigt auf eine interne Adresse." und ruft `fetch` nicht auf.
- Bestandstests (Loopback-Stub) bleiben grün, da `pnpm --filter server test` `NODE_ENV=test` setzt.

## CORS-Preflight cachebar (AK5)

- `OPTIONS` mit `Origin: https://localhost` → 204 mit `Access-Control-Max-Age` als ganze Zahl > 0 (Vorschlag 86400). Fremde Origins bleiben ohne Freigabe.
