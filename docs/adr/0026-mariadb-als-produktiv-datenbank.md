# ADR 0026 — MariaDB als Produktiv-Datenbank

- **Status:** Accepted (2026-10-21)
- **Datum:** 2026-10-21
- **Kontext:** Entscheidungs-Abschnitt des Epics #2822

## Kontext

Balamentum läuft produktiv bislang auf SQLite: `server/src/database.ts` steht auf
`dialect: 'sqlite'`, die Schema-Migration fragt `sqlite_master` ab. Die App ist eine
Single-User-Anwendung — die Datenmenge bleibt klein, und genau deshalb hat SQLite bisher
gereicht. Mit dem Blick auf Produktivbetrieb (Reichweite über einen einzelnen Tester hinaus,
betriebsfähige Backups, Migrationen und ein Cloud-Setup, das auf dem Host schon existiert)
stellt sich die Datenbank-Frage neu.

Der Host betreibt bereits eine MariaDB-11.8-Instanz (u. a. für Matomo) mit etabliertem
Betrieb (Updates, Monitoring, Backup-Umfeld). Geprüfte Alternativen: eine eigene
MariaDB-Instanz, PostgreSQL, Beibehaltung von SQLite.

## Entscheidung

**1. MariaDB ersetzt SQLite als Produktiv-Datenbank.** Genutzt wird die bestehende
MariaDB-11.8-Instanz des Hosts (wie Matomo) statt einer separaten Instanz; Balamentum erhält
eine eigene Datenbank `balamentum` mit utf8mb4 und Kollation utf8mb4_general_ci.

**2. Treiber ist `mysql2`.** Sequelize läuft mit dem Dialekt `mysql` (MariaDB-kompatibel),
nicht mit dem `mariadb`-Connector.

**3. SQLite bleibt Rückfallpfad und Test-Medium.** Während der Migration läuft der
Produktionsbetrieb weiter auf SQLite; erst der Cutover schaltet um. Danach dient SQLite nur
noch der Testsuite (In-Memory) — der SQLite-Produktionspfad wird stillgelegt.

## Konsequenzen

- Die Umstellung kommt gestaffelt über die Folge-Tickets des Epics #2822 (Host-DB anlegen,
  Dialektwahl in `database.ts`, Typ-Audit der Modelle, Kopierwerkzeug, Parallelläufe, Cutover).
- Tests bleiben auf In-Memory-SQLite; zusätzlich entsteht ein MariaDB-Smoke-Test in CI.
- Keine Online-Replikation/CDC — eine nächtliche Kopie reicht bei dieser Datenmenge; der
  Cutover erfolgt in einem Wartungsfenster von Minuten nach sieben grünen Parallelläufen.
- Dieser ADR ändert keinen Code: `dialect: 'sqlite'` in `server/src/database.ts` bleibt
  unverändert, bis das Dialekt-Ticket ihn umstellt.
