# Spec: Focus-Outline für KoliBri `kol-tabs` Shadow-DOM (Issue 1336)

## Ziel

Ein per Tastatur fokussierter Tab-Button der Hauptnavigation (`.app-tabs`,
Dashboard/Aufgaben/Serien/Wald) trägt einen vollständig sichtbaren 2px-Ring in
`var(--pp-focus-ring)` mit 2px Abstand — ungeclippt, auf allen Viewports, nur bei
Tastaturfokus (nicht nach Mausklick).

## Vorbedingungen

- App ist geladen, Hauptnavigation (`kol-tabs.app-tabs`) sichtbar.
- Die `@public-ui`-Pakete bleiben auf 4.4.0 gepinnt (`frontend/package.json`) — kein
  Patch/Vendor-Verzeichnis. `kol-tabs` bietet laut KoliBri-Doku (4.4.0) keine
  Focus-Custom-Properties/CSS-Parts; der Fix erfolgt repo-lokal, analog zum
  etablierten Muster `setupPopoverAlignment()` (`frontend/src/lib/popoverAlign.ts`,
  #1186): Zugriff auf den offenen Shadow-Root des `kol-tabs`-Hosts.

## Schritte / Verhalten

1. Per Tastatur (`Tab`) zu einem Tab-Button der Hauptnavigation navigieren bzw.
   `.focus()` setzen.
2. Denselben Check für alle vier Tabs (Dashboard, Aufgaben, Serien, Wald)
   wiederholen.
3. Dasselbe bei 375px (mobile-first), 768px (tablet) und 1280px (desktop)
   wiederholen.
4. Denselben Check auf den Settings-Tabs (`.settings-tabs`, `kol-tabs`-Instanz auf
   `/settings`) wiederholen.
5. Nach einem Mausklick auf einen Tab-Button prüfen, dass keine Outline sichtbar
   ist.

## Erwartetes Ergebnis

- **AK1 — Outline-Werte:** Der fokussierte Tab-Button hat computed
  `outline-style != 'none'`, `outline-width >= 2px`, `outline-color` entspricht dem
  aufgelösten Wert von `--pp-focus-ring`, `outline-offset` ist `2px`.
- **AK2 — kein Clipping:** Kein Vorfahr des fokussierten Tab-Buttons bis
  einschließlich des `kol-tabs`-Hosts hat clippendes `overflow`
  (`auto`/`hidden`/`scroll`/`clip`); die Bounding-Box des Tab-Buttons liegt
  inklusive 2px Offset + 2px Ring vollständig innerhalb der Bounding-Box der
  Tab-Leiste bzw. des Viewports.
- **AK3 — alle vier Tabs:** AK1+AK2 gelten für Dashboard, Aufgaben, Serien, Wald.
- **AK4 — alle Viewports:** AK1+AK2 gelten bei 375px, 768px, 1280px.
- **AK5 — nur `:focus-visible`:** Nach einem Mausklick auf einen Tab-Button ist
  keine Outline sichtbar (`outline-style: none` oder `outline-width: 0`).
- **AK6 — Regression:** Die bestehenden Tab-Wächter bleiben grün:
  `frontend/e2e/tabs-viewport.spec.ts`, `frontend/e2e/settings-tabs.spec.ts`,
  `frontend/e2e/mobile-shell.spec.ts`.
- **AK7 — Settings-Tabs:** Wirkt die Lösung für alle `kol-tabs`-Instanzen, zeigen
  auch die Settings-Tabs den Ring nach denselben Regeln ohne Layout-Regress.
- **AK8 — kein Paket-Patch:** `frontend/package.json` (`@public-ui`-Versionen)
  bleibt unverändert; kein Patch-/Vendor-Verzeichnis.

## Testführung

E2E (`frontend/e2e/issue-1336-tabs-focus-outline.spec.ts`), Stil `crud.spec.ts`.
Playwright pierct offene Shadow Roots — Zugriff über
`page.getByRole('tab', { name })` + `locator.evaluate`/`getComputedStyle`, kein
eigenes `shadowRoot`-Literal im Testcode (`frontend/eslint.config.mjs:41-56`,
#824-Guard). Fokus per `locator.focus()` + `toBeFocused` (Vorbild issue-761 AK6).
Clipping-Check als Vorfahrenkette analog `issue-1186-popover-focus-outline.spec.ts`
(`clippingAncestorInPopover`), hier bis zum `kol-tabs`-Host statt zum
`kol-popover-button`-Host. AK8 wird per `git diff frontend/package.json` im
PR-Body belegt, kein eigener Test.

Kein Unit-Test: der Effekt entsteht ausschließlich im Shadow-DOM einer
Custom-Element-Komponente und ist in jsdom nicht messbar (Präzedenz #1186,
„Kein Unit-Test").

## Abgrenzungen / Non-Goals

- Keine Änderung an den `@public-ui`-Paketen, kein eigenes Tabs-Rendering.
- Kompaktes Tab-Gap (#1274, 12px) und die `--grid-template-columns`-Klammer
  (#1020) bleiben unverändert — AK6 sichert das ab.
