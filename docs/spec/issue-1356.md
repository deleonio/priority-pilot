# Spec: Token-Einstellungen mit Rechte-Umschalter (#1356)

Status: rot (Spec-Phase) — Tests in `server/src/express/api-tokens.test.ts`,
`server/src/express/api-token-auth.test.ts`, `server/src/logics/migrate.test.ts`,
`server/src/mcp/tools.test.ts`, `frontend/src/components/ApiTokensSection.test.tsx`,
`frontend/e2e/issue-1356-token-scope.spec.ts`.

Aufbauend auf #1352 (Token-Verwaltung, Bearer-Auth) und #1353 (MCP-Werkzeuge) — beide gemergt.
Neu ist ausschließlich die Rechtestufe `scope` je Token (`read` / `readwrite`) samt serverseitiger
Durchsetzung. Quelle der Akzeptanzkriterien: KI-ANALYSE-Block im Harness-Marker-Kommentar von #1356.

## Datenmodell (Vertrag)

- `ApiToken` (`server/src/models/apiToken.ts`) erhält ein Feld `scope` mit den Werten `'read'` |
  `'readwrite'`, Default `'read'` (AK1).
- `migrateApiTokenScope` (neu in `server/src/logics/migrate.ts`, Muster `migrateUsersRoleColumn`):
  zieht die Spalte `scope VARCHAR(255) NOT NULL DEFAULT 'read'` auf einer Bestands-`api_tokens`-
  Tabelle nach, bevor `sequelize.sync()` läuft. Bestandszeilen erhalten `'read'`. Idempotent; No-op
  bei fehlender Tabelle (frische DB — `sync()` legt sie inkl. Spalte an).

## API-Vertrag (Router `server/src/express/routes/apiTokens.ts`)

