# 📈 Kosten-Optimierungsplan

**Strategie zur Senkung der LLM-Kosten um 50-66% ohne Qualitätsverlust**

---

## 🎯 Executive Summary

| Metrik                             | Aktuell    | Ziel         | Verbesserung       |
| ---------------------------------- | ---------- | ------------ | ------------------ |
| **Durchschnittskosten pro Ticket** | ~$6.00     | ~$2.50-3.00  | **-50-66%**        |
| Cache-Effizienz                    | 95-96%     | >95%         | ✅ Bereits optimal |
| Modell-Mix                         | Opus-heavy | Sonnet/Haiku | ⭐ Haupthebel      |
| Review-Runden                      | 1-2        | 1            | -33-50%            |

**Ziel:** Kosten pro Ticket von **$6.00 auf ~$2.50-3.00 senken** durch intelligentes Modell-Routing und Prozessoptimierung.

---

## 📊 Analyse der Referenztickets

### Ticket #1037 (UI/CSS - Responsiv Layout)

- **Aktuelle Kosten:** $4.89
- **Optimierungspotenzial:** $3.25 (66%)
- **Zielkosten:** ~$1.64
- **Hauptkostentreiber:** Analyse (Opus), Spec, Implement (Sonnet)

### Ticket #1034 (UI/PWA - Update-Prompt)

- **Aktuelle Kosten:** $7.13
- **Optimierungspotenzial:** $4.10 (55%)
- **Zielkosten:** ~$3.03
- **Hauptkostentreiber:** Analyse (Opus), **2x Review**, Implement (Sonnet), Spec, Fixup

**Gemeinsame Muster:** Beide Tickets sind UI-lastig und könnten mit günstigeren Modellen bearbeitet werden.

---

## 🎯 Optimierungsmaßnahmen

### 🥇 Priorität 1: Spec-Phase überspringen bei UI-only Tickets (⭐⭐⭐)

**Problem:**

- Spec-Phase auf Sonnet kostet **$1.20-1.40 pro Ticket**
- Für reine UI-Anpassungen (CSS, Layout, Texte) ist Spec oft unnötig
- ADR-0004 erlaubt bereits Spec-Skip bei Tickets OHNE Anwendungscode-Logik

**Lösung:**

```
IF Ticket-Typ == "UI-only" AND "Betroffene Dateien" enthalten nur:
  - *.css
  - *.tsx (präsentationale Komponenten)
  - *.spec.ts (e2e-Tests)
  - Keine Business-Logik
THEN
  Analyse setzt direkt ai:needs-impl
  Spec-Phase wird übersprungen
```

**Implementierung:**

1. **Erkennungslogik** in Analyse-Phase erweitern
   - Prüfe `Betroffene Dateien` aus Analyse-Block
   - Kategorisiere als "UI-only" wenn nur Layout/Styling betroffen
2. **Label-Setzung** anpassen
   - `ai:needs-impl` direkt setzen statt `ai:needs-spec`
3. **Dokumentation** anpassen
   - ADR-0004 um konkrete Kriterien erweitern

**Erwartete Ersparnis:**

- **$1.20-1.40 pro UI-Ticket** (25-30% der Gesamtkosten)
- **Aufwand:** Niedrig (1-2 Tage)
- **Risiko:** Niedrig (bereits durch ADR-0004 abgedeckt)

---

### 🥈 Priorität 2: Haiku für Implement-Phase bei UI-Tickets (⭐⭐⭐)

**Problem:**

- Implement-Phase auf Sonnet kostet **$1.20-1.60 pro Ticket**
- UI-Code (CSS, einfache React-Komponenten) ist oft repetitiv
- Haiku ist **3x günstiger** ($1/Mio vs. $3/Mio Input)

**Lösung:**

```
IF ai:model:sonnet AND Ticket-Typ == "UI"
THEN
  Implement-Phase nutzt claude-haiku-4-5-20251001
```

**Implementierung:**

1. **Modell-Routing** anpassen
   - `.github/scripts/resolve-model-label.sh` erweitern
   - Neue Regel: `ai:model:haiku` für UI-Tickets
2. **Workflow-Anpassung**
   - `04-claude-implement.yml` prüft Ticket-Typ
   - Setzt Modell basierend auf Klassifikation
