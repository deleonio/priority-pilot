
---

## 11. MariaDB-Datenbank für den Cutover (#2822)

Angelegt 2026-10-24 auf `balamentum.modevel.de` (Epic #2822, P0):

- Datenbank `balamentum`, Zeichensatz `utf8mb4`, Kollation `utf8mb4_general_ci`.
- Benutzer `balamentum@localhost` (Passwort im Passwort-Speicher), Rechte **nur** auf
  `balamentum.*` (`GRANT ALL`), Anmeldung nur lokal (TCP `127.0.0.1` / Unix-Socket).
- Zugangsdaten liegen in der Env-Datei (`MARIADB_HOST/PORT/USER/PASSWORD/DATABASE`,
  chmod 600); `DB_DIALECT` bleibt bis zum Cutover **ungesetzt** — produktiv läuft weiter SQLite.
- Verifikation: `mysql -u balamentum -p -h 127.0.0.1 balamentum -e "SELECT 1;"`, danach
  `SHOW GRANTS` (nur `balamentum.*`).
- Matomo nutzt dieselbe MariaDB-Instanz mit eigener Datenbank `matomo` und bleibt unberührt.
