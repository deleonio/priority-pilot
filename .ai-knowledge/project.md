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
- `pnpm test:scripts` — Fixtures für `.github/scripts/*.ts` (node:test + tsx); auch Teil von
  `pnpm test` und als CI-Schritt „Test (.github/scripts)"
- `pnpm format` — Prettier über das ganze Repo (eine zentrale Config im Root)
- `pnpm dev` — Frontend (Vite) **und** Backend (nodemon) parallel in einer Konsole starten
- `pnpm --filter server dev` — nur Server im Watch-Modus (nodemon)
- `pnpm --filter frontend dev` — nur Frontend (Vite)

Bevorzugt **gezielt** statt repo-weit prüfen: `pnpm --filter server build` bzw. `... lint`.

## Konventionen

Die verbindlichen Kernregeln (Minimalprinzip, KoliBri-First, Commit-/PR-Pflichten) stehen in den
[Kernregeln der AGENTS.md](../AGENTS.md#kernregeln) — hier nur deren Ausprägungen und Details:

- **Formatierung:** Tabs, Single Quotes, printWidth 120 — genau **eine** Prettier-Config im Root
  (`prettier.config.mjs`). Keine package-lokalen Prettier-Configs neu anlegen.
- **ESLint:** Flat-Config in `server/eslint.config.mjs` (ESLint 10).
- **TypeScript:** `strict`; keine Type-Assertions zum Unterdrücken von Fehlern.
- **Module:** ESM überall (`"type": "module"`); Server-Importe mit `.js`-Endung.
- **Runtime:** pnpm `11` (Node-Version steht in `.nvmrc`).
- **Coverage-Gate:** Die Logik-Schicht ist gezielt abgedeckt-gegated — `pnpm --filter server test:coverage`
  (node:test, `server/src/logics`, Schwellen 90/85/85) läuft in der CI. `frontend/src/lib`-Coverage ist
  in `vitest.config.ts` vorbereitet und mit `pnpm add -D @vitest/coverage-v8` + `test:coverage` aktivierbar.

### Mobile-First (Frontend)

Neue/geänderte UI muss zuerst auf schmalen Viewports funktionieren (Referenzbreite **375px**), bevor
Desktop-Verbesserungen ergänzt werden — nicht umgekehrt.

- **CSS:** Basis-Styles gelten für den schmalsten Viewport; breitere Layouts kommen ausschließlich per
  `@media (min-width: …)` hinzu (Aufwärts-Kaskade), kein `max-width`-Downgrade vom Desktop-Layout aus.
  Kanonisches Beispiel im Repo: das `.dashboard`-Grid in `frontend/src/app.css`
  (`@media (min-width: 48rem)` schaltet erst ab Tablet-Breite auf zweispaltig).
- **Kein horizontales Scrollen** für primären Seiteninhalt auf Handy-Breite. Breite Tabellen/Grids
  brauchen eine schmale Alternative statt erzwungenem Scroll-Container — Beispiel: `TaskTree.tsx`
  (aufklappbare Liste) als Ersatz für die frühere `TaskTable` (KoliBri-Tabelle mit 9 Spalten, #238).
- **Touch-Targets ≥ 44px:** KoliBri-Buttons erfüllen das per Default (`spec/button` `_inline: false`) —
  nicht durch eigenes CSS verkleinern.
- **Verifikation ist Pflicht, kein optionales Extra:** jede neue/geänderte, für den Nutzer sichtbare
  UI-Funktion braucht mindestens einen e2e-Test bei **375×812**-Viewport
  (`page.setViewportSize({ width: 375, height: 812 })`), der belegt, dass der Kerninhalt ohne
  horizontalen Overflow lesbar/bedienbar ist (`element.scrollWidth <= window.innerWidth`). Kanonisches
  Muster im Repo: `frontend/e2e/login.spec.ts` (AK5) und `frontend/e2e/task-tree.spec.ts` (AK-6).

### KoliBri-Tests

- **Black-box testen:** Tests greifen nur über die öffentliche Schnittstelle auf KoliBri-Web-Components
  zu (Host-Locator, Rolle/Name/Interaktion) — kein Shadow-DOM-Piercing (`.shadowRoot`, interne Klassen
  wie `.kol-span__label`, `.kol-tooltip__floating`, `kolicon-*`); der ESLint-Guard in
  `frontend/eslint.config.mjs` erzwingt dies. Details:
  [docs/testing.md §3](../docs/testing.md#3-kolibri-komponenten-testen).
- **A11y wird vertraut, nicht getestet (#929):** Barrierefreiheit ist Kernkompetenz der
  KoliBri-Components (BITV/WCAG-geprüfte Semantik, Fokus-Optik, Tastaturbedienung). Eigene Tests klagen
  nur den Kompositions-Vertrag der App ein: Element existiert und ist erreichbar (Tab/Pfeiltasten),
  Accessible Name, Position im Layout, Touch-Target-Größe. Nachgerüstete ARIA-Attribute an KoliBri-Items
  verwirft die Bibliothek still (beobachtet #929: `_aria: { role: 'combobox' }` an einem Toolbar-Item) —
  Semantik kommt aus der Komponente, nicht aus dem Item.

## Konfiguration (Umgebungsvariablen)

Der Server lädt beim Start automatisch eine `server/.env` in `process.env` (`server/src/env.ts`,
native `process.loadEnvFile`, Node ≥ 22 — keine zusätzliche Abhängigkeit). Vorlage:
`server/.env.example` nach `server/.env` kopieren und ausfüllen (`.env` ist gitignored). Echte
Umgebungsvariablen (z. B. Deployment-Secrets) haben Vorrang; ohne `.env` (CI/Deployment) wird der
Schritt still übersprungen.

- `MISTRAL_API_KEY`/`OPENROUTER_API_KEY` (fixe Built-in-Provider; ohne aktiven Provider und
  Key antworten die LLM-Endpoints mit **HTTP 503**), optional `MISTRAL_MODEL`,
  `MISTRAL_API_URL`, `OPENROUTER_MODEL`, `OPENROUTER_API_URL` — Details:
  [docs/llm-providers.md](../docs/llm-providers.md).
- `DB_RESET`, `DATABASE_STORAGE`, `PORT` — siehe `server/.env.example`.

## Datenbank

- SQLite (`server/database.sqlite`). Im Normalbetrieb **kein** Reset.
- `DB_RESET=true` setzt die DB beim Start zurück; sonst bleiben Daten erhalten, Demo-Daten werden nur in eine leere DB gesät.
