# Issue 852: CI-Label-Schema-Umstellung

**Stand:** 2026-08-18  
**Ziel:** Umstellung der 6 Haupt-Phasen-Workflows auf neues Label-Schema

---

## Ziel

Die Core-Workflows 01–06 (.github/workflows/01-_.yml bis 06-_.yml) triggern und setzen korrekt die neuen Labels für alle Phasen.

## Vorbedingung

- GitHub-Repository mit existierenden Workflows 01–06
- Issue hat Label `ai:needs-analyse` (Start-Trigger)

## Schritte

### Phase 1 (01-claude-triage.yml)

- Workflow wird durch Label `ai:needs-analyse` getriggert
- Nach erfolgreichem Abschluss:
  - Label `ai:needs-analyse` wird entfernt
  - Label `ai:analysed` wird gesetzt
  - Label `ai:needs-ux-ui` wird gesetzt (Trigger für Phase 2)

### Phase 2 (02-claude-ux.yml)

- Workflow wird durch Label `ai:needs-ux-ui` getriggert
- Nach erfolgreichem Abschluss:
  - Label `ai:needs-ux-ui` wird entfernt
  - Label `ai:ux-reviewed` wird gesetzt
  - Label `ai:needs-spec` wird gesetzt (Trigger für Phase 3)

### Phase 3 (03-claude-spec.yml)

- Workflow wird durch Label `ai:needs-spec` getriggert
- Nach erfolgreichem Abschluss:
  - Label `ai:needs-spec` wird entfernt
  - Label `ai:specified` wird gesetzt
  - Label `ai:needs-impl` wird gesetzt (Trigger für Phase 4)

### Phase 4 (04-claude-implement.yml)

- Workflow wird durch Label `ai:needs-impl` getriggert
- Nach erfolgreichem Abschluss:
  - Label `ai:needs-impl` wird entfernt
  - Label `ai:implemented` wird gesetzt
  - Label `ai:needs-review` wird gesetzt (Trigger für Phase 5)

### Phase 5 (05-claude-pr-review.yml)

- Workflow wird durch Label `ai:needs-review` getriggert
- Nach erfolgreichem Abschluss:
  - Label `ai:needs-review` wird entfernt
  - Label `ai:reviewed` wird gesetzt
  - Label `ai:needs-fixup` wird gesetzt (Trigger für Phase 6)

### Phase 6 (06-claude-pr-fixup.yml)

- Workflow wird durch Label `ai:needs-fixup` getriggert
- Nach erfolgreichem Abschluss:
  - Label `ai:needs-fixup` wird entfernt
  - Label `ai:fixed` wird gesetzt
  - Label `ai:needs-review` wird gesetzt (zurück zu Phase 5)

## check-phase-label.sh Anpassung

Das Script `.github/scripts/check-phase-label.sh` prüft:

- Neue Trigger-Labels (`ai:needs-analyse`, `ai:needs-ux-ui`, `ai:needs-spec`, `ai:needs-impl`, `ai:needs-review`, `ai:needs-fixup`) sind **REQUIRED**
- Altes Label `ai:documented` ist **ABSENT** (nicht mehr vorhanden)

## Erwartetes Ergebnis

- Alle 6 Workflows triggern ausschließlich auf ihre neuen `ai:needs-*`-Labels
- Jede Phase setzt ihr Done-Label (`ai:analysed`, `ai:ux-reviewed`, `ai:specified`, `ai:implemented`, `ai:reviewed`, `ai:fixed`)
- Jede Phase setzt den Trigger der nächsten Phase (außer Phase 6, die zu Phase 5 zurückkehrt)
- `check-phase-label.sh` validiert die neuen Trigger und erkennt `ai:documented` als abwesend
- `pnpm format`, `pnpm lint`, `pnpm test` laufen erfolgreich durch

## Testfälle

Die 6 Haupt-Phasen-Workflows durchlaufen:

1. **Phase 1 Start:** Issue hat Label `ai:needs-analyse` → Workflow 01 läuft → Ergebnis: Labels `ai:analysed` + `ai:needs-ux-ui` gesetzt
2. **Phase 2 Start:** Issue hat Label `ai:needs-ux-ui` → Workflow 02 läuft → Ergebnis: Labels `ai:ux-reviewed` + `ai:needs-spec` gesetzt
3. **Phase 3 Start:** Issue hat Label `ai:needs-spec` → Workflow 03 läuft → Ergebnis: Labels `ai:specified` + `ai:needs-impl` gesetzt
4. **Phase 4 Start:** Issue hat Label `ai:needs-impl` → Workflow 04 läuft → Ergebnis: Labels `ai:implemented` + `ai:needs-review` gesetzt
5. **Phase 5 Start:** Issue hat Label `ai:needs-review` → Workflow 05 läuft → Ergebnis: Labels `ai:reviewed` + `ai:needs-fixup` gesetzt
6. **Phase 6 Start:** Issue hat Label `ai:needs-fixup` → Workflow 06 läuft → Ergebnis: Labels `ai:fixed` + `ai:needs-review` gesetzt (zurück zu Phase 5)

---

## Hinweise zur Validierung

Dies ist ein **CI/Workflow-Refactoring** – die Validierung erfolgt manuell im PR-Body durch:

- Review der Workflow-Dateien auf korrekte Trigger-Label
- Review der Label-Set-Steps auf korrekte Done-Label + Trigger-Label
- Prüfung der `check-phase-label.sh`-Anpassung
- Ausführung von `pnpm format && pnpm lint && pnpm test`

Automatisierte Tests für CI-Workflows sind nicht vorgesehen (Carve-Out für Nicht-Anwendungscode).
