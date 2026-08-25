# Issue #1017 — Implement „Buttons ‚Push testen' + ‚Standort jetzt ermitteln' vereinheitlichen"

## Erledigt
- Implementiert auf Branch `feat/issue-1017-button-vereinheitlichen` (nach Spec-Commit 974f62d0):
  - `SettingsPage.tsx`: beide KolButtons tragen jetzt `class="settings-action-btn"` (Push :206, Geo :271); `_label`/`key`/`_disabled`/Handler unangetastet.
  - `app.css`: `.push-test-btn` ersetzt durch `.settings-action-btn` — mobil `align-self: stretch` (Default-Zweig), `@media (min-width:768px)` `align-self: flex-start` (#932-Kommentar auf Desktop-Zweig umgeschrieben, _inline-Verbot dokumentiert).
- Visuelle Verifikation (Playwright-Skript /tmp/shot-1017.mjs, Szene wie e2e-Spec: Fake-SW + granted-Geo, localhost:4174):
  - 375px: beide Buttons x=40, w=295 (=100 % Container-Innenbreite), y=606/797 (getrennte Zeilen), h=44, docScrollW=375 (kein Overflow) → AK2/AK4/AK5 ✓.
  - 1280px: w=121/204 (inhaltsbreit), x=280 == innerLeft (linksbündig ±0px), h=44 → AK3/AK4 ✓.
  - Screenshots /tmp/1017-375.png, /tmp/1017-1280.png — Vision-Check desktop: bestätigt.
- `pnpm lint` grün, `pnpm knip` nur pre-existing Config-Hints, `pnpm format` keine Änderungen.
- AK1 (Vitest-Klassen-Spiegel): grün per Konstruk — beide Buttons identische nicht-leere Klasse; Rot-Zustand war von Spec-Phase verifiziert (1 failed | 5 passed), Test selbst unangetastet (Gewaltenteilung).

## Relevante Stellen
- `frontend/src/components/SettingsPage.tsx:206` + `:271` — gemeinsame Klasse an beiden Aktions-Buttons.
- `frontend/src/app.css:1422-1438` (nach Edit) — `.settings-action-btn` mobile-first, 768px-Breakpoint wie `.settings-switch-row`-Muster.
- `frontend/e2e/settings-action-buttons.spec.ts` — AK2-AK5-Vertrag, läuft in CI.
- `frontend/src/components/SettingsPage.test.tsx:136-163` — AK1-Spiegel-Test.

## Annahmen
- `align-self: stretch` mobil explizit gesetzt (statt implizitem Flex-Default) für Lesbarkeit; verhält sich identisch.
- Kein Full-Bleed mobil (UX-Beratung: Container-Innenbreite reicht, optional).

## Verworfen
- Playwright-MCP-Tools — in dieser Session nicht verfügbar; visueller Check per Einmal-Skript mit denselben Init-Scripts stattgefunden (Skript nicht eingecheckt).
- Eigener 320px-Visuallauf — stretch-Logik viewport-unabhängig identisch zu 375px, AK5-Test deckt es in CI.

## Offen
- -

## Nächster Schritt
- Fertig. Commit `be696012` gepusht, PR-Body um Implementierungs-Abschnitt ergänzt, `gh pr ready 1018` gesetzt (OPEN, isDraft=false). VERDICT: needs-review.

## Fallstricke
- node kann ESM-Imports aus /tmp nicht gegen frontend/node_modules auflösen → Skript ins frontend/-Verzeichnis kopieren, laufen lassen, löschen.
- KEINE Labels gesetzt; PR #1018 muss am Ende Nicht-Draft sein.
