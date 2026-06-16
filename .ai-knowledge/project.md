# Projekt: Priority Pilot

Werkzeug zur **Aufgaben-Priorisierung** über einen gewichteten Abhängigkeitsgraphen.
Pro Task werden Wertbeitrag (eigene Priorität + gewichtete Werte der abhängigen Tasks) und
Gesamtaufwand inkl. transitiver Abhängigkeiten berechnet. Fachliche Details: [../README.md](../README.md).

## Monorepo

pnpm-Workspace (siehe `pnpm-workspace.yaml`):

- `server/` (npm-Name **`priority-pilot`**): Node.js + Express 5 + Sequelize 6 (SQLite). Gesamte Fachlogik.
- `client/`: aus `openapi.yml` via `openapi-typescript` generierte API-Typen (`src/schema.d.ts`, nicht versioniert) plus dünner Re-Export (`src/index.ts`).
- `frontend/`: React 19 + KoliBri (Vite/PWA); spricht die API typsicher per `openapi-fetch` an.

Gemeinsamer API-Vertrag: `openapi.yml`

- Server-Typen via `openapi-typescript` (`build:api` → `server/src/api.d.ts`)
- Client-Typen via `openapi-typescript` (`generate` → `client/src/schema.d.ts`) — kein Java mehr

## Befehle

- `pnpm build` — Client generieren + Server bauen
- `pnpm lint` — Lint über alle Packages
- `pnpm format` — Prettier über das ganze Repo (eine zentrale Config im Root)
- `pnpm --filter priority-pilot dev` — Server im Watch-Modus (nodemon)

Bevorzugt **gezielt** statt repo-weit prüfen: `pnpm --filter priority-pilot build` bzw. `... lint`.

## Datenbank

- SQLite (`server/database.sqlite`). Im Normalbetrieb **kein** Reset.
- `DB_RESET=true` setzt die DB beim Start zurück; sonst bleiben Daten erhalten, Demo-Daten werden nur in eine leere DB gesät.
