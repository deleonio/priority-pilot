# Spec #2494 — App-Token einzeln widerrufbar

Ziel: Der Nutzer sieht seine Android-Anmeldungen (App-Tokens, `kind: 'app'`) in der Token-API und widerruft jede einzeln.

| Schritt                                        | Erwartung                                                                                                                  |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `GET /api-tokens`                              | eigene, nicht widerrufene API- und App-Tokens mit `kind`, `name`, `createdAt`, `lastUsedAt`; nie `token`/`tokenHash` (AK1) |
| `DELETE /api-tokens/:id` auf eigenes App-Token | 204, `revokedAt` gesetzt, Token fehlt in der Liste (AK2)                                                                   |
| Request mit widerrufenem App-Token             | 401 (AK3)                                                                                                                  |
| Fremdes App-Token                              | nicht in der Liste, DELETE 404, bleibt gültig (AK4)                                                                        |
| `POST /auth/logout` mit App-Token              | widerruft nur dieses Token (AK5)                                                                                           |
| `PATCH /api-tokens/:id` auf App-Token          | 404 — Scope bleibt API-Tokens vorbehalten (AK6)                                                                            |
| `openapi.yml` Schema `ApiToken`                | `kind` (enum `api`, `app`, required); kein Test, `build:api` + Lint (AK7)                                                  |
| `ApiTokensSection`                             | keine Zeile für `kind: 'app'` (AK8)                                                                                        |

Kein automatischer Ablauf; `expiresAt` bleibt für App-Tokens leer.
