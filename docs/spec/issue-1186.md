# Spec: Fokus-Outline im „…"-Menü der Aufgabenliste sichtbar (Issue 1186)

## Ziel

Bei Tastaturfokus auf den Toolbar-Buttons des geöffneten „…"-Menüs einer Aufgabe
(`KolPopoverButton _label="Weitere Aktionen"` + `KolToolbar`, `TaskTree.tsx`) ist die
Fokus-Outline an allen vier Seiten vollständig sichtbar. Das Panel
`.kol-popover-button__popover` clippt die Outline derzeit, weil der UA-/KoliBri-Style
dort `overflow: auto` setzt (vom Issue-Autor per Playwright verifiziert).

## Vorbedingungen

- Mindestens eine Blatt-Aufgabe existiert in der Aufgabenliste (Tab „Aufgaben").
- Das „…"-Menü der Aufgabe ist geöffnet (Klick auf den Trigger-Button).
- Die `@public-ui`-Pakete bleiben auf 4.3.0 gepinnt — der Fix darf kein Patch/Vendor
  der KoliBri-Pakete sein, sondern erfolgt im bestehenden Helper
  `setupPopoverAlignment()` (`frontend/src/lib/popoverAlign.ts`), der bereits per
  `host.shadowRoot.querySelector('.kol-popover-button__popover')` auf genau dieses
  Panel zugreift und dort Inline-Styles setzt.

## Schritte / Verhalten

1. Panel öffnen: Klick auf den „Weitere Aktionen"-Button einer Aufgabe.
2. Tastaturfokus auf einen Toolbar-Button im geöffneten Panel setzen.
3. Dasselbe bei 375px-Viewport (Mobile-first) wiederholen.

## Erwartetes Ergebnis

- **AK1 — Panel-Overflow:** Das Panel `.kol-popover-button__popover` hat nach dem
  Öffnen computed `overflow: visible` (statt `auto`), gesetzt über den bestehenden
  Helper `setupPopoverAlignment`. Die `@public-ui`-Versionspins (4.3.0) bleiben
  unangetastet; die bestehende Alignment-Logik (Links-Ausrichtung,
  Viewport-Overflow-Korrektur, MutationObserver-Cleanup) bricht nicht.
- **AK2 — Outline sichtbar:** Der fokussierte Toolbar-Button trägt eine sichtbare
  Outline (computed `outline-style` != `none` UND `outline-width` > 0), und kein
  Vorfahr im Popover-Shadow-DOM clippt sie (alle Vorfahren bis zum Panel haben
  kein_clippendes `overflow` — `auto`/`hidden`/`scroll`/`clip` — insbesondere das
  Panel selbst gemäß AK1). Die Outline ist damit an allen vier Kanten vollständig
  sichtbar.
- **AK3 — Mobile-first (375px):** AK1 und AK2 gelten unverändert auch bei einem
  375px-Viewport; das schmalere Panel clippt die Outline ebenfalls nicht.

## Testführung

E2E (`frontend/e2e/issue-1186-popover-focus-outline.spec.ts`), echtes Backend wie
alle Specs. Stil-Assertions per `getComputedStyle` auf dem per Locator erreichten
Shadow-DOM-Element (Playwright pierct offene Shadow Roots; Vorbild
`issue-930-transparent-backgrounds.spec.ts`), Fokus per `locator.focus()` +
`toBeFocused` (Vorbild `issue-761-layout-optimization.spec.ts`, AK6). Kein Unit-Test:
`frontend/src/migration-check.test.ts` verbietet `shadowRoot`-Zugriffe in Testdateien
unter `frontend/src/**` — die Prüfung liegt bewusst auf E2E-Ebene.

## Abgrenzungen / Non-Goals

- Keine Änderung an den `@public-ui`-Paketen, kein eigenes Popover-Rendering.
- Alignment-Logik des Helpers (Links-Ausrichtung, `width: max-content`,
  Rechts-Überlauf-Korrektur) bleibt wie sie ist.
- Der Shadow-DOM-Zugriff bleibt die bereits dokumentierte unpublizierte
  KoliBri-API-Überbrückung (popoverAlign.ts-Kommentar); der Warnhinweis
  „bei KoliBri-Upgrades prüfen" erweitert die Impl-Phase um die neue
  Overflow-Regel.
