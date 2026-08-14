# Test-Protokoll: GitHub Actions Workflow Trigger (Issue 659)

**Test-Ebene**: Manuelles Test-Protokoll (GitHub Actions Workflows unterliegen Carve-Out - kein Anwendungscode)

## Test-Szenarien

### Test 1: Label-Trigger auf Issue

**Akzeptanzkriterium**: "Label `ai:spec-ready` auf Issue → Workflow feuert"

**Vorgehensweise**:

```bash
# Label auf Issue setzen
gh label add ai:spec-ready --repo $REPO 659
```

**Erwartetes Ergebnis**:

- [ ] Neuer Workflow-Run erscheint in GitHub Actions Tab
- [ ] Run zeigt Trigger: "labeled" Event auf Issue 659
- [ ] Workflow-Name erscheint in Actions-Liste

**Status**: ⬜ (durchzuführen nach Workflow-Implementierung)

---

### Test 2: PR-Kommentar Trigger

**Akzeptanzkriterium**: "Kommentar auf PR → Workflow feuert"

**Vorgehensweise**:

```bash
# Test-Kommentar auf PR setzen (existierende PR nutzen)
gh pr comment 123 --body "Test-Kommentar für Workflow-Trigger"
```

**Erwartetes Ergebnis**:

- [ ] Neuer Workflow-Run erscheint in GitHub Actions Tab
- [ ] Run zeigt Trigger: "issue_comment" Event
- [ ] Workflow ist sichtbar und läuft durch

**Status**: ⬜ (durchzuführen nach Workflow-Implementierung)

---

### Test 3: Multi-Trigger Validierung

**Akzeptanzkriterium**: "Workflow reagiert auf alle definierten Events"

**Vorgehensweise**:

```bash
# Verschiedene Trigger-Events manuell auslösen
# 1. PR Label hinzufügen
gh pr edit 123 --add-label "test-label"
# 2. Issue Label entfernen
gh label remove ai:spec-ready 659
```

**Erwartetes Ergebnis**:

- [ ] Jedes Event löst entsprechenden Workflow-Run aus
- [ ] Trigger-Information ist korrekt im Run-Log sichtbar

**Status**: ⬜ (durchzuführen nach Workflow-Implementierung)

## Spec-basierte Validierung

### Workflow-Struktur-Kriterien

Aus `docs/spec/issue-659.md` abgeleitete Validierung:

**Muss-Eigenschaften** (manuell zu prüfen nach Implementierung):

- [ ] Workflow-Datei existiert unter `.github/workflows/*.yml`
- [ ] `name:` Feld ist gesetzt
- [ ] `on:` Sektion enthält: `issue_comment`, `pull_request`, `issues`, `pull_request_target`
- [ ] `jobs:` Sektion definiert mindestens einen Job
- [ ] Job hat `runs-on: ubuntu-latest` und `steps:` Array

**Validierungsmethode**: GitHub Workflow-Editor in UI oder `gh workflow view`

---

## Hinweis zur Carve-Out-Entscheidung

GitHub Actions Workflow-Dateien (.github/workflows/*.yml) sind kein Anwendungscode im Sinne von server/src/**, frontend/src/** oder frontend/e2e/**. Sie fallen unter den NICHT-ANWENDUNGSCODE-CARVE_OUT (ADR 0001):

- Workflow-Dateien sind Infrastruktur-Konfiguration
- String/YAML-Match auf diese Dateien ist ein reiner Change-Detector
- Führt zu keinen echten Fehlern (der Workflow läuft trotzdem)

**Lösung**: Manuelles Test-Protokoll statt automatisierter roter Tests. Die Validierung erfolgt über:

1. GitHub Actions UI / CLI (`gh workflow list`, `gh run view`)
2. Manuelles Auslösen der Trigger-Events
3. Sichtbarkeit der Workflow-Runs in GitHub

Dies entspricht dem Akzeptanzkriterium "Testfall: Trigger auslösen" aus dem Issue.
