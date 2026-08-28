# Issue 734 – UI-Bezug Klassifizierung im Triage-Workflow

**Stand:** 2026-08-28

---

## Ziel

Der Triage-Workflow (`.github/workflows/01-claude-triage.yml`) klassifiziert bei jedem Issue, ob eine UX-Phase vor der Umsetzung nötig ist, und gibt einem Menschen (PO) die Kontrolle über das daraus folgende Phasen-Label.

## Vorbedingung

- Triage-Workflow `.github/workflows/01-claude-triage.yml` ist aktiv

## Schritte

1. **Triage ausführen**
   - Issue wird getriaget (Prompt: `.github/prompts/triage.md`, Methode: `.claude/skills/ticket-triage/SKILL.md`)
   - Der KI-ANALYSE-Block enthält eine eigene `ai-phase-routing`-Tabelle mit je einer Zeile für `ux`, `spec`, `impl`, `review` (Spalten `Run: ja|nein`, Modell, Effort); die `ux`-Zeile trägt `Run: ja`, wenn UI-Bezug besteht

2. **PO-Review-Gate bei Ampel 🟢 (`spec-ready`)**
   - Der Workflow setzt in diesem Fall **nicht** automatisch `ai:needs-ux-ui`, sondern das Label `ai:needs-po-review`
   - Er postet eine `::notice`-Annotation mit der Empfehlung, welches Phasen-Label der Analyse nach zu setzen wäre (`ai:needs-ux-ui` bei UI-Bezug, sonst `ai:needs-spec` oder `ai:needs-impl`)
   - Der PO prüft die Analyse und setzt das passende Phasen-Label manuell

## Erwartetes Ergebnis

- Der KI-ANALYSE-Block enthält nach Triage eine `ai-phase-routing`-Tabelle mit expliziter `ux`-Zeile (`Run: ja|nein`)
- Bei Ampel 🟢 setzt der Triage-Workflow selbst kein Phasen-Label (`ai:needs-ux-ui`/`ai:needs-spec`/`ai:needs-impl`) — nur `ai:needs-po-review` plus eine Empfehlungs-Annotation; der Mensch entscheidet
- Eine automatische `ux:ready`-Label-Steuerung durch den Triage-Workflow existiert nicht
