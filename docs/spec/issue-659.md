# Spec: GitHub Actions Workflow für Issue/PR-Events (Issue 659)

**Stand:** 2026-08-14  
**Ziel:** Workflow-Struktur für Issue/PR-Events und Label-Trigger als YAML-Outline

---

## Ziel

GitHub Actions Workflow reagiert auf Issue- und PR-Events sowie Label-Änderungen, um automatisierte Prozesse auszulösen.

## Vorbedingung

- GitHub Repository ist aktiv und CI ist enabled
- Grundstruktur aus #658 ist verfügbar (GitHub Actions Setup)
- Workflow-Dateien werden unter `.github/workflows/` erwartet

## Schritte

### 1. Workflow-Struktur skizzieren

**Aktion**: YAML-Outline erstellen mit Basic-Workflow-Struktur

```yaml
name: Workflow Name
on:
  # Trigger-Events hier
jobs:
  job-name:
    runs-on: ubuntu-latest
    steps:
      - name: Step-Name
        # Action-Referenz oder Shell-Kommando
```

**Ergebnis**: Klare Struktur ist definiert (name, on, jobs, steps)

### 2. Trigger-Events spezifizieren

**Aktion**: Workflow reagiert auf relevante GitHub Events

**Erwartete Events**:

- `issue_comment`: Kommentare auf Issues
- `pull_request`: PR-Events (opened, closed, synchronize, etc.)
- `issues`: Issue-Events mit Label-Änderungen (`labeled`, `unlabeled`)
- `pull_request_target`: PR-Label-Änderungen (`labeled`, `unlabeled`)

**Ergebnis**: Workflow-Datei enthält `on:`-Sektion mit allen relevanten Events

### 3. Testfall: Trigger auslösen und validieren

**Aktion**: Manuelles Testen der Trigger-Funktionalität

**Test-Szenario 1 - Label-Trigger**:

```bash
# Label `ai:spec-ready` auf Issue 659 setzen
gh label add ai:spec-ready --repo $REPO 659
```

**Erwartetes Ergebnis**: Workflow feuert (sichtbar in Actions-Tab)

**Test-Szenario 2 - Kommentar-Trigger**:

```bash
# Kommentar auf PR hinzufügen
gh pr comment 123 --body "Test-Kommentar"
```

**Erwartetes Ergebnis**: Workflow feuert (sichtbar in Actions-Tab)

## Erwartetes Ergebnis

- **Spec-Datei**: `.github/workflows/<name>.yml` mit Struktur-Outline
- **Trigger-Konfiguration**: `on:`-Sektion definiert alle relevanten Events
- **Validierung**: Manuelles Label-Setzen → Workflow-Run ist in GitHub Actions sichtbar
- **Dokumentation**: Kommentare im Workflow erklären Trigger-Purpose

## Nicht-Ziele (Out of Scope)

- Implementierung der Workflow-Steps (nur Skizze/Outline)
- Tests für Workflow-Datei (.github/workflows/*.yml → Carve-Out: kein Anwendungscode)
- Produktive Deployment-Integration (nur Struktur-Definition)
- Workflow-Secrets oder komplexe Logik (nur Trigger-Struktur)
