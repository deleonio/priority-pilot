# Projekt: Priority Pilot

Werkzeug zur **Aufgaben-Priorisierung** über einen gewichteten Abhängigkeitsgraphen, kombiniert
mit **Lebensbalance-Säulen**. Ein Task zahlt auf 0..n Säulen ein (n:m über `task_pillars`, je mit
`share`/`confidence`). Die Säulen sind **nutzerdefiniert** (pro Nutzer mit `userId`, anleg-,
umbenenn- und löschbar; neue Konten starten mit einem Default-Bestand von fünf Säulen) — mit
Kurzbeschreibung `description` und prozentualem `weight`. Pro Task werden Wertbeitrag (eigene
Priorität + gewichtete Werte der abhängigen Tasks, multiplikativ skaliert mit dem aus den anteiligen
Säulen-Beiträgen gemittelten Säulen-Faktor) und Gesamtaufwand inkl. transitiver Abhängigkeiten
berechnet. Full-Stack: Express-REST-API + React/KoliBri-PWA.
Fachliche Details: [../README.md](../README.md).

## Monorepo

pnpm-Workspace (siehe `pnpm-workspace.yaml`):

- `server/` (npm-Name **`server`**): Node.js + Express 5 + Sequelize 6 (SQLite). Gesamte Fachlogik.
- `client/`: aus `openapi.yml` via `openapi-typescript` generierte API-Typen (`src/schema.d.ts`, nicht versioniert) plus dünner Re-Export (`src/index.ts`).
- `frontend/`: React 19 + KoliBri (Vite/PWA); spricht die API typsicher per `openapi-fetch` an.

Gemeinsamer API-Vertrag: `openapi.yml`

- Server-Typen via `openapi-typescript` (`build:api` → `server/src/api.d.ts`)
- Client-Typen via `openapi-typescript` (`generate` → `client/src/schema.d.ts`) — kein Java mehr

## Befehle

- `pnpm build` — Client generieren + Server bauen
- `pnpm lint` — Lint über alle Packages
- `pnpm lint:actions` — Workflows/Composite-Actions gegen die GitHub-Schemas prüfen
  (`.github/scripts/validate-actions.ts`, CI-Schritt „GitHub-Actions-Schema" + pre-commit-Hook)
- `pnpm format` — Prettier über das ganze Repo (eine zentrale Config im Root)
- `pnpm dev` — Frontend (Vite) **und** Backend (nodemon) parallel in einer Konsole starten
- `pnpm --filter server dev` — nur Server im Watch-Modus (nodemon)
- `pnpm --filter frontend dev` — nur Frontend (Vite)

Bevorzugt **gezielt** statt repo-weit prüfen: `pnpm --filter server build` bzw. `... lint`.

## Konfiguration (Umgebungsvariablen)

Der Server lädt beim Start automatisch eine `server/.env` in `process.env` (`server/src/env.ts`,
native `process.loadEnvFile`, Node ≥ 22 — keine zusätzliche Abhängigkeit). Vorlage:
`server/.env.example` nach `server/.env` kopieren und ausfüllen (`.env` ist gitignored). Echte
Umgebungsvariablen (z. B. Deployment-Secrets) haben Vorrang; ohne `.env` (CI/Deployment) wird der
Schritt still übersprungen.

- `MISTRAL_API_KEY` (Pflicht für die Säulen-Klassifikation `POST /tasks/suggest-pillars`; fehlt er,
  antwortet der Endpoint mit **HTTP 503**), optional `MISTRAL_MODEL` (Default `mistral-small-latest`)).
- `DB_RESET`, `DATABASE_STORAGE`, `PORT` — siehe `server/.env.example`.

## Datenbank

- SQLite (`server/database.sqlite`). Im Normalbetrieb **kein** Reset.
- `DB_RESET=true` setzt die DB beim Start zurück; sonst bleiben Daten erhalten, Demo-Daten werden nur in eine leere DB gesät.
