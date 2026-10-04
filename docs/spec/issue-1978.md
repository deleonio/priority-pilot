# #1978 — MCP-Anleitungsseite („Frag deine Balance") + README-Verweis

## Ziel

Eine öffentliche Anleitungsseite erklärt die MCP-Anbindung: Endpunkt, Token-Erzeugung,
Paketgrenzen, Claude-Ein-Klick und ChatGPT-Schritt-für-Schritt, plus beide Beispiel-Prompts.
Sie folgt dem Muster der Festseiten (`renderPrivacy`/`renderTerms`): DE unter `/mcp/`,
EN unter `/en/mcp/`, `pathFor` der übrigen Sprachen zeigt auf `/mcp/` (deutsches x-default).

## Voraussetzungen

- MCP-Endpunkt `POST /mcp/v1` (Konstante `MCP_PATH`, `server/src/mcp/server.ts`), Auth nur per
  `Authorization: Bearer <token>`.
- Token-Erzeugung in der App: Einstellungen → Tab „API-Tokens" (Klartext nur einmal sichtbar).
- Paketgrenzen aus `server/src/logics/plans.ts` (MCP lesen ab Plus, lesen+schreiben ab Pro) —
  werden genannt, nicht neu erfunden; keine Preise im Text.

## Schritte (Benutzersicht)

1. Nutzer öffnet `/mcp/` (bzw. `/en/mcp/`) über Footer-/FAQ-Verlinkung oder README.
2. Seite nennt die Endpunkt-URL `<host>/mcp/v1` und den Token-Schritt (App-Einstellungen).
3. Seite nennt die Paketgrenzen (lesen ab Plus, schreiben ab Pro).
4. Claude: Ein-Klick-Deep-Link mit kodierter Endpunkt-URL. ChatGPT: Schritt-für-Schritt-Anleitung.
5. Beispiel-Prompts „Frag deine Balance" (`balance_status`) und „Plane meine Woche nach meiner
   Balance" (`next_task`/`task_list`) zeigen, was der MCP-Server kann.

## Erwartetes Ergebnis (Vertrag der roten Tests)

- `renderMcpGuide` liefert DE- und EN-HTML mit Endpunkt `/mcp/v1`, Token-Schritt (API-Token),
  Paketgrenzen (Plus/Pro), beiden Prompts, Claude-Deep-Link mit
  `encodeURIComponent(<siteUrl>/mcp/v1)` und ChatGPT-Anleitung; hreflang-Alternates verweisen
  jeweils auf die andere Sprache (`/mcp/` ↔ `/en/mcp/`).
- Build (`website/scripts/build.ts`) schreibt `dist/mcp/index.html` und `dist/en/mcp/index.html`
  und nimmt beide Pfade in `sitemap.xml` auf.
- Beide Seiten laden ohne horizontalen Überlauf bei 375 px (Bounding-Box-Prüfung, kein
  `scrollWidth` — Shell clippt mit `overflow-x: hidden`).

## Manuelle Belege (kein automatisierter Test, Nachweis im PR)

- AK3: Beispiel-Prompts gegen die Produktion getestet (Transkript/Screenshot).
- AK4: README-MCP-Abschnitt mit Link auf die Anleitungsseite (Markdown-Inhalt — laut ADR 0001
  kein Test).
- AK6: Einreichung bei mindestens einem MCP-Verzeichnis (PulseMCP/Smithery/Glama) belegt;
  Live-Schaltung bleibt externe Nacharbeit. Ein-Klick-URL-Formate (AK2) bei Umsetzung gegen
  aktuelle Anbieter-Doku verifizieren (Beleg im PR).

## Testabbildung

| Testfall    | AK      | Datei                                                |
| ----------- | ------- | ---------------------------------------------------- |
| TF1         | AK1/AK2 | `website/src/mcp-guide.test.ts` (Unit, Vitest)       |
| TF2         | AK5     | `website/src/mcp-guide.test.ts` (Build-Integration)  |
| TF3         | AK1/AK7 | `website/e2e/mcp-guide.spec.ts` (Playwright, 375 px) |
| AK3/AK4/AK6 | —       | manueller Beleg im PR-Body                           |
