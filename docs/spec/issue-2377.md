# Spec #2377 — Android-App: App-Token und CORS

## Ziel

Die Android-App (WebView unter `https://localhost`) meldet sich per Code-Tausch oder Magic Link an und
authentifiziert danach jede Anfrage per `Authorization: Bearer`, paketunabhängig und ohne CSRF.

## Vorbedingung

Nutzer ist zugelassen; Anfrage trägt `X-Client-Channel: play`.

## Schritte und erwartetes Ergebnis

1. `POST /auth/native/exchange` bzw. `POST /auth/magic-link/verify` mit Kanal `play` → `200 { token }`
   (Token `kind='app'`, Scope `readwrite`). `GET /auth/me` mit diesem Bearer liefert den Nutzer (AK1, AK2).
2. App-Token sind sessiongleich: kein Plan-Deckel (`mcp_read`/`mcp_readwrite`), kein CSRF-Token (AK3).
3. `GET /api-tokens` listet nur `kind='api'` (AK4).
4. `POST /auth/logout` mit App-Token setzt `revokedAt`; danach `401` (AK5).
5. Origin `https://localhost`: Preflight `204`, `Access-Control-Allow-Origin: https://localhost`,
   Allow-Headers `Authorization, Content-Type, X-Client-Channel`, kein `Allow-Credentials`;
   normale Antworten tragen Allow-Origin (AK6). Fremde Origins: keine Freigabe (AK7).
6. Ohne Kanal-Header: unverändert `204` + Session-Cookie, kein Token (AK8).
7. Spalte `api_tokens.kind` (Default `'api'`) wird per `migrateApiTokenKind` nachgezogen.

## Tests

`native-login.test.ts` (AK1, AK8), `magic-link.test.ts` (AK2, AK8), `api-token-auth.test.ts` (AK3, AK5),
`api-tokens.test.ts` (AK4), `native-cors.test.ts` (AK6, AK7), `migrate.test.ts` (Spalte).
