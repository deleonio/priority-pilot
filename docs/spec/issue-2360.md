# Spec #2360 — MCP-Werkzeuge `series_list` / `series_instantiate`

**Stand:** 2026-10-07

## Ziel

Ein KI-Assistent über `/mcp/v1` listet Serien (inkl. `autoCreate`) und legt mit Schreibzugriff eine Aufgabe aus einer Serie/Vorlage auf Abruf an (Loopback auf `GET /series` und `POST /series/:id/instances`, #2357).

## Regeln

1. Katalog: `series_list` (lesend, keine Pflichtfelder) und `series_instantiate` (`write: true`, Pflichtfeld `id`, optional `title`, `priority`, `estimatedEffort`, `description`, `deadline`); der Katalog führt 35 Namen.
2. `series_list` liefert nur die eigenen Serien, jede mit `autoCreate`.
3. `series_instantiate` legt genau eine mit der Serie verknüpfte Aufgabe an (`seriesId`); optionale Felder werden unverändert durchgereicht, Validierung bleibt in der Route.
4. Nur-lese-Token → JSON-RPC-Fehler wie bei den anderen Schreibtools; Nutzer ohne `mcp_readwrite` (nur `pro`) → Paket-Fehler. Keine Aufgabe entsteht.
5. Fremde oder unbekannte Serien-ID → Tool-Fehler (404 der Route), keine Aufgabe.

## Tests

`server/src/mcp/tools.test.ts` (Schemas, Liste, Anlegen, Scope, Fremd-ID, Zähler), `server/src/mcp/plan-error.test.ts` (Paket-Fehler), Zähler 35 in `server/src/express/mcp-handshake.test.ts`.
