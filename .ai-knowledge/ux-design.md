# Design-Sprache „Cockpit"

**Wie es aussieht** — Farbrollen, Skalen, Komponentenwahl. Die Schwesterdatei
[docs/mobile-ui-rules.md](../docs/mobile-ui-rules.md) regelt, **wie es sich bedient** (Daumen-Zonen,
Touch-Targets, asynchrone Zustände, Anti-Patterns). Beide gelten zusammen; hier steht nichts, was
dort schon steht.

Diese Datei liefert konkret die Tokens, die
[Regel 6 dort](../docs/mobile-ui-rules.md#die-10-regeln) einfordert und die es bisher nur für Farben
gab: Abstand, Typografie, Radius, Schatten, Bewegung.

Ergänzende Pflichtlektüre (nicht hier dupliziert):

- [Mobile-UI-Regeln](../docs/mobile-ui-rules.md) — die 10 Regeln inkl. Repo-Abstimmung.
- [Konventionen → Mobile-First](conventions.md) — Aufwärts-Kaskade, e2e-Pflicht bei 375×812.
- [UX-Pattern: Sequenzielle Bestätigung](../docs/ux-pattern-sequential-confirmation.md) — destruktive Aktionen.

## 1. Haltung

Priority Pilot beantwortet **eine** Frage: _„Woran arbeite ich als Nächstes?"_

Daraus folgt die gestalterische Lesart von „ein Screen, eine Aufgabe"
([Regel 5](../docs/mobile-ui-rules.md)): **Die eine Primäraktion hat auch eine Hauptaussage** — sie
trägt die Signalfarbe und den größten Typo-Grad, alles andere ordnet sich unter. Auf dem Dashboard
ist das die nächste sinnvolle Aufgabe — nicht die Statistik-Karten, nicht die Säulen-Balance.

- **Ruhe vor Reichtum.** Flächen sind neutral, Farbe ist ein Signal. Wo eine Farbe nichts bedeutet,
  ist sie falsch.
- **Zahlen brauchen Kontext.** Ein Wertbeitrag ohne Bezugsgröße ist Dekoration; Label und Einheit
  gehören daneben, nicht in ein Tooltip.
- **Der Zustand ist immer sichtbar.** Laden, leer, Fehler und Erfolg sind gestaltete Zustände
  (`KolSpin`, `EmptyState.tsx`, `KolAlert`) — kein Screen springt kommentarlos von leer auf voll.

## 2. Farbe

Farbe wird über **Rollen** angesprochen, nie über Hex-Werte im Komponenten-CSS. Alle Rollen sind in
`frontend/src/app.css` als `--pp-*`-Custom-Properties definiert, hell in `:root`, dunkel in
`:root[data-theme='dark']`. Custom Properties vererben sich über Shadow-DOM-Grenzen — KoliBri-Komponenten
sehen dieselben Werte.

| Rolle                             | Bedeutung                                             |
| --------------------------------- | ----------------------------------------------------- |
| `--pp-brand`, `--pp-brand-strong` | Marke: Kopfzeile, primäre Aktion, Fokusring           |
| `--pp-signal`, `--pp-signal-ink`  | **Die eine Antwort** — nächste Aufgabe, Hauptaussage  |
| `--pp-surface-0/1/2`              | Seitenfläche / Karte / eingesenkte Fläche             |
| `--pp-border-subtle`              | Trenner ohne Bedienfunktion                           |
| `--pp-border-strong`              | Grenze bedienbarer Elemente (≥ 3:1, WCAG 1.4.11)      |
| `--pp-ink`, `--pp-ink-muted`      | Primär- und Sekundärtext (beide ≥ 4.5:1)              |
| `--pp-status-open/inprocess/done` | Aufgabenstatus                                        |
| `--pp-success/warning/danger`     | Rückmeldung — immer mit Icon **und** Text, nie allein |
| `--pp-pillar-1…8`                 | Kategoriale Rampe für die nutzerdefinierten Säulen    |

**Regeln**

1. **Kontrast ist eine Zusage, keine Schätzung.** Text ≥ 4.5:1, bedienbare Grenzen und Signalflächen
   ≥ 3:1 — in **beiden** Farbschemata. Neue Werte werden gerechnet, nicht geschaut.
2. **Farbe trägt nie allein Bedeutung** (BITV/WCAG 1.4.1). Status = Farbe **+** Text/Icon.
3. **Die Säulen-Rampe wird der Reihe nach vergeben, nie durchgezählt-zyklisch.** Die Säulen sind
   nutzerdefiniert; ab der 9. Säule wird nicht neu eingefärbt, sondern gebündelt oder nur der Name
   gezeigt. Farbe folgt der Säule, nicht ihrem Rang — eine Umsortierung darf keine Umfärbung auslösen.
4. **Die Rampe ist validiert, nicht geraten.** Herkunft: validierte Referenzpalette des `dataviz`-Skills,
   nachgerechnet gegen unsere Kartenflächen (hell `#ffffff`, dunkel `#161b22`) — alle Prüfungen bestanden,
   schlechtestes Nachbarpaar CVD ΔE 9.1 (hell) / 8.4 (dunkel). Drei Hell-Werte liegen unter 3:1 zur
   weißen Fläche; deshalb gilt für Säulen-Visualisierungen die **Relief-Regel**: der Säulenname steht
   immer als Text daneben (im Repo bereits so: `.dashboard-balance-name`, `.dashboard-pillar`).
   Wer die Rampe ändert, führt `scripts/validate_palette.js` des `dataviz`-Skills erneut aus.
5. **Dunkelmodus wird gewählt, nicht gespiegelt.** Jede Rolle hat einen eigenen Dunkelwert.
6. **Fläche und Textfarbe reisen zusammen.** Wer `background` auf ein Token zieht, setzt in derselben
   Regel `color`. Im KoliBri-Umfeld erbt Text sonst Schwarz und wird im Dunkelmodus unlesbar —
   gemessene 1.34:1 (`docs/ux-audit-2026-08.md`, P1-1).

## 3. Skalen

Die Umsetzung von [Regel 6](../docs/mobile-ui-rules.md) („Feste Skalen statt freier Werte"): Es gibt
nur diese Stufen — jede neue Regel in `app.css` greift auf sie zu, statt Werte frei zu setzen.

| Skala        | Tokens                                     | Werte                                                                          |
| ------------ | ------------------------------------------ | ------------------------------------------------------------------------------ |
| **Abstand**  | `--pp-space-1` … `--pp-space-8`            | 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 px (als rem)                               |
| **Typo**     | `--pp-font-size-sm` … `--pp-font-size-2xl` | 0.875 / 1 / 1.125 / 1.375 / 1.75 rem — fünf Größen, Fließtext ≥ 16px           |
| **Zeile**    | `--pp-line-tight`, `--pp-line-base`        | 1.25 / 1.55                                                                    |
| **Gewicht**  | `--pp-weight-regular`, `--pp-weight-bold`  | 400 / 600 — zwei Gewichte                                                      |
| **Radius**   | `--pp-radius-sm/md/pill`                   | 0.375 / 0.625 / 999 rem — drei Stufen                                          |
| **Schatten** | `--pp-shadow-card`, `--pp-shadow-overlay`  | genau zwei — Karte und Overlay. Kein dritter.                                  |
| **Bewegung** | `--pp-motion-fast/base`, `--pp-ease`       | 120ms / 200ms; unter `prefers-reduced-motion: reduce` global auf 1ms reduziert |

Die Abstands-Stufen sind exakt die 4/8/12/16/24/32/48-Skala der Mobile-UI-Regeln (plus 64 für den
Seitenfuß); Größen-, Gewichts- und Radien-Obergrenzen ebenfalls von dort.

Zahlenkolonnen (Tabellen, Achsen, Wertbeiträge untereinander) bekommen
`font-variant-numeric: tabular-nums`; einzelne große Zahlen bleiben proportional.

## 4. Komponentenwahl — KoliBri zuerst

Bedienelemente, Überschriften und Tabellen kommen **immer** aus KoliBri. Rohes HTML ist ausschließlich
für Layout-Container zulässig (`div`, `section`, `ul`/`li`, `p`, `span`).

| Zweck                       | Komponente                                             |
| --------------------------- | ------------------------------------------------------ |
| Aktion                      | `KolButton` (`_variant="primary"` nur einmal je Sicht) |
| Überschrift                 | `KolHeading` mit `_level`                              |
| Texteingabe / Zahl / Datum  | `KolInputText`, `KolInputRange`, `KolInputDate`        |
| Auswahl                     | `KolSingleSelect`, `KolInputRadio`, `KolInputCheckbox` |
| Meldung                     | `KolAlert` (`_type` passend zur Rolle)                 |
| Fläche/Gruppierung          | `KolCard`                                              |
| Dialog                      | `KolDialog` bzw. `components/Modal.tsx`                |
| Tabelle                     | `KolTableStateful` — auf 375px durch Liste ersetzen    |
| Ladezustand                 | `KolSpin` mit `_label`                                 |
| Fortschritt / Anteil        | `KolMeter`                                             |
| Marker (Serie, Ausnahme, …) | `KolBadge`                                             |

**Ausnahmen** brauchen im Code einen Kommentar mit Grund (Muster im Repo: die Kommentare in
`main.tsx` und `app.css`). Ohne Begründung gilt rohes `<button>`/`<input>`/`<table>`/`<h1>` als Fehler.

Bei Unsicherheit über Props oder Verhalten: **KoliBri-MCP** (`mcp__kolibri-mcp__search` / `fetch`,
z. B. `spec/button`) statt raten.

## 5. Layout

- **Mobile-first** nach [conventions.md](conventions.md) — Basis ist 375px, Desktop kommt per
  `@media (min-width: …)` dazu.
- Ein Bruchpunkt trägt die Hauptlast: **48rem** (Tablet). Weitere nur mit Begründung.
- Inhaltsbreite bleibt bei `max-width: 80rem` zentriert (`.app`).
- Vertikaler Rhythmus: Abschnitte `--pp-space-6`, Elemente innerhalb einer Karte `--pp-space-3/4`.
- Safe-Area-Insets (installierte PWA) sind gesetzt und bleiben es.

## 6. Prüfliste vor „fertig"

Ergänzt die Prüfpunkte der [Mobile-UI-Regeln](../docs/mobile-ui-rules.md) um die visuelle Seite:

1. Nur Tokens verwendet — kein Hex, kein Abstand außerhalb der Skala?
2. Bedienelemente/Überschriften/Tabellen aus KoliBri — oder Ausnahme begründet?
3. Hell **und** dunkel geprüft, Kontraste gerechnet (nicht geschaut)?
4. Fläche und Textfarbe zusammen gesetzt, wo ein Token-Hintergrund gesetzt wird?
5. Fokus sichtbar (`:focus-visible` mit `--pp-focus-ring`)?
6. Trägt die eine Primäraktion auch die Hauptaussage und die Signalfarbe?
7. e2e-Test bei 375×812 vorhanden, der den Kernpunkt festnagelt?

## 7. Craft Floor (aus Impeccable Skill — verbindliche Qualitätsuntergrenze)

Diese Checks laufen **gebatcht in einer Inspektionsrunde** (Desktop + Mobile zusammen), nicht als separate Screenshot-Trips:

| Check | Kriterium |
|-------|-----------|
| **Contrast** | Body/Placeholder ≥4.5:1, Large Text ≥3:1. Auf farbigen Flächen Secondary Text aus Hue tinten, nie Grau. |
| **Depth** | Shadows tragen Offset + Soft Blur. Zero-offset colored Halo = Deko. |
| **Spacing** | Tight Groups, generöse Separation, mehr Space über Heading als darunter. Computed Values lesen. |
| **Type** | Body Measure 65–75ch, Display max 6rem, Tracking floor -0.04em, balancierte Headings, offensichtliche Scale/Weight Steps. Real Copy an jedem Breakpoint, Overflow fixen. |
| **Motion** | **Ein** authored Moment, nicht scattered Effects, nicht identischer Entrance auf jeder Section. Exponential ease-out von already-visible Default. Beyond transform/opacity: blur, backdrop-filter, clip-path, mask, shadow gehören zur Palette. |
| **States** | hover, disabled, loading, error, empty — **plus** real content, working controls, responsive composition, keyboard focus. |
| **Browser Surfaces** | Parts you didn't draw: text selection, caret, custom scrollbars, focus rings, underline offset, tabular numerals. **Theme them from palette** — cheapest signal for "built not assembled". |
| **Copy** | Produkt-Eigene Sprache. Controls benennen Action; Errors benennen Problem + Recovery. |
| **Coverage** | Every brief requirement present and findable within seconds. |

**Refuse (Defaults, die das Brief explizit verdienen muss):**
- Same-size Icon+Heading+Text Cards als Page-Struktur
- Hero-Metric Template (Big Number + Small Label)
- Kicker/Eyebrow über Heading (Ban — kein Brief verdient es zurück)
- Section Numbers (01/02/03) ohne Sequenz-Info
- Modal für Task ohne Interruption/Focus-Grund
- Gradient Text (Emphasis = Weight/Size)
- Glass/Blur als Deko
- Farbige border-left/right >1px auf Cards/Alerts
- Hard Offset Shadows (4px 4px 0) außerhalb neobrutalist
- Sparklines/Progress Rings als Content-Platzhalter
- Monospace als "technical" Kostüm
- System Display Face (Impact, Arial Black) als Display Voice
- Emoji/Unicode als Icon-System Ersatz
- Geometric Masks statt Organic Contours
- Light/Dark nach Kategorie statt Use Scene

## 8. Modus-Entscheidung (Persuade / Operate / Read / Experience)

Jede Surface hat **einen Modus**, der bestimmt, was Erfolg bedeutet:

| Modus | Ziel | Priority Pilot Beispiel |
|-------|------|------------------------|
| **Persuade** | Visitor decides & acts | Landing, Pricing, Kampagnen |
| **Operate** | Visitor completes task | Dashboard, Editor, Settings, Tools |
| **Read** | Visitor understands | Docs, Help, Guides, Changelogs |
| **Experience** | Visitor is inside work | Portfolio, Showcase |

**Regel:** Modus aus **Surface** ableiten, nicht aus Product. Ein Tool's Landing = Persuade, Fashion House Docs = Read, Docs Index = Read.

- **Persuade/Experience** dürfen bolder Color Strategies (Committed/Full/Drenched)
- **Operate/Read** default zu Restrained (Neutrals + 1 Accent)
- Dark/Light nie Default — physikalische Scene (wer, wo, Licht) zwängt die Entscheidung

## 9. Farb-Strategie & Faces

**Color Strategy vor Colors picken:**
- **Restrained** (Neutrals + 1 Accent) — Default für Operate/Read
- **Committed** (1 Saturated Color trägt 30–60% Surface) — Persuade/Experience mit Brief-Erlaubnis
- **Full Palette** (3–4 Named Roles)
- **Drenched** (Surface IS the Color)

Color commits at page scale: Fields owning whole regions, not scattered accents.

**Faces aus Subject's World wählen** (Training-Defaults = you stopped looking):
Fraunces, Playfair Display, Cormorant, Lora, Crimson, Newsreader, Syne, Space Grotesk, Space Mono, IBM Plex, Inter-as-display, DM Sans, DM Serif, Outfit, Plus Jakarta Sans, Instrument Sans. Naming one = Reason no other face satisfies.

**Calibration gegen AI-Defaults:**
AI Interfaces clustern um: Warm Cream + High-Contrast Serif + Terracotta/Red • Near-Black + Neon + Glow • Broadsheet Editorial Hairlines + Italic Serif + Tracked Mono. Landing in one ohne Brief-Pin = Self-Check Failed. Rework until neither answer obvious from category alone.
