# Plan 5 — Cleanup: `userId`-Spalte an `pillars` entfernen

> Status: Entwurf · Risiko: **mittel** (Schema-Migration auf Bestands-DB) · Aufwand: ~1–2 h

## Hintergrund / Ziel

Mit #207 (Datenisolation) bekam `pillars` eine nullable `userId`-Spalte + einen Unique-Index
`pillars_name_user_id` auf `(name, userId)`. Der Bug-Fix (`579a398`) hat Säulen wieder zu **globalen
Stammdaten** gemacht: `userId` wird **nicht mehr gefiltert** — die Spalte und der Index sind nun
**dead code**, nur noch historisch/verwirrend vorhanden (siehe Kommentar in `pillar.ts:13-19, 63-65`).

Dieser Plan entfernt beides sauber: Modell, Unique-Index, Migration auf Bestands-DBs und die
entsprechenden Test-Aussagen. **Tasks behalten ihre `userId`** (Tasks bleiben nutzerbezogen —
unangetastet).

## Betroffene Dateien (komplett)

| Datei                               | Stelle                                                                                | Änderung                                                                                                                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server/src/models/pillar.ts`       | Z. 13–19 (`userId`-Feld), Z. 53 (column-def), Z. 63–65 (Index)                        | Feld + Spalte entfernen; Index von `(name, userId)` auf `(name)` umstellen (globale Namenseindeutigkeit der 5 Stammdaten)                                                          |
| `server/src/logics/migrate.ts`      | Z. 109–115 (`USER_ID_COLUMNS` enthält `pillars`), Z. 117–141 (`migrateUserIdColumns`) | `pillars` aus `USER_ID_COLUMNS` entfernen (nur `tasks` behalten); Doku anpassen                                                                                                    |
| `server/src/logics/migrate.ts`      | neu                                                                                   | `migratePillarDropUserId` anlegen (s. u.)                                                                                                                                          |
| `server/src/index.ts`               | `main()`                                                                              | neue Migration nach `migratePillarDescription` verdrahten                                                                                                                          |
| `server/src/logics/migrate.test.ts` | Z. 306–392 (`describe('migrateUserIdColumns')`)                                       | pillars-spezifische Aussagen entfernen (`columnsOf('pillars')` enthält userId, `pillars_name_user_id`-Index, „verschiedene Nutzer dürfen dieselbe Säule"); tasks-Aussagen behalten |
| `server/src/logics/migrate.test.ts` | neu                                                                                   | `describe('migratePillarDropUserId')` anlegen                                                                                                                                      |
| `server/src/express/requireAuth.ts` | —                                                                                     | **keine Änderung** (`ownerScope` wird weiterhin für `Task` genutzt)                                                                                                                |
| `server/src/models/index.ts`        | —                                                                                     | **keine Änderung** (es gibt keine `Pillar↔User`-Assoziation, s. Z. 41)                                                                                                             |

> Bestätigt vorab: keine `Pillar.belongsTo(User)` / `User.hasMany(Pillar)` — `users` steht für sich.
> Task-Queries mit `ownerScope(userId)` (tasks.ts, find.ts) bleiben korrekt (Tasks sind nutzerbezogen).

## Neue Migration `migratePillarDropUserId`

Sequenz (idempotent, läuft VOR `sync()`):

1. `PRAGMA table_info('pillars')` — nur weiter, wenn Tabelle existiert **und** noch `userId` hat.
2. Vorhandenen Unique-Index droppen: `DROP INDEX IF EXISTS \`pillars_name_user_id\``.
3. Spalte droppen: `ALTER TABLE \`pillars\` DROP COLUMN \`userId\``(SQLite ≥ 3.35 — Node ≥26 liefert das; Repo fordert ohnehin`Node >= 26`).
4. Neuen globalen Unique-Index anlegen: `CREATE UNIQUE INDEX \`pillars_name\` ON \`pillars\`(\`name\`)`
   — schützt die 5 Stammdaten-Namen global vor Duplikaten.

> Reihenfolge in `main()`: nach `migratePillarDescription` (das setzt voraus, dass die Tabelle steht),
> **vor** `sync()`. `sync()` legt anschließend den modellseitigen Index `name` an (falls noch nicht
> vorhanden) — die Migration stellt sicher, dass das ohne „duplicate index"-Konflikt klappt.

## Test-Strategie

- **Neu** `describe('migratePillarDropUserId')` (Spiegel zu `migratePillarDescription`):
  - Legacy-Tabelle mit `userId` + Index `pillars_name_user_id` → Migration droppt beides, legt
    `pillars_name` an.
  - Idempotenz: zweiter Lauf wirft nicht, keine Dubletten.
  - No-op, wenn Tabelle fehlt / `userId` nicht vorhanden (frische DB → `sync()` übernimmt).
  - Globaler Unique-Constraint auf `name` greift: zweiter Insert desselben Namens wird abgelehnt.
- **`migrateUserIdColumns`-Tests anpassen:** alle pillars-bezogenen Assertions entfernen
  (`for (const table of ['pillars','tasks'])` → nur noch `['tasks']`; den Test „hält den
  Unique-Constraint auf (name, userId)" für pillars streichen oder auf tasks-only umbauen).
- Negativ-Kontrolle (empfohlen): vor dem Modell-/Index-Umbau einmal den neuen Test laufen lassen →
  muss rot sein (weil Index/Spalte noch da). Erst dann implementieren.
- `pnpm --filter priority-pilot test` muss grün bleiben (insb. `pillars-dataisolation.test.ts`,
  `pillars.test.ts`, `find.test.ts`).

## Risiken / Rollback

- **Bestands-DB:** `DROP COLUMN` ist in SQLite seit 3.35 sicher; Node-bundled SQLite ist aktuell
  genug. Trotzdem: die Migration ist die einzige riskante Operation — sie entfernt produktiv Daten
  (die Spalte, die nirgends mehr Werte ≠ NULL trägt).
- **Index-Konflikt:** falls auf einer Bestands-DB bereits manuell ein Index `pillars_name` existierte,
  schlägt `CREATE UNIQUE INDEX` fehl → Migration mit `CREATE UNIQUE INDEX IF NOT EXISTS` absichern.
- **`sync()` ohne `alter`:** nach dem Drop legt das Modell (Index `name`) den Index nur an, wenn er
  fehlt — die Migration garantiert das konsistent.
- Rollback: `git revert` des Commits **PLUS** auf Bestands-DB manuell `userId`-Spalte wieder
  anlegen (die Daten waren eh `NULL`/ungenutzt → kein echter Datenverlust).
- Vor Produktiv-Deployment: Migration auf einer Kopie der echten `database.sqlite` probe-laufen.

## Abbruchbedingung

- Falls `DROP COLUMN` auf einer unterstützten SQLite-Version scheitert (sollte bei Node ≥26 nicht
  passieren): Plan stoppen, Owner entscheiden lassen (Alternative: Spalte enzymig weiter nullable
  stehen lassen, nur Index/Doku entfernen — halber Cleanup).

## Offene Fragen an den Owner

1. Globaler Unique-Index auf `name` **gewollt**? (Verhindert, dass jemals zwei gleichnamige
   Stammdaten-Säulen angelegt werden — bei festem 5er-Seed sinnvoll. Falls Säulen je künftig
   nutzereditierbar werden sollen, wäre er kontraproduktiv.)
2. Ein Commit oder zwei (Modell+Migration getrennt von Test-Anpassung)? Empfehlung: **ein**
   Commit (zusammenhängend).
