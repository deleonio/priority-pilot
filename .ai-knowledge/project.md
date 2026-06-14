# Projekt: Priority Pilot

Werkzeug zur **Aufgaben-Priorisierung** über einen gewichteten Abhängigkeitsgraphen.
Pro Task werden Wertbeitrag (eigene Priorität + gewichtete Werte der abhängigen Tasks) und
Gesamtaufwand inkl. transitiver Abhängigkeiten berechnet. Fachliche Details: [../README.md](../README.md).

## Monorepo

pnpm-Workspace (siehe `pnpm-workspace.yaml`):

- `server/` (npm-Name **`priority-pilot`**): Node.js + Express 5 + Sequelize 6 (SQLite). Gesamte Fachlogik.
- `client/`: generierter TypeScript-Fetch-API-Client aus `openapi.yml` (kein handgeschriebener Code).

Gemeinsamer API-Vertrag: `openapi.yml`

- Server-Typen via `openapi-typescript` (`build:api` → `server/src/api.d.ts`)
- Client via `openapi-generator-cli` (`typescript-fetch`, braucht Java)

## Befehle

- `pnpm build` — Client generieren + Server bauen
- `pnpm lint` — Lint über alle Packages
- `pnpm format` — Prettier über das ganze Repo (eine zentrale Config im Root)
- `pnpm --filter priority-pilot dev` — Server im Watch-Modus (nodemon)

Bevorzugt **gezielt** statt repo-weit prüfen: `pnpm --filter priority-pilot build` bzw. `... lint`.

## Datenbank

- SQLite (`server/database.sqlite`). Im Normalbetrieb **kein** Reset.
- `DB_RESET=true` setzt die DB beim Start zurück; sonst bleiben Daten erhalten, Demo-Daten werden nur in eine leere DB gesät.
