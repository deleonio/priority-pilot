# ADR 0012 — MCP-Endpunkt: Streamable-HTTP-Subset ohne offizielles SDK

- **Status:** Accepted (2026-09-11)
- **Datum:** 2026-09-11
- **Kontext:** [Spec MCP-Server v1 (#1353)](../spec/issue-1353.md), Issue #1337, [ADR 0001](0001-github-workflows-bleiben-ungetestet.md)

## Kontext

Der MCP-Endpunkt `/mcp/v1` (#1353, Teil von #1337) verbindet externe Clients (Claude Code, ZCode-Connector) per Streamable HTTP mit den v1-Werkzeugen. Streamable HTTP lässt laut Spec ausdrücklich zu, dass ein Server auf einen POST mit einer einzelnen JSON-Antwort antwortet statt mit einem `text/event-stream`; Sessions (`Mcp-Session-Id`), der GET-Serverstrom und `ping` sind optional. Der eingefrorene Vertrag v1 implementiert genau diese Teilmenge: `initialize`, `tools/list` und `tools/call` über `POST /mcp/v1` mit Protokollversion 2025-06-18.

Zur Abwägung stand die offizielle TypeScript-Implementierung `@modelcontextprotocol/sdk` samt `@modelcontextprotocol/inspector`.

## Entscheidung

Der Endpunkt ist serverseitig handgerollt (`server/src/mcp/`, ~270 Zeilen), ohne `@modelcontextprotocol/sdk` als Produktiv-Abhängigkeit:

1. Der eingefrorene Vertrag braucht nur die JSON-Antwort-Hälfte von Streamable HTTP. Das SDK würde die übrige Hälfte als Transport- und Session-Maschinerie mitbringen, die hier ungenutzt bliebe (SSE-Antworten, Sessions, GET-Strom, `ping`).
2. Kein zweiter Fachlogik- oder Auth-Pfad: Die Werkzeuge rufen per Loopback-Fetch die vorhandenen HTTP-Routes auf, Auth läuft vollständig über die vorhandene Kette (`apiTokenAuth` + `requireAuth`).
3. Keine neue Produktiv-Abhängigkeit (Minimalprinzip).

Der Inspector ist ein lokales Debug-UI und wird bewusst nicht als Abhängigkeit gebunden; er ist bei Bedarf per `npx @modelcontextprotocol/inspector` gegen den Endpunkt richtbar. Das SDK ist als devDependency dennoch im Repo: `server/src/express/mcp-handshake.test.ts` verbindet mit dem offiziellen SDK-Client (`StreamableHTTPClientTransport`) gegen den Testserver und stellt sicher, dass die Hand-Roll-Teilmenge für echte SDK-Clients konform bleibt (dort stammt auch der CallToolResult-Envelope aus `tools/call` her). Die Verifikation im Betrieb liefen echte Clients (Claude Code, ZCode-Connector, produktiv verifiziert).

GET `/mcp/v1` antwortet mit 405 und `Allow: POST`, wie die Spec für Server ohne Ereignisstrom verlangt. DELETE bleibt unbedient, weil nie eine `Mcp-Session-Id` vergeben wird und es daher nichts zu terminieren gibt.

## Konsequenzen

- Protokoll-Drift (neue Spec-Versionen, Client-Sonderfälle) wird selbst getragen; die Tests am echten JSON-RPC-Verhalten (`mcp-auth.test.ts`, `tools.test.ts`) sind der Schutz.
- Clients, die SSE-Antworten, Sessions oder Server-Push zwingend erwarten, funktionieren gegen diesen Endpunkt nicht.
- Eine Migration auf das SDK wird bei einem dieser Trigger neu entschieden: ein verbauter oder angestrebter Client verlangt SSE/Sessions, oder der Umfang wächst über Werkzeuge hinaus (#1338 Admin-Tools, Resources/Prompts).
