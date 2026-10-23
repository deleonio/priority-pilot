# Spec #2825 — Server: Dialektwahl in database.ts — MariaDB per Env, SQLite bleibt Standard

**Stand:** 2026-10-22
**Grundlage:** ADR 0026 (MariaDB als Produktiv-Datenbank — Treiber `mysql2`, Sequelize-Dialekt `mysql`), Harness-Analyse #2825

## Journey: Serverstart je Dialekt

### Ziel

`database.ts` baut die Sequelize-Instanz aus der Env. Mit `DB_DIALECT=mysql` und
`MARIADB_HOST/PORT/USER/PASSWORD/DATABASE` läuft derselbe Code gegen MariaDB — mit UTC-Connector-
Zeitzone und eigener Pool-Konfiguration. Ohne diese Env bleibt das heutige SQLite-Verhalten
bytegleich. Ein ungültiger `DB_DIALECT`-Wert scheitert früh mit klarer Fehlermeldung.

Die Env-→-Optionen-Zuordnung ist eine reine Funktion `buildDatabaseOptions(env)` als benannter
Export von `database.ts`; der Default-Export (die Sequelize-Instanz) nutzt sie. So ist die
Konfiguration ohne Verbindungsaufbau prüfbar.

### Schritte

1. **MariaDB-Env** — `DB_DIALECT=mysql`, vollständige `MARIADB_*`-Werte gesetzt
   - Optionen: Dialekt `mysql`; Host, Port, Benutzername, Passwort, Datenbank aus der Env;
     `timezone: '+00:00'`; Pool-Konfiguration gesetzt (nur im mysql-Zweig)
2. **Ohne MariaDB-Env** — `DB_DIALECT` fehlt oder ist `sqlite` (MARIADB-Envs ggf. vorhanden)
   - Optionen unverändert wie heute: Dialekt `sqlite`, `DATABASE_STORAGE` (Default
     `./database.sqlite`), `:memory:` behält den Ein-Pool (`pool.max === 1`), `logging: false`;
     keine MariaDB-Felder (host/timezone/pool ungesetzt), `MARIADB_*` ignoriert
3. **Ungültiger Dialekt** — `DB_DIALECT` weder leer/`sqlite` noch `mysql`
   - Bauen der Optionen wirft einen Fehler, dessen Meldung `DB_DIALECT` nennt — statt irgendwo
     in Sequelize zu scheitern
4. **Legacy-Migrationen je Dialekt** — die SQLite-exklusiven Roh-SQL-Pfade (`PRAGMA`,
   `sqlite_master`) in `migrate.ts` und der Inline-Migration in `index.ts`
   - Unter Dialekt `mysql` werden sie beim Start nicht ausgeführt (frische balamentum-DB: die
     Migrationen wären dort ohnehin No-op); `sync()` legt die Tabellen an
   - Unter `sqlite` laufen die Migrationen unverändert
   - Der echte Start gegen die Host-MariaDB bleibt dem Smoke-Test-/Parallellauf-Ticket des
     Epics #2822 vorbehalten — hier ist nur die Guard-Logik vertraglich

### Erwartetes Ergebnis

- AK1: `buildDatabaseOptions` liefert bei `DB_DIALECT=mysql` die MariaDB-Optionen aus der Env mit
  `timezone: '+00:00'` und Pool; ein ungültiger `DB_DIALECT`-Wert wirft früh eine klare Fehlermeldung
- AK2: ohne MariaDB-Env entsteht unverändert die heutige SQLite-Konfiguration; die bestehende
  Testsuite bleibt grün (Gate, läuft ohnehin mit `DATABASE_STORAGE=:memory:`)
- AK3: unter Dialekt `mysql` senden die Legacy-Migrationen keine `PRAGMA`-/`sqlite_master`-Abfragen;
  unter `sqlite` fragen sie das Schema unverändert ab
- AK4: `server/.env.example` dokumentiert `DB_DIALECT` und `MARIADB_HOST/PORT/USER/PASSWORD/DATABASE`
  inkl. Hinweis auf den SQLite-Default — reine Doku, kein Testfall, Prüfung im Review

### Testfälle und Mapping

| TF  | AK       | Ebene                      | Datei                                                                                                                                                                          |
| --- | -------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TF1 | AK1, AK2 | node:test unit             | neu `server/src/database.test.ts` — `buildDatabaseOptions` (mysql-Env, sqlite-Default, `:memory:`-Pool, ungültiger Dialekt)                                                    |
| TF2 | AK3      | node:test unit (Query-Spy) | neu `server/src/logics/migrate-dialect-guard.test.ts` — `migrateSeriesRenameFields`, `migratePillarPerUser`, `migratePillarRestore` unter mysql ohne Roh-SQL, unter sqlite mit |
| TF3 | AK2      | Gate                       | komplette bestehende Suite ohne MariaDB-Env grün                                                                                                                               |
| AK4 | AK4      | Review                     | `.env.example`, kein Test                                                                                                                                                      |

### Nicht Gegenstand dieses Tickets

- Echter Verbindungsaufbau/Start gegen MariaDB (Smoke-Ticket des Epics #2822) und `mysql2` als
  Abhängigkeit (Impl-Phase)
- DB-Anlage inkl. Charset/Kollation auf dem Host (#2823)
- Session-Store (`connect-sqlite3`) und Migration von Bestandsdaten unter mysql
