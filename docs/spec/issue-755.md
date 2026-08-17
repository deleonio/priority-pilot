# Issue 755: Foundation Pipeline-Umbau (6→7 Phasen)

## Ziel

Foundation-Teil des Pipeline-Umbaus: Workflows von 6 auf 7 Phasen migrieren.

## Vorbedingung

- Hauptbranch ist auf Stand von Issue #750
- Aktuelle Workflows verwenden 6-Phasen-Modell

## Schritte

### 1. Workflow-Renames

- `.github/workflows/04-*.yml` → `05-*.yml`
- `.github/workflows/05-*.yml` → `06-*.yml`
- `.github/workflows/06-*.yml` → `07-*.yml`
- `.github/workflows/02b-*.yml` → `02-*.yml`
- `.github/workflows/02-*.yml` → `03-*.yml`

### 2. Referenz-Updates

Alle Querverweise auf N/7 aktualisieren:

- "4/6" → "5/7"
- "6 Phasen" → "7 Phasen"
- "phase-06" → "phase-07"

### 3. Triage-Post-Assertion

`.github/scripts/triage-post-assertion.sh` anpassen:

- UX-Labels (ux:needed/ux:ready) korrekt setzen
- 7-Phasen-Logik berücksichtigen

### 4. check-phase-label.sh

`.github/scripts/check-phase-label.sh` erweitern:

- UX-Row ergänzen für Phase 7

### 5. YAML-Validierung

- Keine doppelten Keys in YAML-Dateien
- Syntax korrekt

### 6. Quality-Gates

- `pnpm format` → keine Fehler
- `pnpm lint` → keine Fehler
- `pnpm test` → keine Fehler

## Erwartetes Ergebnis

- Alle Workflows korrekt benannt (01-07)
- Alle Referenzen konsistent auf 7 Phasen
- Triage setzt UX-Labels korrekt
- check-phase-label.sh validiert alle 7 Phasen
- YAML syntaktisch korrekt, keine Doppel-Keys
- Alle Quality-Gates grün

## Test-Strategy

Infrastructure-Only Issue – keine Anwendungscode-Tests möglich.
Alle Änderungen betreffen `.github/workflows/` und `.github/scripts/`.
Validierung durch:

- YAML-Lint (doppelte Keys)
- pnpm format/lint/test
- Manuelle Review der Pipeline-Konfiguration
