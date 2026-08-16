# Issue 735: UX-Phase in Phasen-Workflow integrieren

## Ziel

Die Phase `ux` wird in den Phasen-Workflow integriert, um sicherzustellen, dass UX-Arbeiten abgeschlossen sind, bevor die Implementierung startet.

## Vorbedingungen

- Issue #734 ist gemerget (KI-UX-Block ist in Triage-Workflow integriert)

## Schritte

### 1. UX-Phase in check-phase-label.sh

Die Phase `ux` wird in `.github/scripts/check-phase-label.sh` eingeführt:

- Zustand: Issue ist offen
- Required labels: `ai:analyzed` muss vorhanden sein
- Absent labels: `ux:ready` darf NICHT vorhanden sein

Test-Verhalten:

```bash
# Mit ux:ready → proceed=false (Label sollte abwesend sein)
bash .github/scripts/check-phase-label.sh --repo owner/repo --phase ux --ticket 735
# Ergebnis: proceed=false, reason="Label 'ux:ready' wurde inzwischen (erneut) gesetzt"

# Ohne ux:ready, mit ai:analyzed → proceed=true
bash .github/scripts/check-phase-label.sh --repo owner/repo --phase ux --ticket 735
# Ergebnis: proceed=true
```

### 2. Implement-Phase erweitern

Die Phase `implement` wird erweitert:

- Zustand: Issue ist offen
- Required labels: `ai:ready`, `ai:analyzed`, `ux:ready` (ALLE müssen vorhanden sein)

Test-Verhalten:

```bash
# Mit ai:ready + ai:analyzed, aber ohne ux:ready → proceed=false
bash .github/scripts/check-phase-label.sh --repo owner/repo --phase implement --ticket 735
# Ergebnis: proceed=false, reason="Label 'ux:ready' fehlt inzwischen"

# Mit allen drei Labels → proceed=true
bash .github/scripts/check-phase-label.sh --repo owner/repo --phase implement --ticket 735
# Ergebnis: proceed=true
```

### 3. Workflow 03-claude-implement.yml Fan-in

Der Workflow `03-claude-implement.yml` feuert auf `ai:ready` ODER `ux:ready`:

- Issue wird mit Label `ux:ready` versehen → Workflow feuert
- Issue wird mit Label `ai:ready` versehen → Workflow feuert
- Precheck-if prüft auf Beide Labels (OR-Logik)

### 4. Prompt-Erweiterungen

Die Prompts in `.github/workflows/03-claude-implement.yml` und `.github/prompts/spec.md` werden erweitert:

- Berücksichtigung des KI-UX-Blocks bei der Umsetzung
- Spec-Ableitung beachtet KI-UX-Block

## Erwartetes Ergebnis

1. Die Phase `ux` ist im check-phase-label.sh bekannt und wird korrekt validiert
2. Die Phase `implement` verlangt zusätzlich `ux:ready`
3. Der Workflow 03 feuert auf Fan-in (ai:ready OR ux:ready)
4. Die Prompts berücksichtigen den KI-UX-Block

## Akzeptanzkriterien-Bezug

- AC1: check-phase-label.sh kennt Phase ux (REQUIRED: ai:analyzed, ABSENT: ux:ready)
- AC2: implement verlangt ux:ready zusätzlich
- AC3: 03 feuert auf ai:ready ODER ux:ready (Fan-in)
- AC4: Prompts berücksichtigen KI-UX-Block
