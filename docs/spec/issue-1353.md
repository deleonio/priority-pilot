# Spec: MCP-Server v1 für externe Clients (#1353)

Status: rot (Spec-Phase) — Tests in `server/src/express/mcp-auth.test.ts`,
`server/src/mcp/tools.test.ts`, `frontend/e2e/issue-1353-mcp-tools.spec.ts`.

## Ziel

Ein MCP-Client verbindet sich per Streamable HTTP gegen `/mcp/v1`, authentifiziert mit einem
persönlichen API-Token (#1352, `Authorization: Bearer <token>`), sieht die v1-Werkzeugliste und
arbeitet ausschließlich auf den Daten des Token-Besitzers. Änderungen sind sofort in der
Weboberfläche sichtbar.

## Aufsatzpunkt

- `server/src/express/apiTokenAuth.ts` — Bearer-Middleware, befüllt `req.session.user`; hängt vor
  `requireAuth` (`server/src/express/index.ts:139/226`).
- Der `/mcp/v1`-Mount liegt **hinter** `requireAuth` — kein zweiter Auth-Pfad, `getUserId()`/
  `ownerScope()` gelten unverändert.
- Werkzeuge spiegeln vorhandene Fachlogik, statt sie zu duplizieren: `server/src/express/routes/
tasks.ts` (`serializeTask`/`serializeTasksFor`, Anlegen `:486`, Ändern `:591`), `routes/
pillars.ts:160`, `routes/categories.ts:126`, `logics/find.ts` (`findNextImportantTask`).

## Vertrag (v1, eingefroren ab Merge)

- Endpunkt: `POST /mcp/v1` (Streamable HTTP), Werkzeug-Namensraum `v1`.
- Werkzeuge: `task_list`, `task_create`, `task_update`, `task_complete`, `next_task`,
  `pillar_list`, `category_list`. Kein Werkzeug bedient eine Route aus
  `server/src/express/routes/admin.ts` oder trägt `admin` im Namen.
- Auth: gültiger, nicht zurückgezogener Bearer-Token → Werkzeugliste erreichbar. Fehlender,
  unbekannter oder zurückgezogener Token (`ApiToken.revokedAt` gesetzt) → 401, kein Werkzeug
  aufrufbar.
- Datenisolation: jedes Werkzeug filtert auf den Token-Besitzer (`ownerScope`); `task_update`/
  `task_complete` auf eine fremde Aufgabe schlagen fehl, ohne sie zu ändern.
- `next_task` liefert dasselbe Ergebnis wie `GET /next` für denselben Nutzer.

## Akzeptanzkriterien → Tests

- AK1/AK2 (Auth) → `server/src/express/mcp-auth.test.ts`.
- AK3–AK6 (Werkzeuge, Datenisolation) → `server/src/mcp/tools.test.ts`.
- AK7/AK8 (kein Admin-Werkzeug, Snapshot v1-Vertrag) → `server/src/mcp/tools.test.ts`.
- AK9 (Sichtbarkeit in der Weboberfläche) → `frontend/e2e/issue-1353-mcp-tools.spec.ts`.

Rot, bis `server/src/mcp/server.ts` und `server/src/mcp/tools.ts` existieren und am `/mcp/v1`-Mount
hängen. KEIN Produktivcode in dieser Phase.
