# Spec: API-Token auch über `api-key`-Header annehmen (#1417)

Status: rot (Spec-Phase) — Tests in `server/src/express/api-token-auth.test.ts`,
`server/src/express/mcp-auth.test.ts`, `frontend/src/components/ApiTokensSection.test.tsx`,
`frontend/e2e/issue-1417-api-key-header.spec.ts`.

Aufbauend auf #1352 (Bearer-Auth-Middleware `apiTokenAuth`), #1353 (MCP-Loopback) und #1356
(Scope-Sperre). Neu ist ausschließlich eine zweite Leseposition für denselben Klartext-Token:
die Header `api-key` und `x-api-key`. Quelle der Akzeptanzkriterien: KI-ANALYSE-Block im
Harness-Marker-Kommentar von #1417.

## Vertrag

- `readBearerToken()` (`server/src/express/apiTokenAuth.ts:30`) bleibt die **einzige** Lesestelle
  des Klartext-Tokens. Sie erweitert sich um eine Fallback-Kette:
  1. `Authorization: Bearer <token>` — hat Vorrang, unabhängig davon, ob er gültig ist (AK7).
  2. `api-key: <token>` bzw. `api-key: Bearer <token>` (optionales Präfix, case-insensitive) —
     nur ausgewertet, wenn `Authorization` fehlt.
  3. `x-api-key: <token>` — nur ausgewertet, wenn weder `Authorization` noch `api-key` gesetzt sind.
  - Alle nachgelagerten Prüfungen (Ablauf, Widerruf, Scope-Guard) hängen am aufgelösten Token, nicht
    am Headernamen, und gelten damit unverändert (AK1–AK6).
- MCP-Loopback (`server/src/mcp/server.ts:119`, `McpToolContext.authorization` in
  `server/src/mcp/tools.ts:16-17`): der `context.authorization`-Wert wird nicht mehr aus dem
  rohen `Authorization`-Header gebaut, sondern aus dem bereits aufgelösten Klartext-Token als
  `Bearer <token>` — ein `tools/call`, das nur über `api-key` angemeldet ist, sendet damit einen
  gültigen `Authorization`-Header an die gespiegelte HTTP-Route weiter (AK4/AK5).
- Frontend: der Hinweisblock `api-tokens__mcp-url` (`ApiTokensSection.tsx:260-261`) nennt neben der
  bestehenden `Authorization: Bearer <Token>`-Zeile zusätzlich `api-key: <Token>` (AK8); die neue
  Zeile darf bei 375px nicht aus dem Viewport laufen (AK9).

## Testfälle

- AK1/AK2/AK3/AK6/AK7 → `server/src/express/api-token-auth.test.ts`, neue `describe`-Gruppe.
- AK4/AK5 → `server/src/express/mcp-auth.test.ts`, neue `describe`-Gruppe.
- AK8 → `frontend/src/components/ApiTokensSection.test.tsx`.
- AK9 → `frontend/e2e/issue-1417-api-key-header.spec.ts`.
