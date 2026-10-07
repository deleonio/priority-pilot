# Spec: Dialog-Vorgaben für die KI über den MCP-Handshake (#1935)

Status: rot (Spec-Phase) — Tests in `server/src/express/mcp-instructions.test.ts`,
`server/src/express/mcp-handshake.test.ts`, `frontend/src/components/McpInstructionsSection.test.tsx`,
`frontend/e2e/issue-1935-mcp-instructions.spec.ts`. Quelle: KI-ANALYSE-/KI-UX-Block im Harness-Kommentar.

## Vertrag

- Nutzer-Feld `mcpInstructions` (TEXT, nullable, getrimmt, max. 2000 Zeichen).
- `GET /mcp-instructions` → `{ instructions: string }` (`""` ohne Wert). `PUT /mcp-instructions`
  Body `{ instructions }`: Text wird getrimmt gespeichert, leer/Whitespace löscht; Nicht-String oder
  > 2000 Zeichen → 400. Hinter `requireAuth`, strikt je Nutzer (AK1).
- `initialize` auf `/mcp/v1` liefert `result.instructions` = gespeicherter Text, sonst **kein**
  `instructions`-Schlüssel (AK2/AK3). `tools/list` und Rechte-Gate bleiben unverändert (AK3/AK4).
- UI: Komponente `McpInstructionsSection` (Geschwister von `ApiTokensSection` im KI-Tab) mit
  `KolTextarea` „Dialog-Vorgaben für die KI", Platzhalter-Beispiel, Button „Speichern" (AK5).
  Test-IDs: `mcp-instructions-input`, `mcp-instructions-save`. Client: `api.getMcpInstructions()` →
  `{ instructions }`, `api.updateMcpInstructions(instructions: string)`.
- Mobile 375 px: kein horizontaler Überlauf, Wert überlebt Reload (AK6).
