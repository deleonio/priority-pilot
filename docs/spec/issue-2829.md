# Spec: Identitätsprüfung SQLite-Quelle ↔ MariaDB-Kopie (#2829)

## Ziel

Ein Einzeiler-CLI-Skript (`server/src/scripts/verify-db-identity.ts`) vergleicht nach der Migration
(#2827) die SQLite-Quelldatei mit der MariaDB-Kopie inhaltlich: Quelle = rohe, nur lesend genutzte
Sequelize-SQLite-Instanz auf `DATABASE_STORAGE`, Ziel = modelgebundene Default-Instanz
(`DB_DIALECT=mysql` + `MARIADB_*`, Env des Kopierers). Der Lauf ist strikt read-only — kein
`sync()`, kein Schreibzugriff auf eine der beiden DBs. Exit-Code 0 nur bei voller Übereinstimmung.

## Vertrag des Prüfkerns (`server/src/scripts/copy-sqlite-to-mariadb.ts` als Muster)

- `verifyDbIdentity(source: Sequelize, target: Sequelize): Promise<IdentityReport>` — Lauf-Kern
  (Seam, wie Kopierkern): Tabellenauswahl = Ziel-Modelle ∩ existierende Quell-Tabellen
  (Muster `selectedModels`); je Tabelle beide Seiten PK-geordnet fensterweise lesen (Speicher
  begrenzen) und zeilenweise vergleichen. Die FK-topologische Ordnung des Kopierers entfällt —
  der Lauf liest nur und schreibt nichts.
- `canonicalRowHash(row: Record<string, unknown>): string` — SHA-256 über die kanonisierte Zeile
  (AK4): Datum als `Date` oder ISO-String, mit/ohne Millisekunden, mit/ohne Offset (auch die
  Sequelize-SQLite-Textform `YYYY-MM-DD HH:MM:SS.mmm +00:00`) → ISO-8601 UTC mit ms (ohne ms =
  `.000`; Sub-Sekunden-Differenzen bleiben sichtbar, Ziel-Spalten DATE(3)); exakte Mitternacht UTC
  und DATEONLY (`YYYY-MM-DD`-Text ↔ Mitternachts-`Date`) → `YYYY-MM-DD`; Boolean
  (`true`/`false` ↔ `1`/`0`) → 0/1; JSON als Text oder geparst → geparst + key-sortiert
  stringifiziert; BLOB als `Buffer` oder Hex-String → Hex; vergleichbare logische Werte beider
  Dialekt-Darstellungen ergeben denselben Hash, verschiedene Werte verschiedene Hashes.
- `requireMariaDbTarget(db: { getDialect(): string }): void` — Guard: dialekt != `mysql` → klare
  Fehlermeldung mit `DB_DIALECT=mysql` und `MARIADB_*` (Wortlaut Muster Kopierer).
- `reportExitCode(report: IdentityReport): 0 | 1` — 0 nur bei `ok`, sonst 1.
- Typen: `TableIdentity { table: string; source: number; target: number; match: boolean;
differingPks: string[] }` (Zeilenzahl Quelle/Ziel, Hashvergleich, PKs abweichender Zeilen als
  String) und `IdentityReport { tables: TableIdentity[]; ok: boolean }` mit
  `ok = je Tabelle Zeilenzahl gleich && match`.

Der CLI-Teil (`main`) ist nicht unit-getestet: Env-Guards wie Kopierer (`DATABASE_STORAGE`,
`requireMariaDbTarget`), Bericht auf stdout (je Tabelle Name, Zeilenzahl Quelle/Ziel,
Hashergebnis, abweichende PKs), Exit-Code über `reportExitCode`. Die Einzeiler-Doku (AK3) steht im
Skript-Header — Doku ist nicht unit-testbar, Nachweis durch Review.

## Ablauf

1. Einzeiler auf dem Host mit der Env des Kopierers starten (tsx).
2. Skript liest beide DBs tabellenweise, kanonisiert und hasht je Zeile, vergleicht PK-geordnet.
3. Bericht auf stdout; Abweichungen nennen Tabelle + PK; Exit 0 nur bei voller Übereinstimmung.

## Erwartete Ergebnisse

- AK1: identischer Inhalt → `ok = true`, Bericht je Tabelle mit Zeilenzahl Quelle/Ziel und
  Hashvergleich, `reportExitCode` = 0.
- AK2: eine bewusst veränderte Zeile in der Kopie — je Variante Text, Datum, Boolean, JSON, BLOB —
  → `ok = false`, Bericht nennt Tabelle + PK der abweichenden Zeile, `reportExitCode` = 1.
- AK3: Ziel-Guard ohne `DB_DIALECT=mysql` wirft klare Fehlermeldung; Einzeiler-Aufruf nur mit der
  Env des Kopierers, dokumentiert im Skript-Header.
- AK4: dieselben logischen Werte in SQLite- und MariaDB-Darstellung (Datum mit/ohne Millisekunden,
  Boolean 1/true, JSON als Text oder geparst, BLOB als Buffer oder Hex) kanonisieren zum selben
  Zeilenhash.

## Testabdeckung

| TF  | AK    | Ebene   | Datei                                                                                                    |
| --- | ----- | ------- | -------------------------------------------------------------------------------------------------------- |
| TF1 | AK1   | unit    | `server/src/scripts/verify-db-identity.test.ts`                                                          |
| TF2 | AK2   | unit    | dito (5 Varianten: Text/Datum/Boolean/JSON/BLOB)                                                         |
| TF3 | AK3   | unit    | dito (Dialekt-Guard, Muster Kopierer TF5)                                                                |
| TF4 | AK4   | unit    | dito (Kanonisierung, plus Gegenproben)                                                                   |
| TF5 | AK1/2 | manuell | Host-Nachweis gegen echte MariaDB durch die Impl-Phase, Bericht im PR (MariaDB steht in CI nicht bereit) |

## Nicht-Ziele

- Keine Änderung am Kopierer `copy-sqlite-to-mariadb.ts` (#2827 bleibt unangetastet).
- Keine Reparatur/Neukopie im Verifikationslauf — das Skript vergleicht nur.
