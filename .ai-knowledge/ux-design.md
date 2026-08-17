# Design-Sprache „Cockpit"

Verbindlicher Maßstab für **jede** sichtbare Änderung am Frontend. Diese Datei beantwortet die Frage
„sieht das richtig aus?" so, dass die Antwort nachprüfbar ist — nicht nach Geschmack.

Ergänzende Pflichtlektüre (nicht hier dupliziert):

- [Konventionen → Mobile-First](conventions.md) — 375px-Referenz, 44px-Touch-Targets, Aufwärts-Kaskade,
  kein horizontales Scrollen, e2e-Pflicht bei 375×812.
- [UX-Pattern: Sequenzielle Bestätigung](../docs/ux-pattern-sequential-confirmation.md) — destruktive Aktionen.

## 1. Haltung

Priority Pilot beantwortet **eine** Frage: _„Woran arbeite ich als Nächstes?"_

Daraus folgt die Gestaltungsregel: **Pro Ansicht gibt es genau eine Hauptaussage.** Sie trägt die
Signalfarbe und den größten Typo-Grad; alles andere ordnet sich unter. Auf dem Dashboard ist das die
nächste sinnvolle Aufgabe — nicht die Statistik-Karten, nicht die Säulen-Balance.

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

Freihändige Werte sind der häufigste Grund, warum eine Oberfläche unruhig wirkt. Es gibt daher nur
diese Stufen — jede neue Regel in `app.css` greift auf sie zu.

| Skala        | Tokens                                     | Werte                                                                          |
| ------------ | ------------------------------------------ | ------------------------------------------------------------------------------ |
| **Abstand**  | `--pp-space-1` … `--pp-space-8`            | 0.25 / 0.5 / 0.75 / 1 / 1.5 / 2 / 3 / 4 rem                                    |
| **Typo**     | `--pp-font-size-xs` … `--pp-font-size-2xl` | 0.8125 / 0.875 / 1 / 1.125 / 1.375 / 1.75 rem                                  |
| **Zeile**    | `--pp-line-tight`, `--pp-line-base`        | 1.25 / 1.55                                                                    |
| **Gewicht**  | `--pp-weight-regular/medium/bold`          | 400 / 600 / 700                                                                |
| **Radius**   | `--pp-radius-sm/md/lg/pill`                | 0.375 / 0.625 / 1 / 999rem                                                     |
| **Schatten** | `--pp-shadow-card`, `--pp-shadow-overlay`  | genau zwei — Karte und Overlay. Kein dritter.                                  |
| **Bewegung** | `--pp-motion-fast/base`, `--pp-ease`       | 120ms / 200ms; unter `prefers-reduced-motion: reduce` global auf 1ms reduziert |

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

1. Nur Tokens verwendet — kein Hex, kein `px`-Abstand außerhalb der Skala?
2. Bedienelemente/Überschriften/Tabellen aus KoliBri — oder Ausnahme begründet?
3. 375px: kein horizontales Scrollen, Touch-Ziele ≥ 44px?
4. Hell **und** dunkel geprüft, Kontraste gerechnet?
5. Lade-, Leer- und Fehlerzustand gestaltet?
6. Fokus sichtbar (`:focus-visible` mit `--pp-focus-ring`), Reihenfolge logisch, Tastatur reicht?
7. Genau eine Hauptaussage je Ansicht — und trägt sie die Signalfarbe?
8. e2e-Test bei 375×812 vorhanden, der den Kernpunkt festnagelt?
