# Design System

<!-- impeccable:design-schema 1 -->

## Design Language

**KERN UX** — Das Design-System der Bundesregierung (Deutschland), open source, BITV 2.0 / WCAG 2.2 konform. Liefert:

- Semantische Design-Tokens (Farbe, Spacing, Typografie, Radius, Motion, Shadow)
- Barrierefreie Web Components (Shadow DOM) — KoliBri (`@public-ui/components`)
- React 19 Wrapper — `@public-ui/react-v19`
- CSS-Utility-Klassen für Layout (Flex, Grid, Gap, Stack, Alignment, Surface)
- Mobile-First Breakpoints (375px, 48rem, 80rem)

Quellen: KERN UX MCP (`kern-mcp_*`), KoliBri MCP (`kolibri-mcp_*`).

## Component Library

**KoliBri Web Components** — einziger erlaubter Komponenten-Layer für Bedienelemente, Überschriften, Tabellen, Dialoge, Meldungen, Fortschritt, Marker.

| Zweck                       | KoliBri Komponente                                           | React Wrapper                                          |
| --------------------------- | ------------------------------------------------------------ | ------------------------------------------------------ |
| Aktion                      | `kol-button`                                                 | `KolButton`                                            |
| Überschrift                 | `kol-heading`                                                | `KolHeading`                                           |
| Texteingabe / Zahl / Datum  | `kol-input-text`, `kol-input-range`, `kol-input-date`        | `KolInputText`, `KolInputRange`, `KolInputDate`        |
| Auswahl                     | `kol-single-select`, `kol-input-radio`, `kol-input-checkbox` | `KolSingleSelect`, `KolInputRadio`, `KolInputCheckbox` |
| Meldung                     | `kol-alert`                                                  | `KolAlert`                                             |
| Fläche / Gruppierung        | `kol-card`                                                   | `KolCard`                                              |
| Dialog                      | `kol-dialog`                                                 | `KolDialog` / `Modal.tsx`                              |
| Tabelle                     | `kol-table-stateful`                                         | `KolTableStateful`                                     |
| Ladezustand                 | `kol-spin`                                                   | `KolSpin`                                              |
| Fortschritt / Anteil        | `kol-meter`                                                  | `KolMeter`                                             |
| Marker (Serie, Ausnahme, …) | `kol-badge`                                                  | `KolBadge`                                             |
| Tabs                        | `kol-tabs`                                                   | `KolTabs`                                              |
| Toolbar / Aktionsgruppen    | `kol-toolbar`                                                | `KolToolbar`                                           |
| Popover                     | `kol-popover-button`                                         | `KolPopoverButton`                                     |
| Avatar                      | `kol-avatar`                                                 | `KolAvatar`                                            |
| Tooltip                     | `kol-tooltip`                                                | `KolTooltip`                                           |

**Regel:** Rohes HTML (`<button>`, `<input>`, `<table>`, `<h1>`–`<h6>`) ist **nur für Layout-Container** zulässig (`div`, `section`, `ul`/`li`, `p`, `span`). Jede Ausnahme braucht einen Code-Kommentar mit Begründung.

MCP-Nutzung: Vor neuer Komponenten-Nutzung `kolibri-mcp_search` / `kolibri-mcp_fetch` für Specs/Samples; `kern-mcp_get_component_docs` für Doku.

## Tokens (Priority Pilot — `--pp-*`)

Definiert in `frontend/src/app.css :root` / `[data-theme='dark']`.

### Farbe (Rollen, keine Hex-Werte im Komponenten-CSS)

