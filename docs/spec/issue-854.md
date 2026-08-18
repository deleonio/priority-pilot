# Issue 854: Label-Schema-Refactoring Dokumentation

## Ziel

Aktualisierung aller Dokumentationsdateien auf das neue Label-Schema, um Konsistenz mit den aktuellen CI/CD-Prozessen zu gewährleisten.

## Vorbedingung

- Aktuelles Label-Schema ist in der CI-Konfiguration definiert
- Alte Label-Namen sind veraltet und führen zu Verwirrung

## Schritte

1. Analyse aller betroffenen Dateien auf alte Label-Referenzen
2. Umstellung aller Label-Namen in docs/pipeline-flow.md
3. Umstellung aller Label-Namen in docs/ci-architecture.md
4. Umstellung aller Label-Namen in AGENTS.md
5. Umstellung aller Label-Namen in .ai-knowledge/*.md (10 Dateien)
6. Erstellung eines neuen ADR zum Label-Schema-Refactoring
7. Validierung: pnpm format && pnpm lint grün

## Erwartetes Ergebnis

- Keine Referenz auf alte Label-Namen mehr vorhanden
- Alle Dokumentationen konsistent mit neuem Schema
- ADR dokumentiert die Migration vollständig
- Formatierung und Linting laufen ohne Fehler durch

## Akzeptanzkriterien-Bezug

- AC1: Alle 6+ Dateien auf neue Label-Namen umgestellt
- AC2: Keine Referenzen auf alte Labels
- AC3: ADR beschreibt Migration von altem zu neuem Schema
- AC4: pnpm format, pnpm lint grün
