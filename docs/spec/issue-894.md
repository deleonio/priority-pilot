# Issue 894: Neuer scheduled GitHub-Actions-Workflow

## Ziel

Täglich um 12:05 Uhr Europe/Berlin wird ein GitHub Actions Workflow automatisch ausgeführt.

## Vorbedingung

- GitHub Repository ist verfügbar
- GitHub Actions ist aktiviert

## Schritte

### 1. Workflow-Datei anlegen

- Datei `.github/workflows/<name>.yml` erstellen
- Name der Datei und des Workflows ist noch zu klären (hängt von der Aufgabe ab)

### 2. Trigger konfigurieren

- `schedule` Trigger mit `cron: '5 10 * * *'` (10:05 UTC = 12:05 Europe/Berlin Sommerzeit)
- Zusätzlicher `workflow_dispatch` Trigger für manuelle Ausführung
- Cron-Zeit entzerrt gegenüber bestehenden Runs (geprüft: 10:05 UTC ist frei)

### 3. Workflow-Struktur

- `name:` mit aussagekräftigem Namen
- `permissions:` minimal-privilegiert (nur erforderliche Scopes)
- Job-Definition hängt von der noch zu klärenden Aufgabe ab

### 4. Dokumentation

- Cron-Zeile mit UTC-Wert + Deutsch-Kommentar zur Europe/Berlin-Zeit
- Konform zu Repo-Konventionen

## Erwartetes Ergebnis

- Workflow-Datei existiert unter `.github/workflows/<name>.yml`
- Workflow läuft täglich um 12:05 Europe/Berlin automatisch
- Workflow ist manuell über GitHub UI ausführbar
- Label `infrastructure` ist am Issue/PR gesetzt

## Hinweis zu Tests

⚠️ **ADR 0001 Konflikt**: Dieses Issue betrifft eine GitHub Actions Workflow-Datei (`.github/workflows/*.yml`). Laut ADR 0001 ("GitHub Workflows bleiben ungetestet") werden Workflow-Definitionen nicht durch automatische Tests abgedeckt. Die Akzeptanzkriterien sind strukturell geprüft, aber es gibt keine Test-Abdeckung für YAML-Dateien. Fehler fallen laut auf beim Ausführen des Workflows.

## Blocker

Die konkrete Aufgabe des Workflows ist noch ungeklärt (siehe Issue "Offene Frage"). Mögliche Szenarien:

- Provider-Wechsel (wie Issue #893)
- Cache-/Maintenance-Cleanup
- Health-Check
- Report/Sync

Die Umsetzung des Job-Inhalts kann erst nach Klärung dieser Frage erfolgen.
