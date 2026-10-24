docs(server-setup): MariaDB-Host-Datenbank für den Cutover dokumentieren (#2824)

Closes #2824

## Was

Neuer Abschnitt „11. MariaDB-Datenbank für den Cutover (#2822)" in `docs/server-setup.md`:
Datenbank `balamentum` (utf8mb4/utf8mb4_general_ci), Benutzer `balamentum@localhost` mit
Rechten ausschließlich auf `balamentum.*`, Ablage der Zugangsdaten in der Host-Env-Datei,
Verifikationsbefehle, Hinweis auf unangetastetes Matomo.

## Erledigt auf dem Host (2026-10-24)

- `CREATE DATABASE balamentum CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci` ✓
- `CREATE USER 'balamentum'@'localhost'` + `GRANT ALL PRIVILEGES ON balamentum.*` ✓
- Login-Test (`SELECT 1` über 127.0.0.1) und `SHOW GRANTS` verifiziert ✓
- `MARIADB_*` in die Env-Datei eingetragen (chmod 600); `DB_DIALECT` bleibt ungesetzt,
  produktiv läuft unverändert SQLite ✓
- Passwort liegt im Passwort-Speicher des Autors (bewusst nicht in Repo oder Issue).

Cutover selbst bleibt #2833 nach Freigabe (#2832) mit 7 grünen Soak-Tagen.
