# Issue 832: Playwright-MCP für UX-Phase

## Ziel

Playwright-MCP in UX-Phase einrichten für UI-Inspektion und A11y-Tests.

## Vorbedingung

- Playwright-MCP Server läuft (lokal oder CI)
- App ist unter localhost:4174 erreichbar (Demo-Seed)

## Schritte

1. Playwright-MCP-Verbindung herstellen
2. UI-Snapshot unter localhost:4174 erstellen
3. A11y-Check mit axe-core ausführen
4. Keyboard-Navigation testen (Tab-Reihenfolge, Fokus-Indikatoren)
5. Viewport-Tests: Mobile (375×812) und Desktop (1280×900)

## Erwartetes Ergebnis

- Playwright-MCP ist erreichbar in UX-Phase
- UI-Snapshot zeigt vollständige DOM-Struktur
- A11y-Checks laufen ohne Fehler
- Keyboard-Navigation ist testbar
- Mobile-Viewport wird korrekt gerendert

## UX-Bezug

- UI-Inspektion für UX-Entscheidungen (Agent kann UI-Zustände lesen)
- Konsistente Snapshot-Struktur für wiederholbare Analysen
- A11y-Infrastruktur für BITV-Konformität
