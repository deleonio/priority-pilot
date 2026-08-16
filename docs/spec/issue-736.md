# Issue 736 – UX-Phase Doku-Update

**Stand:** 2026-08-16  
**Ziel:** Doku konsistent zu neuer Phase 2b (UX-Beratung) und Label-Kette aktualisieren

---

## Ziel

Dokumentation in AGENTS.md, pipeline-flow.md und ci-architecture.md aktualisieren für neue 7-Phasen-Struktur mit paralleler UX-Beratungsphase (Phase 2b) und zugehörigem Label-Workflow.

## Vorbedingung

- Issue #735 ist gemergt (Gate-Script kennt Phase `ux`)
- Doku-Dateien existieren: AGENTS.md, docs/pipeline-flow.md, docs/ci-architecture.md

## Schritte

1. **AGENTS.md aktualisieren**
   - Phasen-Einleitung: „sechs" → „sieben"
   - Parallele Phasen dokumentieren: Spec (2a) ∥ UX-Beratung (2b) laufen parallel
   - Label-Kette ergänzen: nach `spec:ready` → `ux:ready` → `ai:needs-review`
   - Wissensbasis-Link auf UX-Phase-Doku (falls vorhanden)

2. **docs/pipeline-flow.md aktualisieren**
   - Mermaid-Diagramm: Parallelzweig 2b als neuen Zweig einfügen (neben 2a)
   - Label-Referenz für `ux:ready` in Legende/Tabelle ergänzen

3. **docs/ci-architecture.md aktualisieren**
   - Phasen-/Modell-Tabelle um UX-Zeile ergänzen
   - Modell: `sonnet`
   - Variable: `vars.CLAUDE_MODEL_UX`

## Erwartetes Ergebnis

- Alle drei Dateien erwähnen konsistent „Phase 2b / UX-Beratung" bzw. „sieben Phasen"
- AGENTS.md zeigt vollständige Label-Kette inkl. `ux:ready`
- pipeline-flow.md Mermaid-Diagramm hat Parallelzweig 2b
- ci-architecture.md Tabelle hat UX-Eintrag (Modell sonnet, Variable CLAUDE_MODEL_UX)
- Format-Check `pnpm format` läuft ohne Fehler über alle geänderten Dateien

---

## Testable Ableitung

Jedes Akzeptanzkriterium aus Issue #736 muss durch diese Spezifikation gedeckt sein:

1. **AK1:** AGENTS.md erwähnt sieben Phasen, parallele Spec/UX-Phasen, Label-Kette mit ux:ready
   → Schritt 1 deckt dies ab

2. **AK2:** pipeline-flow.md zeigt Parallelzweig 2b im Mermaid-Diagramm, Label-Referenz-Zeile für ux:ready
   → Schritt 2 deckt dies ab

3. **AK3:** ci-architecture.md Tabelle hat UX-Zeile (Modell sonnet, Variable CLAUDE_MODEL_UX)
   → Schritt 3 deckt dies ab

**Format-Check** (AK4): pnpm format läuft durch → „Erwartetes Ergebnis"
