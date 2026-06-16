# `frontend`

Web-Oberfläche des [Priority-Pilot-Monorepos](../README.md): **Vite + React 19 + KoliBri**
(`@public-ui`), als installierbare **PWA** (`vite-plugin-pwa`). Spricht die Server-API über den
generierten [`client`](../client) an.

## Frontend starten (Dev-Server)

```bash
pnpm --filter frontend dev
```

Startet den **Vite-Dev-Server** (Standard: `http://localhost:5173`) mit HMR. Die API-Pfade
`/tasks`, `/forest`, `/next` werden per Proxy an den Express-Server unter `http://localhost:3000`
weitergeleitet ([`vite.config.ts`](vite.config.ts)) — das löst CORS im Browser.

> **Der Server muss parallel laufen.** In einem zweiten Terminal:
> `pnpm --filter priority-pilot dev` (siehe [`server/README.md`](../server/README.md)).

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

## Mehr

Gesamt-Setup und API-Vertrag: [Root-README](../README.md).
