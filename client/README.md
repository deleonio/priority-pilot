# `client`

Generierter **TypeScript-Fetch-API-Client** für das [Priority-Pilot-Monorepo](../README.md).
Erzeugt aus dem API-Vertrag [`../openapi.yml`](../openapi.yml) mit `openapi-generator-cli`
(`typescript-fetch`). **Kein handgeschriebener Code** — `src/generated/` nicht von Hand bearbeiten.

> Dieses Paket „startet" nicht: Es ist eine reine Quellcode-Bibliothek (`exports` →
> `src/generated/index.ts`), die das [`frontend`](../frontend) per `workspace:*` einbindet. Vite
> transpiliert die TS-Quelle direkt (kein Pre-Bundling).

## Client (neu) generieren

Nach Änderungen an [`../openapi.yml`](../openapi.yml):

```bash
pnpm --filter client generate
```

…bzw. als Teil des Monorepo-Builds über `pnpm build` im Root (`pnpm -r generate && pnpm -r build`).

> **Voraussetzung:** eine **Java-JRE** — `openapi-generator-cli` läuft auf der JVM.
> Generator-Konfiguration: [`openapitools.json`](openapitools.json).

## Mehr

Gesamt-Setup und Architektur: [Root-README](../README.md).
