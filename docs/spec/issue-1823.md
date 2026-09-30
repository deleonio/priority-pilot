# Spec #1823 - Staffelungs-Hinweis für MCP-Werkzeuge

## Ziel

KI-Clients sollen MCP-Aufrufe staffeln (Ratenbegrenzung des Servers nicht reißen).

## Vorbedingung

Gültiger API-Token; `tools/list` liefert den Katalog `mcpTools` (`server/src/mcp/tools.ts`).

## Schritte

1. Client ruft `tools/list` auf.
2. Client liest die Beschreibung eines Werkzeugs.

## Erwartetes Ergebnis

- `server/src/mcp/tools.ts` exportiert `MCP_PACING_HINT` (Englisch, eine konkrete Regel, z. B. höchstens ein Aufruf pro Sekunde, Listen einmal lesen und wiederverwenden). (AK1)
- Jede Werkzeugbeschreibung in `tools/list` enthält diesen Text, damit auch alle schreibenden Werkzeuge. (AK1/AK2)
- `docs/arc42.md` IF-07 enthält denselben Text. (AK3)
- Werkzeugnamen und inputSchemas bleiben unverändert; keine serverseitige Drosselung. (AK4)

## Tests

`server/src/mcp/tools.test.ts`, Block "MCP-Staffelungs-Hinweis (#1823)".
