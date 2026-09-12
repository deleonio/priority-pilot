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

**Eine dokumentierte Ausnahme:** Graph-Visualisierung → `@xyflow/react` (MIT). KoliBri/KERN hat keine Graph- oder Diagramm-Komponente, und ein pan-/zoombarer DAG mit Kanten-Routing und Touch-Gesten wäre handgerollt mehrere hundert Zeilen Eigenbau. Die Bibliothek deckt ausschließlich die Canvas-Ebene im Tab „Wald" ab; Bedienelemente, Detailbereich und die barrierefreie Listenfassung bleiben KoliBri. Begründung im Kopf von `src/components/TaskGraphPanel.tsx`.

MCP-Nutzung: Vor neuer Komponenten-Nutzung `kolibri-mcp_search` / `kolibri-mcp_fetch` für Specs/Samples; `kern-mcp_get_component_docs` für Doku.

## Tokens (Priority Pilot — `--pp-*`)

Definiert in `frontend/src/app.css :root` / `[data-theme='dark']`.

### Zwei Paletten, ein Schalter

Die `--pp-*`-Tokens gelten für alles, was die App selbst malt (Light-DOM). Die KoliBri-Komponenten
werten sie **nicht** aus — sie fahren ihre eigene, BITV-geprüfte Palette und lösen sie seit
`@public-ui/theme-default` 4.4.1 über `light-dark()` gegen `color-scheme` auf. Das Theme deklariert
`color-scheme` bewusst nicht selbst (die Eigenschaft vererbt und überquert dabei die Shadow-Grenze),
also besitzt die Anwendung den Schalter: `applyTheme()` in `src/lib/theme.ts` setzt `data-theme`
**und** `color-scheme` auf `<html>`. Eines von beiden allein ergibt einen Mischzustand.

Angleichen — falls je nötig — über `--kolibri-color-*` auf `:root`, nie über Shadow-DOM-Selektoren
(unpublizierte API). Aktuell bewusst nicht getan: KoliBris Werte sind auf Kontrast geprüft.

### Farbe (Rollen, keine Hex-Werte im Komponenten-CSS)

| Rolle                   | Light           | Dark       | Verwendung                                                   |
| ----------------------- | --------------- | ---------- | ------------------------------------------------------------ |
| `--pp-ink`              | `#12161d`       | `#e6eaf0`  | Primärer Text                                                |
| `--pp-ink-muted`        | `#525b6a`       | `#a3adba`  | Sekundärer Text, Meta (Alias `--pp-text-muted`)              |
| `--pp-surface-0`        | `#f7f8fa`       | `#12161c`  | Seitenfläche (Alias `--pp-bg`)                               |
| `--pp-surface-1`        | `#ffffff`       | `#161b22`  | Karten, Panels                                               |
| `--pp-surface-2`        | `#eef1f6`       | `#1e242c`  | Eingesenkte Fläche (Alias `--pp-bg-muted`)                   |
| `--pp-border-subtle`    | `#dfe3ea`       | `#2b323c`  | Trenner ohne Bedienfunktion (Alias `--pp-border`)            |
| `--pp-border-strong`    | `#7b8493`       | `#646f7e`  | Grenze bedienbarer Elemente (≥ 3:1, WCAG 1.4.11)             |
| `--pp-brand`            | `#1b3a6b`       | `#8fb3f5`  | Marke, Fokusring (`--pp-focus-ring`)                         |
| `--pp-signal`           | `#f2b155`       | `#f0b357`  | **Primärfarbe / Hauptaussage** (Dashboard "Nächste Aufgabe") |
| `--pp-signal-wash`      | `#fdf3e3`       | `#2a2318`  | Signal-Hintergrund                                           |
| `--pp-signal-ink`       | `#8a4b00`       | `#f0b357`  | Text auf Signal-Hintergrund (Kontrast ≥ 4.5:1)               |
| `--pp-status-total`     | `#3f4a5c`       | `#98a2b3`  | Dashboard-Karte "Gesamt" (Alias `--pp-accent-total`)         |
| `--pp-status-open`      | `#1064d0`       | `#5aa2f5`  | Dashboard-Karte "Offen"                                      |
| `--pp-status-inprocess` | `#b54708`       | `#e8924a`  | Dashboard-Karte "In Bearbeitung"                             |
| `--pp-status-done`      | `#1a7f37`       | `#52c45f`  | Dashboard-Karte "Erledigt"                                   |
| `--pp-success`          | `#1a7f37`       | `#52c45f`  | Erfolgs-Zustände                                             |
| `--pp-warning`          | `#a15c07`       | `#e8924a`  | Warnungen                                                    |
| `--pp-danger`           | `#b42318`       | `#f97066`  | Destruktive Aktionen                                         |
| `--pp-pillar-1…7`       | Neon (geknickt) | Neon (pur) | Herz-Wasserstreifen + Legende-Tupfer (Neon-Palette, 2026-09) |

### Spacing (Skala, mobile-first)

```
--pp-gap-tight:    0.5rem  /* 8px  — intra-group */
--pp-gap-base:     1rem    /* 16px — inter-group */
--pp-gap-generous: 2rem    /* 32px — section break */
--pp-gap-major:    3rem    /* 48px — major section */
--pp-space-1 .. --pp-space-8  /* 0.25rem .. 4rem, für feinere Abstufung */
```

### Typografie

Genau fünf Größen, genau zwei Gewichte (mobile-ui-rules.md, Regel 6).

- Basis: `--pp-font-size-base: 1rem` (16px), System-UI Stack
- `--pp-font-size-sm: 0.875rem`, `-lg: 1.125rem`, `-xl: 1.375rem`, `-2xl: 1.75rem`
- `--pp-weight-regular: 400`, `--pp-weight-bold: 600`
- `--pp-line-tight: 1.25`, `--pp-line-base: 1.55`
- `font-variant-numeric: tabular-nums` für Zahlenkolonnen

### Radius

Drei Stufen (Regel 6): zwei Größen plus die Pille für Marker/Badges.

- `--pp-radius-sm: 0.375rem` (6px)
- `--pp-radius-md: 0.625rem` (10px) — Standard für Cards, Panels
- `--pp-radius-pill: 999rem` — Badges, Marker

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

### Herz (HeartBalance / HeartGlass)

- **Drei Wellen, drei Geschwindigkeiten** (Nutzer-Auftrag 2026-09): Oberfläche 7 s, Tiefenschicht 1: 14 s,
  Tiefenschicht 2: 23 s — identisch in SVG (`DEPTH_WAVE_LAYERS`) und Glas-Shader (`STRATUM`).
- Tiefenschichten liegen mit drop 3,4/6,8 im Wellental der jeweils vorherigen — sie durchbrechen nie
  die Wasserlinie (der Füllstand bleibt die eine Aussage).
- **Neon-Rampe** `--pp-pillar-1…8`: Dark volle Leuchtkraft (`#ff2d95`, `#00e5ff`, `#39ff14`, `#fff01f`,
  `#b026ff`, `#ff6a00`, `#00ffc8`, `#ff3131`); Light in Lesbarkeits-Brechung (`#d6006e`, `#0087a8`,
  `#16a416`, `#a89200`, `#8a1fd6`, `#c95400`, `#009179`, `#d40f0f`). Eine Quelle für Streifen und
  Legende (`rampClass`).
- SVG-Abdunkelung der Tiefenschichten: 0,16 / 0,22 (stärker als die Glas-Vorlage, dort ≈ 8 %).

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
