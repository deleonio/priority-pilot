# Issue 1745 — Design-Polish: Rundung Anmeldeseite + Toolbar-Abstand bei Task-Aktionen

## Ziel

Zwei visuelle Ungleichmäßigkeiten beseitigen:

1. Anmeldeseite: Das E-Mail-Eingabefeld (`.login-page__input`) rundet mit
   `--pp-radius-md`, die Knöpfe (`.login-page__btn`) mit `--pp-radius-pill` —
   Mischbild. Künftig rundet das Eingabefeld wie die Knöpfe mit
   `var(--pp-radius-pill)`. Bewusste kontextuelle Ausnahme der Login-Oberfläche
   gegenüber dem md-Radius der übrigen App-Inputs (KI-UX: im app.css-Kommentar
   begründen); inline-Padding des Inputs reicht aus, damit Text nicht in der
   Rundung klebt.
2. Aktions-Toolbar eines Tasks (Popover „Weitere Aktionen"): floating-ui platziert
   das Panel links neben dem „…"-Trigger (`_popoverAlign="left"`,
   `popoverAlign.ts`). Der sichtbare Abstand zwischen letztem Icon-Knopf des
   Panels und dem „…"-Knopf ist deutlich größer als der 8-px-Icon-Abstand
   (`setToolbarActionGap`), weil Panel-Padding (8/12 px) und floating-ui-Offset
   zusammenkommen. Der „…"-Knopf ist zudem ein eigenständiger KolButton mit
   voller Border und eigenem Radius, während die Icon-Gruppe als flacher Streifen
   ohne Innen-Borders gerendert wird. Künftig: Abstand vor dem „…"-Knopf == 8 px,
   und der „…"-Knopf gleicht Radius und Randstärke der Aktions-Knöpfe an (über
   die etablierte JS-Stil-Injektion aus `popoverAlign.ts` — keine neuen
   Shadow-DOM-CSS-Selektoren).

## Ausgangslage

- `frontend/src/app.css:4945` — `.login-page__input { border-radius: var(--pp-radius-md) }`
  (Light-DOM, nativer Input → reiner Token-Tausch).
- `frontend/src/app.css:4866` — `.login-page__btn { border-radius: var(--pp-radius-pill) }`.
- `frontend/src/lib/popoverAlign.ts:118-148` — `setToolbarActionGap` schreibt
  `gap: 8px` auf `.kol-toolbar` im Shadow-DOM (Muster für die neue Injektion).
- `frontend/src/components/TaskTree.tsx:223-232` — `KolPopoverButton.task-tree-more`
  (Trigger „…") + `KolToolbar` mit 6 Icon-Items.
- Bestandswächter, die nicht rot werden dürfen:
  `frontend/e2e/issue-1623-task-actions-gap.spec.ts` (Icon-Abstände ≥ 8 px,
  44×44px, Viewport-Grenzen bei 375 px) und
  `frontend/e2e/issue-1186-popover-focus-outline.spec.ts` (Fokus-Outline).

## Akzeptanzkriterien → Vertrag

### AK1: Pillen-Rundung des E-Mail-Eingabefelds (TF1)

Auf der Anmeldeseite (Magic-Link-Formular sichtbar, `GET /auth/providers` →
`magicLink: true`) gilt: computed `border-radius` von `.login-page__input` ==
computed `border-radius` von `.login-page__btn` (Toleranz ±1 px) — kein Mischbild.
E2E: `frontend/e2e/auth.spec.ts`.

### AK2: Abstand Icon-Gruppe → „…"-Knopf == Icon-Abstand (TF2)

Im geöffneten Popover bei Desktop-Viewport (1280 px) gilt horizontal:
`triggerBox.x - (letzteIconBox.x + letzteIconBox.width)` == 8 px (±1 px) und ==
gemessener Icon-zu-Icon-Abstand (±1 px). E2E:
`frontend/e2e/issue-1745-toolbar-polish.spec.ts`.

### AK3: „…"-Knopf gleicht Rundung und Rahmen an (TF3)

Computed `border-radius` und `border-width` des „…"-Trigger-Knopfs == Werte eines
Toolbar-Aktions-Knopfs (z. B. „Bearbeiten"), je ±1 px. E2E: dieselbe Spec.

### AK4: Mobile-First — AK2/AK3 auch bei 375 px ohne Overflow (TF4)

Die Messungen aus AK2 und AK3 bei 375 px Viewport wiederholt, zusätzlich liegen
alle sechs Aktions-Buttons UND der „…"-Knopf vollständig im Viewport
(`x >= 0`, `x + width <= 375`). Messung per Bounding-Box, nicht scrollWidth
(App-Shell clippt `overflow-x`, MEMORY 2026-08-24).

## Abgrenzungen

- Keine neuen KoliBri-Komponenten, keine neuen Shadow-DOM-CSS-Selektoren
  (unpublizierte API) — nur Ausbau der JS-Stil-Injektion.
- Hover-/Press-/Fokuszustände und 44-px-Touch-Targets bleiben erhalten
  (gesichert durch #1623- und #1186-Bestandstests).
