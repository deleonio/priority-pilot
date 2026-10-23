# Spec: Server: Kopierwerkzeug SQLite→MariaDB mit Neuaufbau aus den Modellen (#2827)

## Ziel

Ein einmal lauffähiges Kopierskript überführt die Produktions-SQLite-Datei in die MariaDB (ADR 0026):
Ziel ist die modelgebundene Default-Sequelize-Instanz (`DB_DIALECT=mysql` + `MARIADB_*`, Optionen aus
`buildDatabaseOptions`), Quelle eine rohe, nur lesend genutzte Sequelize-SQLite-Instanz auf der
Storage-Datei. Jeder Lauf droppt und synct das Zielschema frisch aus den Modellen (`sync({ force: true })`)
und kopiert danach alle Tabellen batchweise — der Lauf ist daher beliebig wiederholbar (Idempotenz).

## Vertrag des Kopierkerns (`server/src/scripts/copy-sqlite-to-mariadb.ts`)

Der Kopierkern ist als Funktion mit zwei Sequelize-Parametern ausgeprägt (Seam, AK4) und stellt
folgende Exporte bereit:

- `copySqliteToMariadb(source: Sequelize, target: Sequelize): Promise<CopyReport>`
  - `target.sync({ force: true })` — drop+sync aus den Modellen (AK2).
  - Tabellenauswahl = Ziel-Modelle ∩ existierende Quell-Tabellen (Existenzprüfung dialektneutral).
  - je Tabelle genau eine Transaktion; darin FK-Checks aus (`setForeignKeyChecks(…, false)`), Zeilen
    per `SELECT *` lesen und per `bulkCreate` mit erhaltenen Primärschlüsseln schreiben
    (`individualHooks: false`), FK-Checks wieder an; Reihenfolge FK-topologisch.
- `buildCopyReport(source: Sequelize, target: Sequelize): Promise<CopyReport>` — Zähllogik:
  je Tabelle `TableCount { table, source, target }` plus BLOB-Stichprobe (`blobs`).
- `verifyInvoiceBlobs(source: Sequelize, target: Sequelize): Promise<BlobSample>` — Stichprobe
  (AK3): alle Rechnungen mit `pdfBytes` in der Quelle, mindestens 10 falls vorhanden; Vergleich von
  Länge und Byteinhalt (`Buffer.equals`).
- `reportExitCode(report: CopyReport): 0 | 1` — 0 bei sauberem Lauf, sonst 1 (AK1).
- `setForeignKeyChecks(db: Sequelize, enable: boolean, transaction?: Transaction): Promise<void>` —
  dialektabhängiges Session-Statement auf der (Transaktions-)Verbindung: unter mysql nur
  `SET FOREIGN_KEY_CHECKS = 0/1`, unter sqlite nur `PRAGMA foreign_keys = OFF/ON`; niemals die
  fremde Familie (TF5, Muster `migrate-dialect-guard.test.ts`).

Typen: `TableCount { table: string; source: number; target: number }`,
`BlobSample { checked: number; mismatched: number }`,
`CopyReport { tables: TableCount[]; blobs: BlobSample; ok: boolean }` mit
`ok = alle Zeilenzahlen gleich && blobs.mismatched === 0`.

Der CLI-Teil (`main`) ist nicht unit-getestet: baut Ziel-Env (`DB_DIALECT=mysql`, `MARIADB_*`) und
rohe SQLite-Quelle (`DATABASE_STORAGE`), schreibt den Bericht als Tabelle (Name + Zeilenzahl Quelle/
Ziel je Tabelle) auf stdout und setzt den Exit-Code über `reportExitCode`.

## Ablauf

1. Lauf starten (tsx) gegen MariaDB mit `MARIADB_*`-Env und SQLite-Datei.
2. Skript droppt/synct das Zielschema, kopiert alle Tabellen, prüft Zählungen und PDF-Stichprobe.
3. Bericht auf stdout; Exit-Code 0 nur bei vollständiger Übereinstimmung.

## Erwartete Ergebnisse

- AK1: Bericht je Tabelle mit Quell-/Ziel-Zeilenzahl; jede Abweichung → Exit-Code != 0.
- AK2: zweiter Lauf auf dieselbe MariaDB liefert denselben Endzustand (drop+sync, keine Duplikate).
- AK3: kopierte Rechnungs-PDFs sind in einer Stichprobe (mindestens 10 mit `pdfBytes`, falls
  vorhanden) bytegleich — Länge und Byteinhalt.
- AK4: Kopierkern mit zwei In-Memory-SQLite-DBs testbar; alle IDs und FK-Werte bleiben erhalten.

## Testabdeckung

| TF  | AK                    | Ebene   | Datei                                                                                                                                         |
| --- | --------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| TF1 | AK4                   | unit    | `server/src/scripts/copy-sqlite-to-mariadb.test.ts`                                                                                           |
| TF2 | AK2                   | unit    | dito                                                                                                                                          |
| TF3 | AK3                   | unit    | dito                                                                                                                                          |
| TF4 | AK1                   | unit    | dito                                                                                                                                          |
| TF5 | Dialekt-Guard         | unit    | dito                                                                                                                                          |
| TF6 | AK1/AK2 Host-Nachweis | manuell | kein CI-Test — MariaDB steht in CI nicht bereit; Lauf gegen echte MariaDB mit Produktionskopie durch die Impl-Phase, Bericht im PR festhalten |

## Nicht-Ziele

- Keine Änderung an `server/src/logics/migrate.ts` — Migrationen unter mysql bleiben No-op (#2825).
- Kein regelmäßiger/Scheduled-Betrieb: das Skript ist ein einmaliges Migrationswerkzeug.