3. **Automatische Erkennung**
   - Prüfe `Betroffene Dateien` auf UI-spezifische Pfade

**Erwartete Ersparnis:**

- **$0.80-1.20 pro UI-Ticket** (15-25% der Gesamtkosten)
- **Aufwand:** Niedrig (1 Tag)
- **Risiko:** Niedrig (Haiku gut für UI-Code getestet)

---

### 🥉 Priorität 3: Sonnet für Analyse-Phase bei einfachen Tickets (⭐⭐⭐)

**Problem:**

- Analyse-Phase auf Opus kostet **$1.10-1.60 pro Ticket**
- Opus kostet **$5/Mio Input**, Sonnet nur **$3/Mio** (40% günstiger)
- Für UI/CSS/PWA-Tickets reicht Sonnet aus

**Lösung:**

```
IF Ticket-Typ IN ["UI", "CSS", "PWA", "Layout"] AND Komplexität == "niedrig-mittel"
THEN
  Analyse-Phase nutzt claude-sonnet-5
ELSE
  Analyse-Phase nutzt claude-opus-5
```

**Implementierung:**

1. **Komplexitätsklassifikation** einführen
   - Analyse-Phase klassifiziert Ticket-Typ und Komplexität
   - Setzt `ai:complexity:low|medium|high`
2. **Modell-Auswahl** dynamisch gestalten
   - `01-claude-triage.yml` prüft Komplexität
   - Wählt Modell basierend auf Klassifikation
3. **Fallback:** Opus für unbekannte/komplexe Tickets

**Erwartete Ersparnis:**

- **$0.45-1.15 pro Ticket** (10-20% der Gesamtkosten)
- **Aufwand:** Mittel (2-3 Tage)
- **Risiko:** Mittel (neue Klassifikationslogik nötig)

---

### 🏅 Priorität 4: Review-Optimierung - Haiku für erste Runde (⭐⭐)

**Problem:**

- Review-Phase auf Sonnet kostet **$0.75-1.69 pro Ticket**
- Ticket #1034 hatte **2 Review-Runden** (24% der Gesamtkosten!)
- Viele Findings sind einfach und benötigen kein starkes Modell

**Lösung:**

```
Review-Runde 1: claude-haiku-4-5-20251001
IF Findings komplex OR 2. Runde nötig
THEN
  Review-Runde 2+: claude-sonnet-5
```

**Implementierung:**

1. **Review-Phasen** trennen
   - Erste Review immer auf Haiku
   - Eskalation auf Sonnet nur bei Bedarf
2. **Finding-Klassifikation** einführen
   - Einfache Findings (UI-Anpassungen) → Haiku
   - Komplexe Findings (Architektur) → Sonnet
3. **Workflow-Anpassung**
   - `05-claude-pr-review.yml` prüft Finding-Typ

**Erwartete Ersparnis:**

- **$0.40-0.80 pro Ticket** mit Review (5-15% der Gesamtkosten)
- **Aufwand:** Mittel (2-3 Tage)
- **Risiko:** Niedrig (Haiku kann einfache Reviews durchführen)

---

### 🏅 Priorität 5: Fixup-Phase auf Haiku (⭐⭐)

**Problem:**

