# Konventionen

- **Formatierung:** Tabs, Single Quotes, printWidth 120 — genau **eine** Prettier-Config im Root
  (`prettier.config.mjs`). Keine package-lokalen Prettier-Configs neu anlegen.
- **ESLint:** Flat-Config in `server/eslint.config.mjs` (ESLint 10).
- **TypeScript:** `strict`; keine Type-Assertions zum Unterdrücken von Fehlern.
- **Module:** ESM überall (`"type": "module"`); Server-Importe mit `.js`-Endung.
- **Runtime:** Node `>=26`, pnpm `11`.
- **Commits:** nicht automatisch committen ohne ausdrücklichen Wunsch.
- **Pull Requests:** vorher `pnpm format`, `pnpm lint` und `pnpm test` ausführen und die Ergebnisse
  in der PR-Beschreibung dokumentieren (Tests sind seit TDD-Stufe 2 Pflicht).
- **Coverage-Gate:** Die Logik-Schicht ist gezielt abgedeckt-gegated — `pnpm --filter priority-pilot test:coverage`
  (node:test, `server/src/logics`, Schwellen 90/85/85) läuft in der CI. `frontend/src/lib`-Coverage ist
  in `vitest.config.ts` vorbereitet und mit `pnpm add -D @vitest/coverage-v8` + `test:coverage` aktivierbar.
