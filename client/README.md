# `client`

Aus dem API-Vertrag [`../openapi.yml`](../openapi.yml) generierte **API-Typen** für das
[Priority-Pilot-Monorepo](../README.md). Erzeugt mit
[`openapi-typescript`](https://www.npmjs.com/package/openapi-typescript) (reines JavaScript, **kein
Java**) nach `src/schema.d.ts`. **Kein handgeschriebener Code** in `schema.d.ts`.

> Dieses Paket „startet" nicht: Es ist eine reine Quellcode-Bibliothek (`exports` →
> `src/index.ts`), die das [`frontend`](../frontend) per `workspace:*` einbindet. `src/index.ts`
> re-exportiert die `paths` (für `openapi-fetch`) sowie bequeme Schema-Aliase (`Task`,
> `TaskCreate`, …). Vite transpiliert die TS-Quelle direkt (kein Pre-Bundling).

## Typen (neu) generieren

Nach Änderungen an [`../openapi.yml`](../openapi.yml):

```bash
pnpm --filter client generate
```

`src/schema.d.ts` ist nicht versioniert und wird zusätzlich bei `pnpm install` (`prepare`) sowie im
Monorepo-Build (`pnpm build` → `pnpm -r generate`) erzeugt.

## Mehr

Gesamt-Setup und Architektur: [Root-README](../README.md).
