# `frontend`

Web-Oberfläche des [Priority-Pilot-Monorepos](../README.md): **Vite + React 19 + KoliBri**
(`@public-ui`), als installierbare **PWA** (`vite-plugin-pwa`). Spricht die Server-API über den
generierten [`client`](../client) an. Bietet ein Dashboard (Kennzahlen, wichtigste Tasks,
Deadlines, Säulen-Widget „Meine Themen"), eine Aufgabentabelle sowie Dialoge zum Pflegen von
Abhängigkeiten und Säulen-Gewichtung.

## Frontend starten (Dev-Server)

```bash
pnpm --filter frontend dev
```

Startet den **Vite-Dev-Server** (Standard: `http://localhost:5173`) mit HMR. Die API-Pfade
`/tasks`, `/pillars`, `/forest`, `/next` werden per Proxy an den Express-Server unter
`http://localhost:3000` weitergeleitet ([`vite.config.ts`](vite.config.ts)) — das löst CORS im Browser.

> **Der Server muss parallel laufen.** In einem zweiten Terminal:
> `pnpm --filter server dev` (siehe [`server/README.md`](../server/README.md)).

## Production-Build & Vorschau

```bash
pnpm --filter frontend build     # tsc --noEmit + vite build → dist/
pnpm --filter frontend preview   # gebautes Bundle lokal serven (http://localhost:4173)
```

Im Build greift der Vite-Proxy nicht. Die API-Basis-URL kommt dann aus `VITE_API_BASE_URL`
([`src/api.ts`](src/api.ts)); ohne Wert wird same-origin (`''`) verwendet.

```bash
VITE_API_BASE_URL=https://api.example.com pnpm --filter frontend build
```

## Scripts

| Script    | Befehl                       | Zweck                          |
| --------- | ---------------------------- | ------------------------------ |
| `dev`     | `vite`                       | Dev-Server mit HMR + API-Proxy |
| `build`   | `tsc --noEmit && vite build` | Typprüfung + Production-Build  |
| `preview` | `vite preview`               | Gebautes Bundle lokal serven   |
| `lint`    | `tsc --noEmit && eslint src` | Typen + Lint                   |

## E2E (Playwright)

Unter [`e2e/`](e2e/) liegen die **funktionalen** E2E-Specs gegen das **echte** Backend (ohne Mock) —
`smoke.spec.ts` und `crud.spec.ts` (#92). Playwright startet dafür **zwei** Server: das Express-Backend
mit frischer temporärer In-Memory-DB (`:memory:`, `DB_RESET=true`, `DB_SEED=false`) und den
Vite-Dev-Server; dessen Proxy reicht die API-Requests durch. `crud.spec.ts` legt über die UI selbst
Daten **an, ändert und löscht** sie und ändert das Säulen-Gewicht — und prüft, dass die Mutation in
der Liste bzw. nach einem Reload aus der DB ankommt. Da sich alle Specs die eine In-Memory-DB teilen
(ein Worker, kein Neustart zwischen Tests), räumt `crud.spec.ts` in `afterEach` die angelegten Tasks
über die echte API wieder ab.

> **Lokale `server/.env`:** Das Test-Backend lädt wie jeder Server-Start eine vorhandene
> `server/.env`. Damit ein dort konfigurierter Auth-Kontext (`GOOGLE_*` → API-Schutz #207, jede
> Route antwortet 401) oder ein echter `MISTRAL_API_KEY` (reale LLM-Calls) die Tests nicht kippt,
> blankt `playwright.config.ts` diese Variablen in der `webServer`-Env explizit — die Specs mocken
> nur `GET /auth/me` im Browser, nie eine echte Session. Details im Kommentar der Config.

```bash
pnpm --filter frontend test:e2e          # Funktionale E2E gegen das echte Backend ausführen
```

> Beim ersten Lauf müssen die Playwright-Browser vorhanden sein:
> `pnpm --filter frontend exec playwright install chromium` (nutzt den lokalen Cache).

## Mehr

Gesamt-Setup und API-Vertrag: [Root-README](../README.md).
App-Icons (Quelle, maskable-Varianten, Regeneration): [public/icons/README.md](public/icons/README.md).