| Route                    | Verhalten                                                                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /api-tokens`       | Legt den Token immer mit `scope: "read"` an; Antwort enthält `scope` (AK2).                                                                                  |
| `GET /api-tokens`        | Liefert `scope` je Token mit (AK2).                                                                                                                          |
| `PATCH /api-tokens/{id}` | Body `{ scope: "read" \| "readwrite" }`. 200 mit aktualisiertem DTO. Unbekannter Wert → 400. Fremder/unbekannter Token → 404, Wert bleibt unverändert (AK3). |

## Auth-Vertrag (Schreibsperre für `scope: "read"`)

- Ein Request, dessen `req.apiTokenId` (gesetzt von `apiTokenAuth`) zu einem Token mit
  `scope: "read"` gehört, wird bei einer schreibenden Methode (POST/PUT/PATCH/DELETE) mit 403
  abgewiesen, **bevor** die Fachroute läuft — keine Daten verändern sich (AK4). GET bleibt erlaubt.
- Nach einem `PATCH /api-tokens/{id}` auf `readwrite` gelingt derselbe schreibende Request mit
  **demselben** Token, ohne neuen Token zu erzeugen (AK5).
- Die MCP-Route `POST /mcp/v1` selbst ist die JSON-RPC-Transportroute und wird NICHT allein wegen
  ihrer HTTP-Methode gesperrt (sonst wäre `task_list` mit einem Nur-lese-Token tot). Die Sperre
  greift auf dem inneren Loopback-Request, den `callApi` (`server/src/mcp/tools.ts`) gegen die
  gespiegelte HTTP-Route schickt — `task_list`/`next_task`/`pillar_list`/`category_list` (GET)
  bleiben erreichbar, `task_create` (POST) liefert einen Fehler (AK6).
- Nachtrag aus #1358: Die Ausnahme verglich den Pfad exakt gegen `/mcp/v1`, der Router bedient
  (`strict: false`) aber auch `/mcp/v1/`. Ein Client mit Schrägstrich am Ende der Endpunkt-URL
  fiel damit in die Schreibregel und bekam schon auf den `initialize`-Handshake eine 403 — ohne
  JSON-RPC-Rahmen, also für MCP-Clients als Verbindungsfehler ohne Text. Der Guard vergleicht den
  Pfad jetzt normalisiert (ohne abschließende Schrägstriche) gegen die aus `mcp/server.ts`
  exportierte Konstante `MCP_PATH`; dasselbe gilt für den `/api-tokens`-Vergleich. Warum der Pfad
  nur an einer Stelle steht: [ADR 0012](../adr/0012-mcp-endpunkt-ohne-sdk.md).
- Ebenfalls aus #1358: Ein schreibendes Werkzeug wird am Werkzeug selbst abgewiesen
  (`write: true` im Katalog, Prüfung in `mcp/server.ts` vor `tool.run`), damit die Ablehnung als
  JSON-RPC-Fehler mit Handlungshinweis beim Client ankommt statt als durchgereichter HTTP-Text.
  Die Sperre auf dem Loopback bleibt als zweite Verteidigungslinie bestehen.
- Die Token-Verwaltung selbst (`/api-tokens`, jede Methode) ist über einen Bearer-Token NICHT
  erreichbar — 403 unabhängig vom `scope` des Tokens, damit sich ein Token nicht selbst oder andere
  Tokens hochstufen kann. Über die Browser-Session bleiben alle vier Routen unverändert nutzbar
  (AK7).

## Frontend-Vertrag (`frontend/src/components/ApiTokensSection.tsx`)

- Über der Token-Liste steht ein Hinweis (#1358), dass ein Token standardmäßig nur liest und
  schreibende MCP-Werkzeuge bis zum Umschalten einen Fehler melden — das gilt auch für Tokens,
  die vor der Migration vergeben wurden und von ihr bewusst auf `read` gesetzt worden sind.
- Jede Token-Zeile (`data-testid="api-token-row"`) zeigt die aktuelle Stufe im Klartext
  („Nur lesend" / „Lesen und Schreiben") und einen Umschalter, der sofort beim Ändern den PATCH
  sendet (kein Speichern-Klick, Muster `handleRevoke`) — `busy`-Sperre während des Requests,
  Fehleranzeige über `KolAlert` bei fehlgeschlagenem PATCH (Wert bleibt dann unverändert sichtbar).
  Nach Neuladen der Seite steht der neue Zustand unverändert da, weil der Wert aus der DB kommt
  (AK8).
- Bei 375px Viewportbreite bleibt die Zeile inkl. Umschalter und „Zurückziehen" ohne horizontales
  Scrollen bedienbar (Umbruch statt Überlauf, AK9).
- `openapi.yml` beschreibt `scope` im Schema `ApiToken` und die neue `PATCH`-Operation (AK10) — dies
  treibt den generierten Client (`client/src/schema.d.ts`); kein eigener Test, da ein
  Schema-Textabgleich ohne Zähne wäre (ADR 0001). Die Spec-Tests in diesem Dokument referenzieren
  `scope` daher über lokal definierte Response-Typen statt über den generierten `ApiToken`-Typ.

## Akzeptanzkriterien → Tests

- AK1 → `server/src/logics/migrate.test.ts` (`migrateApiTokenScope`): Spalte fehlt → wird
  nachgezogen, Bestandszeile erhält `'read'`, idempotent, No-op ohne Tabelle.
- AK2, AK3 → `server/src/express/api-tokens.test.ts`: POST/GET liefern `scope`, PATCH ändert ihn
  persistent, ungültiger Wert → 400, fremder/unbekannter Token → 404.
- AK4, AK5, AK7 → `server/src/express/api-token-auth.test.ts`: Nur-lese-Token liest, schreibt aber
  nicht (403, keine Datenänderung); nach Hochstufen gelingt derselbe Request; `/api-tokens` ist über
  Bearer generell gesperrt, über Session offen.
- AK6 → `server/src/mcp/tools.test.ts`: Nur-lese-Token liest über `task_list`, `task_create`
  schlägt fehl und legt nichts an; nach Hochstufen gelingt `task_create`.
- AK8 → `frontend/src/components/ApiTokensSection.test.tsx` (neu, Vitest): Anzeige „Nur lesend" bei
  `scope: "read"`, Umschalten ruft PATCH mit `readwrite`, Zeile zeigt danach „Lesen und Schreiben".
- AK8, AK9 → `frontend/e2e/issue-1356-token-scope.spec.ts` (neu): Anlegen zeigt „Nur lesend",
  Umschalten + Reload zeigt weiterhin „Lesen und Schreiben"; 375px ohne horizontalen Überlauf.
- AK10 → keine automatisierte Prüfung (Begründung oben); Implementierungsphase hält Schema und
  Client synchron, Review prüft das mit.
- Regression (#1352) → `frontend/e2e/issue-1352-api-tokens.spec.ts` und die bestehenden Tests in
  `api-tokens.test.ts`/`api-token-auth.test.ts`/`tools.test.ts` bleiben unverändert grün.

## Scope-Grenzen

- Keine weiteren Rechtestufen (z. B. „nur bestimmte Ressourcen") — die AKs verlangen ausschließlich
  die binäre Unterscheidung lesend/schreibend.
- Kein automatisches Zurückstufen nach Zeit/Nutzung — nicht gefordert.
