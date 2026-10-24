# Spec: Server: Reverse-Kopierwerkzeug MariaDB→SQLite (#2830)

## Ziel

Gegenstück zum Kopierwerkzeug SQLite→MariaDB (#2827): ein einmal lauffähiges Skript überführt den
MariaDB-Stand zurück in eine frische SQLite-Datei — inklusive Schreib-Delta seit dem Cutover.
Quelle ist die modelgebundene Default-Sequelize-Instanz (`DB_DIALECT=mysql` + `MARIADB_*`, Optionen
aus `buildDatabaseOptions`), Ziel eine neue, leere SQLite-Sequelize-Instanz auf dem
`DATABASE_STORAGE`-Pfad. Jeder Lauf baut das Zielschema frisch auf und kopiert alle Tabellen
batchweise — der Lauf ist beliebig wiederholbar (Idempotenz).

## Vertrag des Reverse-Kopierkerns (`server/src/scripts/copy-mariadb-to-sqlite.ts`)

Die Modelle hängen per `Model.init` an der Default-Instanz — im Reverse-Lauf also an der Quelle.
Auf dem frischen Ziel ist `target.models` leer; der Reverse-Kern bekommt die Modelle deshalb
explizit übergeben (Seam, AK1) und stellt folgende Exporte bereit:

- `copyMariadbToSqlite(source: Sequelize, target: Sequelize, models: ModelStatic[]): Promise<CopyReport>`
  - Zielschema drop+sync frisch aus den übergebenen Modellen (kein Verlass auf `target.models`).
  - die Modelle werden für den Lauf auf dem Ziel registriert, damit die bestehende
    Berichts-/Blob-Prüfung des Vorwärts-Werkzeugs (`buildCopyReport`, `verifyInvoiceBlobs`)
    unverändert auf der Reverse-Kopie funktioniert (AK2/AK3).
  - je Tabelle genau eine Transaktion; darin FK-Checks aus (`setForeignKeyChecks`), Zeilen per
    rohem `SELECT *` lesen und mit erhaltenen Primärschlüsseln batchweise schreiben, FK-Checks
    wieder an; Reihenfolge FK-topologisch; JSON-Spalten (liegen im rohen SELECT als String vor)
    einfach kodiert übernehmen — die Logik des Vorwärts-Werkzeugs wird wiederverwendet, nicht
    dupliziert.
- `assertReverseCliEnv(env: { DB_DIALECT?: string; DATABASE_STORAGE?: string }): void` —
  CLI-Guard (AK4): wirft mit klarer Meldung, wenn `DB_DIALECT` nicht `mysql` ist (die Quelle muss
  MariaDB sein) oder `DATABASE_STORAGE` fehlt (Zielpfad der neuen SQLite-Datei).
- Wiederverwendete, unveränderte Exporte aus `copy-sqlite-to-mariadb.ts`:
  `buildCopyReport(source, target)`, `verifyInvoiceBlobs(source, target)`, `reportExitCode(report)`,
  `setForeignKeyChecks(...)`; Typen `CopyReport`/`TableCount`/`BlobSample`.

Der CLI-Teil (`main`) ist nicht unit-getestet: liest die Env über den Guard, baut die frische
SQLite-Ziel-Instanz, schreibt den Zeilenzahl-Bericht auf stdout und setzt den Exit-Code über
`reportExitCode`.

## Ablauf

1. Lauf starten (tsx) mit `DB_DIALECT=mysql`, `MARIADB_*` und `DATABASE_STORAGE` = Pfad der neuen
   SQLite-Datei.
2. Guard prüft die Env; das Skript baut das Zielschema frisch, kopiert alle Tabellen und prüft
   Zählungen sowie PDF-Stichprobe.
3. Bericht auf stdout; Exit-Code 0 nur bei vollständiger Übereinstimmung.

## Erwartete Ergebnisse

- AK1: Reverse-Kopierkern als Funktion mit zwei Sequelize-Parametern und expliziter
  Modell-Übergabe; frisch gesynctes Ziel, alle IDs und FK-Werte erhalten.
- AK2: Änderungen in der Quelle (geänderte/hinzugefügte Zeilen) landen im frischen Ziel;
  Zeilenzahlen je Tabelle identisch, `ok=true`, Exit-Code 0; jede Abweichung → Exit-Code != 0.
- AK3: Identitätsprüfung des Ergebnisses gegen die Quelle: Zeilenzahl je Tabelle plus
  BLOB-Stichprobe (mindestens 10 Rechnungen mit `pdfBytes`, falls vorhanden, bytegleich via
  `Buffer.equals`).
- AK4: CLI-Guard (Lauf nur mit `DB_DIALECT=mysql` als Quelle und gesetztem `DATABASE_STORAGE`);
  JSON-Spalten (`tasks.checklist`, `invoices.lineItems`) kommen einfach kodiert (geparst) an,
  nicht doppelt kodiert.
