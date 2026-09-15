# Spec — Issue #1460 (T5: MCP-Plan-Deckel für Schreibzugriff)

## Ziel

Nur Nutzer mit Paket `ultimate` dürfen einen API-Token auf `readwrite` schalten und darüber
tatsächlich schreiben (HTTP wie MCP). Ein bereits auf `readwrite` stehender Token eines
Nutzers ohne `ultimate` verliert seinen Schreibzugriff, ohne dass der gespeicherte Scope
verändert wird — ein Upgrade auf `ultimate` stellt den Schreibzugriff sofort wieder her.
Bei ausgeschaltetem Rollout-Schalter `MONETIZATION_ENFORCED` bleibt alles wie heute.

## Vorbedingung

- Rollout-Schalter `MONETIZATION_ENFORCED` (Default: aus, `server/src/logics/plans.ts`).
- Feature-Katalog kennt `mcp_readwrite: ['ultimate']` bereits (#1484 B1).
- API-Tokens existieren bereits (#1352/#1356/#1357/#1417); `PATCH /api-tokens/:id` schaltet
  den Scope, `apiTokenAuth` setzt `req.apiTokenScope`, `apiTokenScopeGuard` und der
  MCP-Handler (`mcp/server.ts`) setzen ihn durch.

## Schritte / Erwartetes Ergebnis

1. **PATCH-Gate** (AK1–AK3): `PATCH /api-tokens/:id { scope: 'readwrite' }` prüft bei
   eingeschaltetem Rollout das Paket des angemeldeten Nutzers. Fehlt `mcp_readwrite`
   (jedes Paket außer `ultimate`), antwortet die Route 403 mit
   `{ code: 'plan_required', feature: 'mcp_readwrite', requiredPlan: 'ultimate', currentPlan }`
   und lässt den gespeicherten Scope unverändert. Herabstufen auf `read` gelingt immer (AK2).
   Für `ultimate` gelingt das Hochstufen weiterhin (AK3).
2. **Effektiver Scope** (AK5): Ein in der DB auf `readwrite` stehender Token eines Nutzers
   ohne `ultimate` liefert bei eingeschaltetem Rollout `req.apiTokenScope === 'read'` — der
   Spaltenwert bleibt `readwrite` (kein Datenverlust, Upgrade wirkt sofort wieder).
3. **Fehlertexte** (AK6–AK7): Ein dadurch abgewiesener HTTP-Schreibzugriff
   (`apiTokenScopeGuard`) trägt zusätzlich zu `message` die Felder `code='plan_required'`,
   `feature='mcp_readwrite'`, `requiredPlan='ultimate'`. Ein echter `read`-Token (kein
   Downgrade) erhält weiterhin byte-identisch `{"message":"This token allows read access
only."}` ohne Zusatzfelder. Ein blockierter `tools/call` eines schreibenden MCP-Werkzeugs
   liefert einen JSON-RPC-Fehler (`code=-32602`), dessen Text `ultimate` nennt.
4. **Rollout aus** (AK8): Ohne `MONETIZATION_ENFORCED` verhält sich alles wie heute — auch
   ein `max`-Nutzer kann auf `readwrite` schalten und darüber schreiben.

## Nicht Teil dieser Spec

- `tools/list` bleibt ungefiltert (unverändert).
- `POST /api-tokens` kennt weiterhin kein `scope`-Feld im Body (AK4) — bereits heute erfüllt,
  kein neuer roter Test nötig (siehe PR-Body, Test-Pflege-Bedarf).
- Die Loopback-Plan-Guards in `server/src/mcp/tools.ts` (#1457) sind unverändert.

## Akzeptanzkriterien → Testfälle

- AK1–AK3 → `server/src/express/api-tokens.test.ts`
- AK5, AK6 → `server/src/express/api-token-auth.test.ts`
- AK7, AK8 (MCP-Teil) → `server/src/mcp/plan-error.test.ts`
