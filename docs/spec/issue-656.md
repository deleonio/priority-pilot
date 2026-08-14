# Spec: Nightly SQLite-Backup-Skript (Issue 656)

**Stand:** 2026-08-14  
**Ziel:** Automatisiertes, wartungsfreundliches Backup der Priority-Pilot-Datenbank mit Aufräumfunktion

---

## Ziel

Die Priority-Pilot-Datenbank (`database.sqlite`) wird nightly automatisch gesichert, alte Backups aufgeräumt, und das Skript kann per Cron zuverlässig ausgeführt werden.

## Vorbedingung

- SQLite-Datenbank existiert unter `DATABASE_STORAGE` (Default `./database.sqlite`)
- Schreibrechte im Repo-Root für `backups/`-Verzeichnis
- `sqlite3` CLI ist verfügbar (für `.backup`-Kommando)

## Schritte

### 1. Skript-aufruf unabhängig vom Arbeitsverzeichnis

**Aktion**: Skript aus beliebigem Verzeichnis aufrufen

```bash
/path/to/maintenance.sh  # aus beliebiger Location
cd /anderes/pfad && /path/to/maintenance.sh  # aus anderem Verzeichnis
```

**Ergebnis**: Skript resolves Pfad zur Datenbank relativ zum eigenen Verzeichnis (nicht relativ zu CWD)

### 2. Backup mit Datum/Zeit-Stamp erstellen

**Aktion**: Skript läuft automatisch (z.B. per Cron nightly 02:00)

```
0 2 * * * /path/to/maintenance.sh
```

**Ergebnis**:

- `backups/`-Verzeichnis wird angelegt (falls nicht existent)
- Neue Datei: `backups/database_2026-08-14_02-00-00.sqlite` (Format: YYYY-MM-DD_HH-MM-SS)
- Backup nutzt SQLite `.backup`-Kommando (konsistent bei aktiven Zugriffen)

### 3. Alte Backups aufräumen

**Aktion**: Skript läuft nightly, prüft vorhandene Backups
**Ergebnis**: Backups älter als 30 Tage werden automatisch gelöscht

### 4. Fehlertoleranz

**Aktion**: Fehler treten auf (keine Schreibrechte, Datenbank fehlt, etc.)
**Ergebnis**: Skript bricht sofort ab via `set -euo pipefail` (keine silent failure)

## Erwartetes Ergebnis

- **Datei-System**: `backups/*.sqlite`-Dateien existieren, max. 30 Tage alt
- **Git-Status**: `backups/` ist in `.gitignore` aufgeführt (Backups nicht im Repo)
- **Dokumentation**: README/Skript-Kommentar enthält Cron-Beispiel
- **Robustheit**: Skript bricht bei Fehlern ab (nicht silent weiter)

## Nicht-Ziele (Out of Scope)

- Tests für das Shell-Skript selbst (Carve-Out: Skript ist kein Anwendungscode)
- Tests für `.gitignore` (Config-Datei-Test → Carve-Out)
- Tests für Cron-Setup (Infrastruktur, nicht applikationsrelevant)