- Fixup-Phase auf Sonnet kostet **$0.69 pro Ticket** (Ticket #1034)
- Fixes sind oft einfache Anpassungen
- Haiku ist ausreichend für einfache Code-Fixes

**Lösung:**

```
IF Fixup nach Review AND Findings == "einfach"
THEN
  Fixup-Phase nutzt claude-haiku-4-5-20251001
```

**Implementierung:**

1. **Fixup-Klassifikation** einführen
   - Review markiert Findings als "einfach" oder "komplex"
   - Einfache Findings → Haiku für Fixup
2. **Workflow-Anpassung**
   - `04-claude-implement.yml` (Fixup-Modus) prüft Finding-Typ

**Erwartete Ersparnis:**

- **$0.40-0.60 pro Ticket** mit Fixup (5-10% der Gesamtkosten)
- **Aufwand:** Niedrig (1 Tag)
- **Risiko:** Niedrig

---

## 📊 Erwartete Ergebnisse

### Kostenreduktion pro Ticket-Typ

| Ticket-Typ       | Aktuell    | Nach Optimierung | Ersparnis  | Reduktion |
| ---------------- | ---------- | ---------------- | ---------- | --------- |
| UI/CSS (einfach) | $4.89      | ~$1.64           | $3.25      | **66%**   |
| UI/PWA (mittel)  | $7.13      | ~$3.03           | $4.10      | **55%**   |
| **Durchschnitt** | **~$6.00** | **~$2.34**       | **~$3.66** | **~61%**  |

### Kumulierte Ersparnis (bei 100 Tickets/Jahr)

| Maßnahme            | Ersparnis pro Ticket | 100 Tickets | Priorität |
| ------------------- | -------------------- | ----------- | --------- |
| Spec überspringen   | $1.30                | **$130.00** | ⭐⭐⭐    |
| Haiku für Implement | $1.00                | **$100.00** | ⭐⭐⭐    |
| Sonnet für Analyse  | $0.80                | **$80.00**  | ⭐⭐⭐    |
| Review auf Haiku    | $0.60                | **$60.00**  | ⭐⭐      |
| Haiku für Fixup     | $0.50                | **$50.00**  | ⭐⭐      |
| **Gesamt**          | **$4.20**            | **$420.00** | -         |

**🎯 Jährliche Ersparnis: ~$420 bei 100 Tickets**

---

## 📅 Implementierungsplan

### Phase 1: Quick Wins (Woche 1-2) – **$260 Ersparnis/Jahr**

| Aufgabe                                 | Verantwortlich | Aufwand  | Ersparnis |
| --------------------------------------- | -------------- | -------- | --------- |
| Spec-Skip für UI-Tickets implementieren | Team           | 1-2 Tage | $130/Jahr |
| Haiku für Implement-Phase               | Team           | 1 Tag    | $100/Jahr |
| Dokumentation aktualisieren             | Team           | 0.5 Tage | -         |

**Ziel:** 43% Kostensenkung nach 2 Wochen

---

### Phase 2: Modell-Routing (Woche 3-4) – **+$120 Ersparnis/Jahr**

| Aufgabe                           | Verantwortlich | Aufwand  | Ersparnis |
| --------------------------------- | -------------- | -------- | --------- |
| Sonnet für Analyse bei UI-Tickets | Team           | 2-3 Tage | $80/Jahr  |
| Review auf Haiku (1. Runde)       | Team           | 2-3 Tage | $60/Jahr  |
| Testing & Validierung             | Team           | 2 Tage   | -         |

**Ziel:** 55% Kostensenkung nach 4 Wochen

---

### Phase 3: Feinabstimmung (Woche 5-6) – **+$40 Ersparnis/Jahr**

| Aufgabe               | Verantwortlich | Aufwand | Ersparnis |
| --------------------- | -------------- | ------- | --------- |
| Haiku für Fixup-Phase | Team           | 1 Tag   | $50/Jahr  |
| Prompt-Optimierung    | Team           | 2 Tage  | $40/Jahr  |
| Monitoring & Metriken | Team           | 1 Tag   | -         |

**Ziel:** 61% Kostensenkung nach 6 Wochen

---

## 🔍 Erfolgsmessung

### KPIs

1. **Durchschnittskosten pro Ticket**
   - Ziel: < $3.00 (aktuell: ~$6.00)
   - Messung: Wöchentlicher Report aus `.costs/`

2. **Modell-Nutzung**
   - Ziel: < 10% Opus, > 50% Haiku
   - Messung: Phasenweise Modell-Statistik

3. **Cache-Effizienz**
   - Ziel: > 95% (aktuell: 95-96%)
   - Messung: Token-Statistik pro Phase

4. **Review-Runden**
   - Ziel: ≤ 1.2 Runden pro Ticket (aktuell: 1-2)
   - Messung: Review-Phasen pro Ticket

### Monitoring

```bash
# Wöchentlicher Kosten-Report
node .github/scripts/tokens-report.ts --dir .costs

# Phasenweise Analyse
node .github/scripts/cost-aggregate.ts --issue <n> --dir .costs
```

---

## ✅ Qualitätsgarantien

### Was NICHT geändert wird:

1. **Testabdeckung**
   - Alle Akzeptanzkriterien müssen weiter getestet werden
   - e2e-Tests bleiben obligatorisch
   - Unit-Tests bleiben obligatorisch

2. **Code-Qualität**
   - Type-Safety (TypeScript) bleibt erhalten
   - Linting (`pnpm lint`) bleibt erhalten
   - Formatting (`pnpm format`) bleibt erhalten

3. **Review-Prozess**
   - Menschliche Review bleibt obligatorisch
   - Qualitätsgates bleiben unverändert

4. **Dokumentation**
   - Spec-Dokumente bei komplexen Tickets
   - ADR-Dokumente werden aktualisiert

### Risikominimierung

| Risiko                 | Mitigation                             |
| ---------------------- | -------------------------------------- |
| Modell zu schwach      | Fallback auf Sonnet/Opus               |
| Qualitätsverlust       | Automatisierte Tests + manuelle Review |
| falsche Klassifikation | Manuelle Überschreibungsmöglichkeit    |
| Performance-Probleme   | Monitoring + Alerting                  |

---

## 📚 Anpassungen an bestehenden Dokumenten

### ADR-0004: Analyse-getriebenes Routing

**Erweiterungen:**

1. Neue Modell-Klassifikation für Phasen
2. Dynamische Modellwahl basierend auf Ticket-Typ
3. Spec-Skip-Kriterien konkretisieren

### ADR-0005: Fixup und Umsetzung sind eine Phase

**Erweiterungen:**

1. Fixup-Modell basierend auf Finding-Komplexität
2. Integration mit Review-Phase

---

## 🔧 Technische Implementierung

### 1. Neue Skripte

```bash
# .github/scripts/resolve-phase-model.sh
#!/bin/bash
# Bestimmt das Modell für eine Phase basierend auf Ticket-Klassifikation

PHASE=$1
ISSUE=$2

# Lese Ticket-Klassifikation
MODEL_LABEL=$(gh issue view $ISSUE --json labels --jq '.labels[] | select(.name | startswith("ai:model:")) | .name')
TICKET_TYPE=$(get-ticket-type.sh $ISSUE)

case $PHASE in
  "analyse")
    if [ "$TICKET_TYPE" = "UI" ]; then
      echo "sonnet"
    else
      echo "opus"
    fi
    ;;
  "implement" | "fixup")
    if [ "$TICKET_TYPE" = "UI" ]; then
      echo "haiku"
    else
      echo "sonnet"
    fi
    ;;
  "review")
    # Erste Review-Runde immer Haiku
    if is-first-review-round.sh $ISSUE; then
      echo "haiku"
    else
      echo "sonnet"
    fi
    ;;
  *)
    # Default aus Label oder Phasen-Default
    if [ -n "$MODEL_LABEL" ]; then
      echo ${MODEL_LABEL#ai:model:}
    else
      echo "sonnet"
    fi
    ;;
esac
```

### 2. Workflow-Anpassungen

**01-claude-triage.yml:**

```yaml
# Dynamische Modellwahl für Analyse
- name: Bestimme Analyse-Modell
  id: model
  run: |
    MODEL=$(./.github/scripts/resolve-phase-model.sh analyse ${{ github.event.issue.number }})
    echo "model=$MODEL" >> $GITHUB_OUTPUT

- name: Claude mit dynamischem Modell
  uses: ./.github/actions/setup-claude
  with:
    model: ${{ steps.model.outputs.model }}
```

**04-claude-implement.yml:**

```yaml
# Dynamische Modellwahl für Implement/Fixup
- name: Bestimme Implement-Modell
  id: model
  run: |
    PHASE=$(get-current-phase.sh)
    MODEL=$(./.github/scripts/resolve-phase-model.sh $PHASE ${{ github.event.issue.number }})
    echo "model=$MODEL" >> $GITHUB_OUTPUT
```

---

## 📎 Anhänge

- [Kosten-Report #1037](../kosten-report-1037.md)
- [Kosten-Report #1034](../kosten-report-1034.md)
- [ADR-0004: Analyse-getriebenes Routing](../adr/0004-analyse-getriebenes-routing.md)
- [ADR-0005: Fixup und Umsetzung sind eine Phase](../adr/0005-fixup-und-umsetzung-sind-eine-phase.md)

---

_Erstellt am 26. August 2026 | Version: 1.0 | Status: Entwurf_
