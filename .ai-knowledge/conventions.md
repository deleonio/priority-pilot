# Konventionen

- **Minimalprinzip:** Programmiere, dokumentiere und teste nur so viel wie wirklich notwendig und so
  wenig wie irgend möglich — jede Zeile ist Wartungslast. Aufnahmekriterium für Tests (auswerten /
  spiegeln / vor stillem Ausfall schützen) und die zwei Gegenproben:
  [tdd-strategy.md → Testumfang](tdd-strategy.md#testumfang--so-viel-wie-nötig-so-wenig-wie-irgend-möglich).
- **Formatierung:** Tabs, Single Quotes, printWidth 120 — genau **eine** Prettier-Config im Root
  (`prettier.config.mjs`). Keine package-lokalen Prettier-Configs neu anlegen.
- **ESLint:** Flat-Config in `server/eslint.config.mjs` (ESLint 10).
- **TypeScript:** `strict`; keine Type-Assertions zum Unterdrücken von Fehlern.
- **Module:** ESM überall (`"type": "module"`); Server-Importe mit `.js`-Endung.
- **Runtime:** Node `>=26`, pnpm `11`.
- **Commits:** nicht automatisch committen ohne ausdrücklichen Wunsch.
- **Pull Requests:** vorher `pnpm format`, `pnpm lint` und `pnpm test` ausführen und die Ergebnisse
  in der PR-Beschreibung dokumentieren (Tests sind seit TDD-Stufe 2 Pflicht).
- **Coverage-Gate:** Die Logik-Schicht ist gezielt abgedeckt-gegated — `pnpm --filter server test:coverage`
  (node:test, `server/src/logics`, Schwellen 90/85/85) läuft in der CI. `frontend/src/lib`-Coverage ist
  in `vitest.config.ts` vorbereitet und mit `pnpm add -D @vitest/coverage-v8` + `test:coverage` aktivierbar.
- **Mobile-First (Frontend):** Neue/geänderte UI muss zuerst auf schmalen Viewports funktionieren
  (Referenzbreite **375px**), bevor Desktop-Verbesserungen ergänzt werden — nicht umgekehrt.
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
- **KoliBri-First (Frontend):** Komponenten nur selbst stylen, wenn keine KoliBri-Komponente anwendbar ist.
  KoliBri-Komponenten sind Shadow-Web-Components mit festem Styling; Shadow-DOM-CSS ist unpublizierte API
  (siehe `frontend/src/lib/popoverAlign.ts` für das Problem). Vor eigenen Styling-Entscheidungen via
  `mcp__kolibri-mcp__search/fetch` prüfen, ob eine passende KoliBri-Komponente existiert (Custom-Element +
  Properties). Begründung bei Eigene-Styling-Entscheidung im PR-Body.
- **KoliBri-Komponenten black-box testen:** Tests greifen nur über die öffentliche Schnittstelle auf KoliBri-Web-Components
  zu (Host-Locator, Rolle/Name/Interaktion) — kein Shadow-DOM-Piercing (`.shadowRoot`, interne Klassen wie
  `.kol-span__label`, `.kol-tooltip__floating`, `kolicon-*`). Der ESLint-Guard in `frontend/eslint.config.mjs`
  erzwingt dies. Details: [docs/testing.md §4](../docs/testing.md#4-kolibri-komponenten-testen).
