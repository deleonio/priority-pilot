# Issue 734 – UI-Bezug Klassifizierung im Triage-Workflow

**Stand:** 2026-08-16  
**Ziel:** Triage-Workflow um UI-Bezug-Klassifizierung erweitern, um Nicht-UI-Tickets direkt UX-ready zu setzen

---

## Ziel

Der Triage-Workflow (`.github/workflows/01-claude-triage.yml`) soll bei jedem Issue klassifizieren, ob ein UI-Bezug besteht, und basierend darauf das Label `ux:ready` setzen oder entfernen.

## Vorbedingung

- Issue #733 ist gemergt (02b-Workflow existiert, UI-Tickets werden nicht blockiert)
- Triage-Workflow `.github/workflows/01-claude-triage.yml` ist aktiv

## Schritte

1. **Inline-Prompt erweitern**
   - Pflichtfeld `UI-Bezug: ja|nein` mit Kurzbegründung in den KI-ANALYSE-Block einfügen
   - Die KI muss bei jeder Triage dieses Feld ausfüllen

2. **Post-Assertion hinzufügen**
   - Bei jeder (Re-)Triage wird `ux:ready` entfernt (No-op wenn nicht vorhanden)
   - Bei `spec-ready` + `UI-Bezug: nein` wird `ux:ready` gesetzt
   - Bei UI-Tickets (`UI-Bezug: ja`) wird `ux:ready` NICHT gesetzt (02b übernimmt)

## Erwartetes Ergebnis

### Akzeptanzkriterium 1: Triage schreibt UI-Bezug

- Der KI-ANALYSE-Block enthält nach Triage immer: `UI-Bezug: ja|nein` + Begründung
- Format: `UI-Bezug: ja` oder `UI-Bezug: nein` mit 1-2 Satz Begründung

### Akzeptanzkriterium 2: Post-Assertion entfernt ux:ready

- Bei jeder (Re-)Triage wird `ux:ready` entfernt, falls vorhanden
- Falls nicht vorhanden: No-op (kein Fehler)

### Akzeptanzkriterium 3: ux:ready bei Nicht-UI-Tickets

- Bei `spec-ready` + `UI-Bezug: nein` → `ux:ready` wird gesetzt
- Bei `UI-Bezug: ja` → `ux:ready` wird NICHT gesetzt (02b-Workflow übernimmt)

## Testfälle

### Testfall 1: Nicht-UI-Ticket (Backend)

- Issue mit `spec-ready` + `UI-Bezug: nein`
- **Erwartung:** `ux:ready` wird direkt gesetzt mit Triage-Label

### Testfall 2: UI-Ticket

- Issue mit `UI-Bezug: ja`
- **Erwartung:** `ux:ready` wird NICHT durch Triage gesetzt (02b übernimmt später)

## Abhängigkeiten

- ✅ Issue #733 (02b-Workflow existiert, UI-Tickets nicht blockiert)
