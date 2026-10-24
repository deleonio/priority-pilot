# Spec: Täglicher SQLite→MariaDB-Parallellauf mit Identity-Bericht (#2928)

## Ziel

Ein Einzeiler-CLI-Skript (`server/src/scripts/mariadb-parallel-run.ts`, tsx) orchestriert die
fertigen Bausteine #2827 (Kopierkern `copySqliteToMariadb`) und #2829 (`verifyDbIdentity`,
`reportExitCode`) zu einem täglichen Lauf: konsistenter Snapshot der Produktiv-SQLite → Kopie in
die MariaDB-Schatten-DB → Identity-Prüfung → genau eine JSON-Zeile in der Report-Datei →
Status-Mail bei rot. Exit-Code 0 nur bei grünem Lauf (Vertrag `reportExitCode`, 0/1). Der Lauf
dient dem 7-Tage-Nachweis vor dem Cutover (ADR 0026): Datum + Status je Zeile erlauben, 7 grüne
Tage in Folge direkt abzulesen; rot beginnt den Streak neu.

## Vertrag des Orchestrierungskerns

- `runParallelCopy(deps): Promise<ParallelRunResult>` mit
  `deps = { sourceStorage: string; target: Sequelize; reportFile: string;
snapshot?: (sourceStorage: string) => Promise<string>; sendMail?: MailSender }` und
  `ParallelRunResult = { exitCode: 0 | 1; cause?: string }`. Injektions-Seams nach #1426-Muster:
  `snapshot` (Default: konsistenter SQLite-`.backup`-artiger Datei-Snapshot in eine Temp-Datei,
  Muster `maintenance.sh`) und `sendMail` (Default: nodemailer-Versand, Muster
  `startupStatusMail`). Tests reichen Spy/Mutation herein.
- Ablauf je Aufruf (AK1): Snapshot der Quelldatei → Kopie aus dem **Snapshot** in `target` mit
  `copySqliteToMariadb` (#2827) → `verifyDbIdentity(sourceLive, target)` (#2829) gegen die
  **Produktiv-Datei** (wie das CLI `verify-db-identity.ts`: die Kopie muss dem Produktionsstand
  entsprechen; Abweichung → rot) → Report-Zeile anhängen → bei rot Status-Mail.
- Report-Verzeichnis wird bei Bedarf angelegt (mkdir -p-Semantik) — der erste Cron-Lauf startet
  mit leerem Verzeichnis.
- `runParallelCopy` wirft nie nach außen: jede Exception aus Snapshot, Kopie oder Prüfung wird
  zu `exitCode: 1` + roter Report-Zeile mit `cause` (AK3 — kein Lauf ohne Report-Zeile).
- Report-Zeile (AK2), JSONL — je Lauf genau eine Zeile ans Dateiende:
  `{"date","ok","tables","rows","mismatched"[,"cause"]}` mit `date` = maschinenlesbares
  Datum/Zeit des Laufs (ISO, `Date.parse`-tauglich), `tables` = Anzahl geprüfter Tabellen,
  `rows` = Summe der Quell-Zeilen, `mismatched` = Anzahl abweichender Tabellen; `cause`
  (nicht-leere Ursache) nur auf roten Zeilen.
- Mail (AK5): nur bei rot; Empfänger wie Status-Mail (Admin-Nutzer, Muster
  `startupStatusMail`), Versand über den injizierten/produktiven `MailSender`
  (`logics/mail.ts`). Mail-Fehlschlag ändert den Exit-Code nicht — rot bleibt rot; grüner Lauf
  sendet keine Mail.
- Produktschutz (AK4): die Kopie liest ausschließlich aus dem Snapshot — die Produktiv-SQLite
  wird vom Lauf nicht verändert (byte-identisch, Checksummen-Vergleich vor/nach).
- CLI-Teil (`main`, nicht unit-getestet): Env wie Kopierer (`DATABASE_STORAGE`,
  `DB_DIALECT=mysql`, `MARIADB_*`), Report-Pfad per Env `MARIADB_PARALLEL_REPORT`, Default
  `<app>/mariadb-parallel/runs.log`; Exit-Code über `process.exitCode`.

## Testfälle (unit, `server/src/scripts/mariadb-parallel-run.test.ts`)

Quelldatei = temporäre dateibasierte SQLite mit den Tabellen `users` + `tasks` (2 Nutzer, davon
1 Admin, 3 Aufgaben), Ziel = Default-Instanz (im Test In-Memory) — Richtung wie Produktion.

| TF   | AK  | Verhalten                                                                                                                                 |
| ---- | --- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| TF1  | AK1 | Grüner Lauf: `exitCode === 0`, genau eine Report-Zeile (`ok`, `tables=2`, `rows=5`, `mismatched=0`); Report-Verzeichnis wird neu angelegt |
| TF2  | AK2 | Zwei Läufe → genau zwei JSON-Zeilen mit `date`/`ok`/`tables`/`rows`/`mismatched`, `Date.parse`-taugliches Datum                           |
| TF3a | AK3 | Veränderte Kopie (Snapshot fehlt eine Zeile → Identity-Mismatch) → `exitCode === 1`, rote Zeile mit nicht-leerer `cause`, `mismatched=1`  |
| TF3b | AK3 | Kopier-Exception (Snapshot wirft) → rote Zeile + `exitCode === 1`, kein Wurf nach außen                                                   |
| TF4  | AK5 | Roter Lauf ruft den Mail-Spy, grüner nicht; wirfender Mail-Spy ändert `exitCode === 1` nicht                                              |
| TF5a | AK4 | SHA-256 der Quelldatei vor/nach Lauf identisch                                                                                            |
| TF5b | AK4 | Injizierter Snapshot mit Zusatz-Aufgabe → Ziel enthält sie (Kopie liest Snapshot); Live-Datei kennt sie nicht → `exitCode === 1`          |

TF6 (AK6) ist manuell: Host-Nachweis im PR (Cron-Zeile 02:30 als `gh-deploy`, grüner Lauf,
künstlich roter Lauf) — kein CI-MariaDB, Präzedenz #2827 TF6, kein automatisierter Test.

## Doku (AK6)

`docs/server-setup.md` erhält einen Abschnitt Parallellauf: Report-Verzeichnis
(`MARIADB_PARALLEL_REPORT`), crontab-Zeile für `gh-deploy` (täglich 02:30, nach dem Backup um
02:00), Skript-Übertragung wie `maintenance.sh` (§9-Präzedenz).
