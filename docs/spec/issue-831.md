# Issue 831: KoliBri-MCP in UX-Phase integrieren

**Stand:** 2026-08-17  
**Ziel:** Agent kann über KoliBri-MCP-Tools auf BITV-2.1-PS-konforme Components zugreifen und Alternativen finden

---

## Ziel

Agent kann während der UX-Phase über KoliBri-MCP-Tools auf barrierefreie KoliBri-Components zugreifen, um:

- Component-Alternativen zu finden
- Templates mit Code-Beispielen zu laden
- Theme-Kompatibilität zu prüfen

## Vorbedingung

- KoliBri-MCP-Server ist erreichbar (.mcp.json konfiguriert)
- Agent hat Zugriff auf MCP-Tools

## Schritte

1. **KoliBri-MCP-Search ausführen**
   - Agent nutzt `mcp__kolibri-mcp__search` mit query="button"
   - Server liefert Component-Ergebnisse mit Metadaten

2. **Template abrufen**
   - Agent nutzt `mcp__kolibri-mcp__fetch_template` mit einer Template-ID
   - Server liefert Template mit Code-Blocks (markdown + code)

3. **Theme-Kompatibilität prüfen**
   - Suchergebnisse enthalten Theme-Informationen
   - Agent kann zwischen generic/react/theme Templates unterscheiden

## Erwartetes Ergebnis

- `mcp__kolibri-mcp__search` liefert Ergebnisse bei query="button"
- `mcp__kolibri-mcp__fetch_template` liefert Template mit includeCodeBlocks=true und extrahierten Code-Blocks
- Ergebnisse enthalten Template-Typen (generic/react/theme)
- Agent kann Component-Alternativen basierend auf Theme-Kompatibilität filtern
