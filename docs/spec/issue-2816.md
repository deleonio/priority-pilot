# Issue 2816 — MCP-Zugang über App-Token paketgebunden (mcp_read/mcp_readwrite)

Quelle: Hacker-Team-Bericht (ci:hacker-team, 2026-10-21); Analyse im Harness-Kommentar (ADR 0009).

## Ziel

Der MCP-Transport (`POST /mcp/v1`) ist ein Paketmerkmal (`mcp_read` ab Plus, Schreibwerkzeuge
`mcp_readwrite` ab Pro) — für App-Tokens (Android) gilt das bislang nicht: `apiTokenAuth` stuft nur
`kind === 'api'` planbedingt herab (apiTokenAuth.ts:109-118) und `apiTokenScopeGuard` lässt
App-Tokens an allen Gates vorbei. Ein Free-Konto kann den vollen MCP-Katalog über das App-Token
nutzen. Der REST-Sync der App (Aufgaben-CRUD ist free) bleibt von allen Plan-Gates ausgenommen.

## Voraussetzung

- Nutzer je Plan (free/plus/pro) mit gültigem App-Token (`kind: 'app'`, gespeicherter Scope
  `readwrite`), ausgestellt über den Native-Login-Code-Tausch (#2377).
- `MONETIZATION_ENFORCED=true`.

## Schritte und erwartetes Ergebnis

1. Free + App-Token, `POST /mcp/v1` (initialize) → 403 mit `code: 'plan_required'`,
   `feature: 'mcp_read'`, `requiredPlan: 'plus'`. Gleichzeitig bleiben `GET /tasks` 200 und
   `POST /tasks` 201 — der App-Sync läuft ohne Plan-Gate und ohne CSRF weiter (AK1).
2. Plus + App-Token: `tools/call task_list` liefert ein JSON-RPC-Result; `tools/call task_create`
   wird als JSON-RPC-Fehler abgewiesen, der `mcp_readwrite` und `pro` nennt; es entsteht keine
   Aufgabe (AK2). Die Schreibsperre greift über die planbedingte Herabstufung des App-Tokens auf
   wirksamen Scope `read` am Werkzeug-Gate (`mcp/server.ts`) — der Loopback-Übersetzer
   (#1457 AK6) macht daraus den Paket-Fehler.
3. Pro + App-Token: `task_create` und `task_list` liefern Results (AK3, kein Rückschritt).
4. Der Bestandstest „free liest und schreibt mit dem App-Token ohne plan_required und ohne CSRF“
   (#2377 AK3, api-token-auth.test.ts) bleibt unverändert grün — REST ist kein Paketmerkmal (AK4).

## Randbedingungen

- Admin-MCP (`/mcp/admin/v1`) bleibt Rollen- statt Plan-Gate.
- Logout/Widerruf unverändert; der gespeicherte Token-Scope bleibt `readwrite`.
