# Konventionen

- **Formatierung:** Tabs, Single Quotes, printWidth 120 — genau **eine** Prettier-Config im Root
  (`prettier.config.mjs`). Keine package-lokalen Prettier-Configs neu anlegen.
- **ESLint:** Flat-Config in `server/eslint.config.mjs` (ESLint 10).
- **TypeScript:** `strict`; keine Type-Assertions zum Unterdrücken von Fehlern.
- **Module:** ESM überall (`"type": "module"`); Server-Importe mit `.js`-Endung.
- **Runtime:** Node `>=26`, pnpm `11`.
- **Commits:** nicht automatisch committen ohne ausdrücklichen Wunsch.
- **Pull Requests:** vorher `pnpm format` und `pnpm lint` ausführen und die Ergebnisse in der
  PR-Beschreibung dokumentieren.
