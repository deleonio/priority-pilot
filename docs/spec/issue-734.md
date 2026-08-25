# Issue 734 – UI-Bezug Klassifizierung im Triage-Workflow

**Stand:** 2026-08-23

---

## Ziel

Der Triage-Workflow (`.github/workflows/01-claude-triage.yml`) klassifiziert bei jedem Issue im KI-ANALYSE-Block, ob ein UI-Bezug besteht.

## Vorbedingung

- Triage-Workflow `.github/workflows/01-claude-triage.yml` ist aktiv

## Schritte

1. **Triage ausführen**
   - Issue wird getriaget
   - Der Prompt verlangt das Pflichtfeld `UI-Bezug: ja|nein` mit Kurzbegründung im KI-ANALYSE-Block

## Erwartetes Ergebnis

- Der KI-ANALYSE-Block enthält nach Triage immer: `UI-Bezug: ja` oder `UI-Bezug: nein` mit 1-2 Satz Begründung
- Eine `ux:ready`-Label-Steuerung durch den Triage-Workflow existiert nicht
