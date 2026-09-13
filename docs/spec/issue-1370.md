# Analyse: MCP-Server — mehrsprachige Unterstützung (#1370)

Status: umgesetzt (Option 3, siehe unten) — PR #1437.

## Analyse

Betroffen sind zwei Stellen: `server/src/mcp/tools.ts` (Tool-Descriptions, `inputSchema`-Texte)
und `server/src/mcp/server.ts` (JSON-RPC-Fehlermeldungen, Scope-Hinweis). Beide werden nur vom
LLM-Client gelesen, nie von der deutschen Weboberfläche. Das MCP-Protokoll (JSON-RPC über
Streamable HTTP, `initialize`-Handshake) transportiert keine Sprachpräferenz — es gibt kein
`Accept-Language`-Äquivalent und keinen Locale-Parameter im Werkzeugaufruf. Eine Mehrsprachigkeit
der Werkzeugtexte müsste sich also selbst einen Auslöser schaffen (z. B. Token-Attribut), den das
Protokoll nicht vorsieht.

## Implementierungsoptionen

1. **i18next im Server, wie im Frontend** — eigener Locale-Store pro Token, Übersetzungsdateien
   für Tool-Descriptions und Fehlertexte. Aufwand hoch (neue Server-Infrastruktur, Auswahlmechanismus
   ohne Protokoll-Unterstützung nötig), Risiko: zusätzlicher Zustand pro Nutzer, der nirgends
   verlässlich gesetzt werden kann, ohne das Protokoll zu erweitern.
2. **Statischer String-Katalog pro Locale** — einfache Objekt-Lookup-Tabelle statt i18next.
   Aufwand mittel, Risiko identisch zu Option 1: ohne Signal vom Client bleibt die Sprachwahl raten.
3. **Einmalige Umstellung auf Englisch** — LLM-Clients sind die einzige Zielgruppe dieser Texte;
   Englisch ist die de-facto-Standardsprache für Tool-Schemas in MCP-Ökosystemen und für die
   Sprachmodelle selbst, die die Beschreibungen interpretieren. Aufwand gering (String-Ersetzung,
   keine neue Infrastruktur), Risiko gering (Route-Fehlertexte und Weboberfläche bleiben deutsch,
   kein Bruch für bestehende Clients, da nur Text sich ändert, keine Struktur).

## Empfehlung

Option 3, mit Priorität hoch: geringster Aufwand, kein neuer Zustand, und passend zur fehlenden
Locale-Verhandlung im Protokoll — echte Mehrsprachigkeit (Optionen 1/2) lohnt sich erst, wenn das
MCP-Protokoll selbst eine Sprachpräferenz transportieren kann. Umgesetzt in PR #1437, Sprachregel
im Vertrag festgehalten: `docs/spec/issue-1353.md:30`.
