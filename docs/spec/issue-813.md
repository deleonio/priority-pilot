# Issue 813: Mermaid Syntax Fix in pipeline-flow.md

## Ziel

Tabulator-Syntaxfehler in Mermaid-Diagramm beheben, sodass das Diagramm in GitHub-Oberfläche korrekt rendert.

## Vorbedingung

- Datei `docs/pipeline-flow.md` enthält Mermaid-Diagramm mit Syntaxfehler in Zeile 64
- Tabulator-Zeichen zwischen Label und Zielknoten verursacht Parsing-Error

## Schritte

1. `docs/pipeline-flow.md` Zeile 64 öffnen
2. Tabulator zwischen `"Stop-Guard"|` und `human` durch reguläre Leerzeichen ersetzen
3. Optional: Label erweitern zu `"Stop-Guard (> 10 Commits)"` für mehr Klarheit

## Erwartetes Ergebnis

- Mermaid-Diagramm wird in GitHub-Oberfläche ohne Syntaxfehler gerendert
- Kante von "fixup" zu "human" ist sichtbar und beschriftet
- Keine Parsing-Error-Meldung im Markdown-Rendering

## Test-Abdeckung (Karve-Out: Markdown-Dokumentation)

Tests für Markdown-Inhalte sind Change-Detector (String-Match prüft nur, dass der String im File steht, den wir schreiben). Validierung erfolgt visuell durch PR-Review anhand der Akzeptanzkriterien:

1. **Mermaid-Validierung**: Diagramm syntaktisch korrekt (kein Parsing-Error)
2. **Rendering-Test**: Diagramm wird in GitHub-UI angezeigt (nicht "Syntax error")
3. **Visualer Test**: Kante von "fixup" zu "human" mit Label "Stop-Guard" sichtbar

## Referenz

- Akzeptanzkriterien aus Issue 813
- UX-Beratung: `.claude/memory/issue-813-ux.md`

---

## Versionierung

- **v1.1** (2026-08-19): Nightly-Sync — Ist-Stand verifiziert, Mermaid-Syntax korrigiert
- **v1.0** (Initialefassung für Issue #813)
