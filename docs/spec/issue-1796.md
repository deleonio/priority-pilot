# Spec #1796 — MCP-Werkzeug `care_suggestions` + Trend/Defizit in `balance_status`

## Ziel

Ein KI-Assistent sieht über MCP je Säule Defizit und Trend und bekommt konkrete Vorschläge, die er aktiv und fürsorglich anbietet.

## Verhalten

1. `tools/list` führt `care_suggestions` (32 Werkzeuge). Beschreibung nennt Defizite, Trend, Vorschläge und fordert auf, Vorschläge aktiv anzubieten (AK1).
2. `tools/call care_suggestions` (optional `language`) spiegelt `GET /scores/care-suggestions?sprache=…` per `callApi` — identische `vorschlaege`, keine zweite Auswahl-Logik (AK2).
3. `GET /scores/balance` und `balance_status` liefern je Säule zusätzlich `trend` (`erholt|stabil|verschlechtert`) und `defizitaer` (boolean) aus `bewerteCareDefizit`; Bestandsfelder unverändert (AK3).
4. Beschreibung von `balance_status` nennt Trend/Defizit und verweist auf `care_suggestions` (AK4).
5. Datentrennung: nur Vorschläge aus Aufgaben des Token-Inhabers (AK5).

## Tests

`server/src/mcp/tools.test.ts` (AK1–AK5, Katalog-Zähler 32), `server/src/express/mcp-handshake.test.ts` (Zähler 32), `server/src/express/scores-balance.test.ts` (AK3).
