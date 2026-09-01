# Issue 831: KoliBri-MCP in UX-Phase integrieren

**Stand:** 2026-09-01

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
   - Agent nutzt `mcp__kolibri-mcp__search_templates` (Parameter `templateType`) oder `mcp__kolibri-mcp__list_template_types`, um Templates nach generic/react/theme zu filtern
   - Treffer von `search_templates` sowie das Ergebnis von `fetch_template` enthalten das Feld `templateType`

## Erwartetes Ergebnis

- `mcp__kolibri-mcp__search` liefert Ergebnisse bei query="button" (Felder u. a. `id`, `kind`, `name`, `group`, `path`) — ohne Theme-Information
- `mcp__kolibri-mcp__fetch_template` liefert Template mit includeCodeBlocks=true (Default), extrahierten Code-Blocks und dem Feld `templateType`
- `mcp__kolibri-mcp__list_template_types` liefert die drei Template-Typen (generic/react/theme); `mcp__kolibri-mcp__search_templates` filtert danach über den Parameter `templateType`
- Agent kann Component-Alternativen basierend auf Theme-Kompatibilität filtern
