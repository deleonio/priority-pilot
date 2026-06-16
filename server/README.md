# `priority-pilot` (Server)

Node.js-Backend des [Priority-Pilot-Monorepos](../README.md): **Express 5 + Sequelize 6 (SQLite)**.
Enthält die gesamte Fachlogik (Wertberechnung inkl. Lebensbalance-Säulen, Aufgabenwald, nächste
Aufgabe, Zyklusprüfung) und stellt die REST-API bereit. Gemeinsamer API-Vertrag:
[`../openapi.yml`](../openapi.yml).

> Der npm-Name des Pakets ist **`priority-pilot`** (nicht `server`) — daher `--filter priority-pilot`.

## Server starten

Der Server lauscht auf **`http://localhost:3000`** (per `PORT` überschreibbar). Einstieg ist
[`src/index.ts`](src/index.ts) → kompiliert nach `dist/index.js`.

### Dev-Modus (serven mit Auto-Reload)

```bash
pnpm --filter priority-pilot dev
```

Startet **nodemon** ([`nodemon.json`](nodemon.json)): beobachtet `src/` und führt bei jeder
`.ts`-Änderung `pnpm build && node dist/index.js` aus — also **neu bauen + neu starten**.

> Kein hot-serve via ts-node/tsx: Auch im Dev-Modus wird erst nach `dist/` kompiliert und dann das
> JS gestartet. Einziger Unterschied zum Listen-Modus ist die Watch-/Rebuild-Schleife.

### Listen-Modus (gebaut, ohne Watch)

Es gibt **kein** `start`-Script, daher zwei Schritte:

```bash
pnpm --filter priority-pilot build   # build:api (openapi-typescript) + build:ts (tsc) → dist/
cd server && node dist/index.js      # lauscht auf http://localhost:3000
```

**Wichtig:** aus `server/` heraus starten — der SQLite-Pfad ist relativ
(`storage: './database.sqlite'`, [`src/database.ts`](src/database.ts)). Aus dem falschen
Verzeichnis entsteht sonst eine leere DB am falschen Ort. Alternativ ohne `cd` (führt im
Paket-Verzeichnis aus):

```bash
pnpm --filter priority-pilot exec node dist/index.js
```

## Tests

```bash
pnpm --filter priority-pilot test
```

Runner: **Node.js `node:test`** mit **`tsx`** als TypeScript-Loader (`--import tsx`). Alle Tests
laufen gegen eine In-Memory-SQLite-DB (`DATABASE_STORAGE=:memory:`); die Produktionsdatei
`database.sqlite` bleibt unberührt. API-Tests starten die Express-App auf einem Ephemeral-Port
(`:0`) und sprechen sie per globalem `fetch` an — kein supertest.

Testdateien: `src/**/*.test.ts`. Helper (kein Testfile): `src/test/helpers.ts`.

## Scripts

| Script      | Befehl                                               | Zweck                                         |
| ----------- | ---------------------------------------------------- | --------------------------------------------- |
| `build`     | `build:api` + `build:ts`                             | API-Typen erzeugen und TypeScript kompilieren |
| `build:api` | `openapi-typescript ../openapi.yml → src/api.d.ts`   | Server-Typen aus dem API-Vertrag              |
| `build:ts`  | `tsc`                                                | `src/` → `dist/`                              |
| `dev`       | `nodemon`                                            | Watch-Modus (build + run bei Änderungen)      |
| `lint`      | `build:api` + `tsc --noEmit` + `eslint src`          | Typen + Lint                                  |
| `test`      | `DATABASE_STORAGE=:memory: node --import tsx --test` | Unit- & API-Tests (`node:test` + `tsx`)       |

## Umgebungsvariablen

| Variable           | Default             | Wirkung                                                            |
| ------------------ | ------------------- | ------------------------------------------------------------------ |
| `PORT`             | `3000`              | Port des Express-Servers.                                          |
| `DB_RESET`         | `false`             | Bei `true` wird die SQLite-DB beim Start verworfen (`sync force`). |
| `DATABASE_STORAGE` | `./database.sqlite` | SQLite-Speicherort; die Tests setzen `:memory:`.                   |

Ohne `DB_RESET=true` bleiben Daten erhalten; Demo-Tasks werden nur in eine leere DB gesät
([`src/index.ts`](src/index.ts)).

```bash
PORT=8080 node dist/index.js       # anderer Port
DB_RESET=true node dist/index.js   # DB beim Start zurücksetzen
```

## Mehr

Architektur, Fachlogik und Gesamt-Setup: [Root-README](../README.md).