| Rolle                   | Light                 | Dark                  | Verwendung                                                   |
| ----------------------- | --------------------- | --------------------- | ------------------------------------------------------------ |
| `--pp-ink`              | `#12161d`             | `#e6eaf0`             | Primärer Text                                                |
| `--pp-text-muted`       | `#4a5568`             | `#a0aec0`             | Sekundärer Text, Meta                                        |
| `--pp-bg`               | `#f8f9fb`             | `#14181d`             | Seiten-Hintergrund                                           |
| `--pp-surface-1`        | `#ffffff`             | `#1e242c`             | Karten, Panels                                               |
| `--pp-surface-2`        | `#eef1f6`             | `#1a1f26`             | Subtle Hintergründe                                          |
| `--pp-bg-muted`         | `var(--pp-surface-2)` | `var(--pp-surface-2)` | Deprecated alias                                             |
| `--pp-border`           | `#d1d9e6`             | `#2d3748`             | Rahmen                                                       |
| `--pp-signal`           | `#f2b155`             | `#f0b357`             | **Primärfarbe / Hauptaussage** (Dashboard "Nächste Aufgabe") |
| `--pp-signal-wash`      | `#fdf3e3`             | `#2a2318`             | Signal-Hintergrund (10 % Deckkraft)                          |
| `--pp-signal-ink`       | `#8a4b00`             | `#f0b357`             | Text auf Signal-Hintergrund (Kontrast ≥ 4.5:1)               |
| `--pp-accent-total`     | `#3b82f6`             | `#60a5fa`             | Dashboard-Karte "Gesamt"                                     |
| `--pp-accent-open`      | `#f59e0b`             | `#fbbf24`             | Dashboard-Karte "Offen"                                      |
| `--pp-accent-inprocess` | `#ef4444`             | `#f87171`             | Dashboard-Karte "In Bearbeitung"                             |
| `--pp-accent-done`      | `#22c55e`             | `#4ade80`             | Dashboard-Karte "Erledigt"                                   |
| `--pp-danger`           | `#b42318`             | `#ef4444`             | Destruktive Aktionen                                         |
| `--pp-success`          | `#22c55e`             | `#4ade80`             | Erfolgs-Zustände                                             |

### Spacing (Skala, mobile-first)

```
--pp-gap-tight:   0.5rem   /* 8px  — intra-element */
--pp-gap-base:    1rem     /* 16px — inter-group */
--pp-gap-generous: 1.5rem  /* 24px — section break */
--pp-gap-major:   2rem     /* 32px — major section */
--pp-space-1 .. --pp-space-8  /* 0.25rem .. 2rem, für feinere Abstufung */
```

### Typografie

- Basis: `1rem` (16px), System-UI Stack
- `--pp-font-size-sm: 0.875rem`
- `--pp-font-size-lg: 1.125rem`
- `--pp-weight-bold: 700`
- `font-variant-numeric: tabular-nums` für Zahlenkolonnen

### Radius

- `--pp-radius-sm: 0.25rem` (4px)
- `--pp-radius: 0.5rem` (8px) — Standard für Cards, Panels, Buttons
- `--pp-radius-lg: 1rem` (16px)

### Breakpoints

- Mobile: `< 48rem` (375px Referenz)
- Tablet: `≥ 48rem` (768px)
- Desktop: `≥ 80rem` (1280px) — max-content-width `80rem` zentriert (`.app`)

### Safe Area

`env(safe-area-inset-*)` in `.app`, `.help-page`, `.settings-page`, `.modal-body` berücksichtigt.

## Mobile-First Rules (verbindlich)

Aus `docs/mobile-ui-rules.md`:

- Touch-Targets: **mindestens 44×44px** (KoliBri `--a11y-min-size: 2.75rem`), 48dp Designziel
- Kein horizontales Scrollen bei 375px Viewport + 200 % Textvergrößerung (WCAG 1.4.10 Reflow)
- Einhandbedienung (Daumen-Zonen): Primär-Aktionen unten, destruktive Aktionen Bestätigungs-Dialog (Sequenzielle Bestätigung)
- Icon-only-Buttons immer mit `aria-label` / `sr-only`
- Async-Zustände sichtbar (Spinner, disabled-State, optimistische Updates)
- Anti-Patterns: keine `fixed` Bottom-Bars ohne Safe-Area, keine `hover`-only Interaktionen

## KERN UX Layout-Prinzipien (für `impeccable layout`)

- **Reading Order:** Visueller Fluss folgt DOM-Reihenfolge; `order` nur mit Begründung
- **Grouping:** Verwandte Inhalte in `section` / `KolCard` mit `aria-labelledby`
- **Rhythm:** Vertikaler Rhythmus über `--pp-gap-*` Tokens, keine Magic Numbers
- **Structure:** 12-Spalten-Grid (`kol-container`/`kol-row`/`kol-col-*`) für seitenweite Layouts; CSS-Grid-Utilities (`kern-grid`, `kern-grid-cols-*`) für Komponenten-interne Layouts
- **Density:** Atemraum (`--pp-gap-generous`) zwischen Sektionen; kompakt (`--pp-gap-tight`) innerhalb von Cards
- **Adaptation:** Breakpoint bei 48rem; Stacking (`flex-direction: column`) auf Mobile; `kol-col-sm-12` für volle Breite
- **Extremes:** 320px Minimum, 80rem Maximum; Text nicht breiter als 65ch

## KoliBri Shadow-DOM Styling

- **CSS Custom Properties** durchdringen Shadow-DOM-Grenzen → Tokens auf Host-Element setzen
- **Keine CSS Parts** — KoliBri exportiert keine `::part()` Selektoren (validiert 2026-08-21)
- Beispiel Tab-Stacking auf Mobile:
  ```css
  @media (max-width: 767px) {
  	.app-tabs {
  		--button-group-flex-direction: column;
  	}
  }
  ```
