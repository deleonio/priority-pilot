#!/bin/bash
# maintenance.sh - Nightly SQLite-Backup-Skript für Priority-Pilot
# Usage: ./maintenance.sh oder via Cron: 0 2 * * * /path/to/maintenance.sh

set -euo pipefail

# Konfiguration
DATABASE_STORAGE="${DATABASE_STORAGE:-./database.sqlite}"
BACKUP_DIR="backups"
RETENTION_DAYS=30

# Skript-Verzeichnis ermitteln (für absolute Pfade)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Datenbank-Pfad auflösen (relativ zum Skript-Verzeichnis)
if [[ "$DATABASE_STORAGE" == ./* ]]; then
  DATABASE_PATH="$SCRIPT_DIR/${DATABASE_STORAGE#./}"
else
  DATABASE_PATH="$DATABASE_STORAGE"
fi

# Backups-Verzeichnis anlegen
mkdir -p "$BACKUP_DIR"

# Datum/Zeit für Backup-Dateinamen
DATETIME=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_FILE="$BACKUP_DIR/database_${DATETIME}.sqlite"

# Backup erstellen mit SQLite .backup (konsistent bei aktiven Zugriffen)
if [[ -f "$DATABASE_PATH" ]]; then
  sqlite3 "$DATABASE_PATH" ".backup '${BACKUP_FILE}'" || {
    echo "FEHLER: SQLite-Backup fehlgeschlagen" >&2
    exit 1
  }
  echo "Backup erstellt: ${BACKUP_FILE}"
else
  echo "WARNUNG: Datenbank nicht gefunden: ${DATABASE_PATH}" >&2
  exit 1
fi

# Alte Backups löschen (älter als RETENTION_DAYS)
find "$BACKUP_DIR" -name "database_*.sqlite" -type f -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true
echo "Backups älter als ${RETENTION_DAYS} Tage wurden gelöscht"

echo "Maintenance abgeschlossen"