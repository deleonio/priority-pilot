# Priority Pilot

Priority Pilot ist ein kleines Werkzeug zur **Aufgaben-Priorisierung**. Aufgaben (Tasks)
hängen über einen **gewichteten Abhängigkeitsgraphen** zusammen; daraus wird der
Wertbeitrag jeder Aufgabe berechnet, um die wichtigsten zuerst sichtbar zu machen.

## Monorepo-Aufbau

Verwaltet mit **pnpm Workspaces** (siehe [`pnpm-workspace.yaml`](pnpm-workspace.yaml)):

| Package            | Inhalt                                                            |
| ------------------ | ----------------------------------------------------------------- |
| [`server`](server) | Anwendung: Node.js + Express 5 + Sequelize 6 (SQLite). Fachlogik. |
| [`client`](client) | Generierter TypeScript-Fetch-API-Client (aus `openapi.yml`).      |

Der gemeinsame API-Vertrag liegt in [`openapi.yml`](openapi.yml). Daraus werden erzeugt:

- **Server:** `src/api.d.ts` via `openapi-typescript` (Build-Schritt `build:api`).
- **Client:** `src/generated/` via `openapi-generator-cli` (`typescript-fetch`).

## Fachlogik (Server)

- **Modelle** ([`task.ts`](server/src/models/task.ts), [`dependency.ts`](server/src/models/dependency.ts)):
  `Task` mit Status/Priorität/Aufwand/Deadline und einer `Task↔Task`-Beziehung mit
  `weight` pro Abhängigkeit.
- **Wertberechnung** ([`logics/value.ts`](server/src/logics/value.ts)): rekursiver,
  gewichteter Wertbeitrag eines Tasks aus seinen abhängigen Tasks plus eigener Priorität.
- **Aufgabenwald** ([`logics/tree.ts`](server/src/logics/tree.ts)): baut aus Wurzel-Tasks
  Bäume, summiert Aufwände inkl. Abhängigkeiten, sortiert nach Wert.
- **Nächste Aufgabe** ([`logics/find.ts`](server/src/logics/find.ts)): wichtigste Aufgabe,
  deren Abhängigkeiten alle `Done` sind.
- **Interaktive Konsole** ([`console.ts`](server/src/console.ts)): Menü zum Pflegen von
  Tasks/Abhängigkeiten inkl. Zyklusprüfung (derzeit in `index.ts` nicht aktiviert).

## Voraussetzungen

- **Node.js** `>=22`
- **pnpm** `10` (siehe `packageManager`)
- **Java (JRE)** – nur für `client`-Generierung (`openapi-generator-cli` läuft auf der JVM)

## Befehle (Repo-Root)

```bash
pnpm install        # Abhängigkeiten installieren
pnpm build          # Client generieren + Server bauen (alle Packages)
pnpm lint           # Lint über alle Packages
pnpm format         # Prettier über das gesamte Repo (eine zentrale Config)
pnpm update         # Dependencies via ncu auf latest + reinstall
```

Server gezielt:

```bash
pnpm --filter priority-pilot build   # openapi-typescript + tsc
pnpm --filter priority-pilot dev     # nodemon: build + run, Watch auf src/
pnpm --filter priority-pilot lint    # api.d.ts + tsc --noemit + eslint
```

## Umgebungsvariablen (Server)

| Variable   | Default | Wirkung                                                            |
| ---------- | ------- | ------------------------------------------------------------------ |
| `PORT`     | `3000`  | Port des Express-Servers.                                          |
| `DB_RESET` | `false` | Bei `true` wird die SQLite-DB beim Start verworfen (`sync force`). |

> Ohne `DB_RESET=true` bleiben vorhandene Daten erhalten; Demo-Daten werden nur in eine
> leere Datenbank gesät.

## API

`GET /users` → Liste von Nutzern `{ id: number, name: string }` (Beispiel-Endpoint aus
`openapi.yml`). Server und Vertrag laufen unter `http://localhost:3000`.