- Dark Mode: `data-theme="dark"` auf `:root` / `html`; KoliBri-Komponenten reagieren auf `data-theme` via interne Media-Queries; eigene Tokens über `[data-theme='dark']` definieren

## Composition Patterns (KERN MCP)

Für wiederverwendbare Layout-Blöcke `kern-mcp_render_composition` nutzen (Section, Card, Grid, Disclosure, FormFlow). Vermeidet CSS-Duplikation und garantiert BITV-konforme Struktur.

## Accessibility Checkpoints

- `role="region"` + `aria-labelledby` für Hauptbereiche (Dashboard "Nächste Aufgabe", "Was ist jetzt dran?")
- `KolBadge` Standard-Icons `aria-hidden="true"` — Text trägt die Information
- `KolDialog` / `Modal.tsx`: Fokus-Trap, `Escape` schließt, Fokus-Rückgabe auf Trigger
- `KolTableStateful` auf Mobile (`< 48rem`) durch Liste ersetzen (P2-5 / #537: `TaskTree`)
- Live-Regionen für Status-Updates (`KolAlert`, `KolMeter` mit `role="status"`)

## MCP Knowledge Sources

Diese Datei ist die **einzige** Design-System-Referenz für Impeccable in diesem Projekt. Für Detailfragen:

| Thema                   | MCP Tool                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------- |
| KERN Token Snapshot     | `kern-mcp_get_tokens`                                                              |
| KERN Komponenten-Doku   | `kern-mcp_get_component_docs` + `kern-mcp_list_components_by_category`             |
| KERN Utility Classes    | `kern-mcp_get_utility_reference`                                                   |
| KERN Icons              | `kern-mcp_list_icons`                                                              |
| KERN Layout Patterns    | `kern-mcp_get_pattern` (Header), `kern-mcp_render_composition` (Section/Grid/Card) |
| KoliBri Specs / Samples | `kolibri-mcp_search` + `kolibri-mcp_fetch`                                         |
| KoliBri Templates       | `kolibri-mcp_search_templates` + `kolibri-mcp_fetch_template`                      |

**Workflow:** Vor Design-Entscheidung relevante MCP aufrufen, Ergebnis in die Begründung einfließen lassen. Nicht raten — Specs lesen.

## Project-Specific Overrides

### Dashboard "Nächste Aufgabe" (P2-1)

- Signalfarbe `--pp-signal-wash` + `--pp-signal-ink`
- Border-left `0.375rem solid var(--pp-signal)`
- `role="region" aria-labelledby="dashboard-next-task-heading"`
- Primär-Button "Jetzt starten" (`KolButton _variant="primary"`)

### Tab-Leiste (P2-7)

- Mobile (`< 768px`): vertikal, vollbreit (`--button-group-flex-direction: column`)
- Desktop: horizontal, keine Wrap

### ForestPanel (P2-5)

- `KolCard _level={0}` pro Knoten
- `KolHeading _level={3|4}` für Titel
- `KolBadge` für Priorität (P2-2 Farb-Mapping: ≥4 danger, ≥2 warning, sonst info)
- Kinder-Einrückung via `margin-left` + linker Border `2px solid var(--pp-border)`

### Prioritäts-Badges (P2-2, TaskTable + TaskTree + ForestPanel)

```typescript
const PRIORITY_COLOR = {
  info: '#005b99',    // --kol-color-primary
  warning: '#c66a00', // --kol-color-warning
  danger: '#b42318',  // --kol-color-danger
};
priority >= 4 → danger, >= 2 → warning, sonst info
```

### Formulare

- Labels kurz, präzise, ohne Doppelpunkt
- Hint-Text unter Feld (`aria-describedby`)
- Error-State: konstruktive Meldung, nicht nur "Fehler"
- Optional-Marker statt Pflicht-Markierung (KERN-Prinzip)

## Visual Regression / QA

- `pnpm ui:inspect` → Playwright MCP bei `http://localhost:4174` (375px & 1280px)
- Viewports: 375×812 (Mobile), 1280×900 (Desktop)
- E2E-Tests: `dark-mode-contrast.spec.ts`, `tabs-viewport.spec.ts`, `dashboard-cards.spec.ts`, `suggestions.spec.ts`
- `pnpm --filter frontend test:e2e` vor Merge

## Drift Detection

`/impeccable doctor` prüft PRODUCT.md / DESIGN.md Konsistenz. `CONTEXT_STALE` in Setup-Ausgabe beachten.
