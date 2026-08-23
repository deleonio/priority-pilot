# Mobile-UI-Regeln

Verbindliches Regelset für Mobile-UI in Priority Pilot — Maßstab für die **UX-Beratung** (Phase 2)
und die **Umsetzung** (Phase 3). Die Review-Phase wertet es bewusst nicht aus (User-Entscheidung,
#822). Verankerung nach dem Muster von
[ux-pattern-sequential-confirmation.md](ux-pattern-sequential-confirmation.md).

Stabiler Pfad für Querverweise: `docs/mobile-ui-rules.md`.

**Referenzgerät:** Galaxy S24 — 360 dp Viewport-Breite, ~780 dp Höhe, Einhand-Bedienung mit dem
Daumen. Für dieses Repo gilt die Viewport-Breite **375px** (siehe Repo-Abstimmung unten).
**Grundlagen:** Material Design 3, Apple HIG, WCAG 2.2 / BITV 2.0, Hoober-Feldstudien zur
Handhaltung.

---

## Repo-Abstimmung (verbindlich)

Das Regelset kollidiert an drei Stellen mit bestehenden Repo-Konventionen. Entscheidung:
**„Regeln übernehmen + Repo-Abstimmung"** — kein Widerspruch, keine Migration der
Bestands-Konventionen.

- **Touch-Targets:** 44px bleibt verbindliches Minimum (KoliBri `--a11y-min-size: 2.75rem`, Header-Budget ≤64px
  in `frontend/e2e/mobile-shell.spec.ts`); 48dp ist Design-Ziel, wo die App die Geometrie selbst bestimmt; die
  8dp-Abstand-Regel gilt unverändert.
- **Referenz-Viewport:** 375px (Repo-Konvention, E2E 375×812) statt 360dp; die Reflow-Regel (kein horizontales
  Scrollen, auch bei 200 % Textvergrößerung) bleibt aus dem Regelset erhalten.
- **App-Shell:** Die Header-Toolbar mit 5 gelabelten Aktionen (kein Hamburger, #691) ist das bestehende,
  bewährte Muster. Die Daumen-Zonen-Hierarchie (Primäraktion im unteren Drittel, Bottom-Navigation statt
  Hamburger) gilt als Maßstab für **neue Screens, Flows und künftige Navigations-Entscheidungen** — nicht als
  Umbau-Auftrag für die bestehende Shell.
- **Design Tokens:** Farben sind tokenisiert (`--pp-*` in `frontend/src/app.css`);
  Spacing-/Radien-/Typografie-Tokens existieren (noch) nicht. Die 4/8/12/16/24/32px-Skala ist de-facto
  eingehalten (app.css nutzt genau diese rem-Werte) — Token-Pflicht gilt für neues CSS.

---

## Die 10 Regeln (erweitert um Craft Floor)

1. **Der Daumen bestimmt die Hierarchie** — Unteres Drittel bequem erreichbar, Mitte mit Streckung, obere Ecke
   gegenüber der Greifhand gar nicht. Primäraktion in Bottom-Bar/Bottom-Sheet/FAB unten rechts; oben rechts nur
   seltene oder destruktive Aktionen; Bottom Navigation statt Hamburger-Menü. _Prüfbar: keine häufig genutzte
   Aktion oberhalb von 60 % der Viewport-Höhe._
2. **Touch-Targets: 48 × 48 dp, 8 dp Abstand** — WCAG 2.2 SC 2.5.8 (24×24) ist juristische Untergrenze, nicht
   Designziel; Material 3 setzt 48dp, Apple 44pt an. Sichtbare Fläche darf kleiner sein, tappbare nicht (Padding
   statt größerer Icons); ≥8dp Leerraum zwischen Targets; Icon-only-Buttons brauchen immer `aria-label`.
   _Prüfbar: jedes interaktive Element ≥48×48dp inkl. Padding._ (Repo-Abstimmung: 44px Minimum, 48dp Ziel.)
3. **Eine Spalte, kein horizontales Scrollen** — Eine einzige Spalte bis mindestens 600dp Breite; kein
   horizontales Scrollen bei 320dp und 200 % Textvergrößerung (WCAG 1.4.10 Reflow); Tabellen werden auf Mobile
   zu Karten oder Definitionslisten umgebaut.
4. **Einstellungen sind eine flache Liste, kein Formular** — Vertikale Liste: links Label, rechts
   Zustand/Control; Zustand **ohne Antippen sichtbar**; Gruppierung durch Überschriften/Abstand, nicht
   Rahmen/Cards; maximal zwei Ebenen Tiefe; kein Speichern-Button (Ausnahme: destruktive/kostenpflichtige
   Aktionen mit Bestätigung); selten genutzte Optionen nach unten statt „Erweitert"-Untermenü.
5. **Ein Screen, eine Aufgabe** — Genau eine Primäraktion pro Screen; zwei gleichwertige Hauptaktionen = zwei
   Screens; Formulare in Schritte zerlegen, sobald länger als ein Viewport.
6. **Feste Skalen statt freier Werte** — Abstände ausschließlich 4/8/12/16/24/32/48dp; maximal fünf
   Schriftgrößen, Fließtext ≥16px; maximal zwei Gewichte; maximal drei Radien-/Elevation-Stufen;
   Farben/Abstände/Größen aus Design Tokens, keine Hardcodes im Komponentencode.
7. **Jeder asynchrone Zustand ist entworfen** — Vier gestaltete Zustände pro datenladender Ansicht: **Laden,
   Leer, Fehler, Erfolg**; Leerzustand als Einladung zum Handeln; Fehlerzustand nennt was passiert ist und wie
   es weitergeht (keine Entschuldigungen, keine nackten Fehlercodes); Rückmeldung auf jede Eingabe <100ms
   (mindestens Press-State); Skeletons statt Spinner bei vorhersagbarer Struktur.
8. **Tastatur und Safe Areas gehören zum Layout** — Sticky Buttons über der Tastatur; fokussiertes Feld bleibt
   sichtbar bei aufgeblendeter Tastatur; `env(safe-area-inset-*)` respektieren; passende
   `inputmode`/`autocomplete` an jedem Feld.
9. **Barrierefreiheit ist Teil der Definition of Done** — Kontrast 4,5:1 Text / 3:1 UI+Grafiken (WCAG
   1.4.3/1.4.11); Information nie allein über Farbe (1.4.1); sichtbarer Fokus-Indikator auch auf Touch;
   logische Überschriftenstruktur/Fokusreihenfolge im DOM; Touch-Gesten haben immer eine Alternative über
   sichtbare Bedienelemente (2.5.1).
10. **Bewegung ist sparsam und abschaltbar** — Übergänge 150–250ms, `ease-out` erscheinen / `ease-in`
    verschwinden; Bewegung erklärt Herkunft und Ziel, sonst streichen; `prefers-reduced-motion: reduce`
    respektieren (dann nur Opacity, WCAG 2.3.3); nichts blinkt oder pulsiert dauerhaft.

## Anti-Patterns (sofortiger Ablehnungsgrund im Review)

Hamburger als primäre Navigation · Modal in Modal · horizontales Scrollen für Kerninhalte ·
Settings-Zeile ohne sichtbaren aktuellen Wert · Speichern-Button in Einstellungen · Placeholder statt
Label · Fließtext unter 16px · Toast als einziger Ort für Fehlermeldungen · mehr als eine
Primäraktion pro Screen · Abstandswerte außerhalb der 4-dp-Skala

**Zusätzlich aus Craft Floor Refuse:**
Icon+Heading+Text Cards als Page-Scaffold · Hero-Metric Template · Kicker über Heading ·
Section Numbers ohne Info-Wert · Modal ohne Interruption/Focus-Grund · Gradient Text ·
Glass/Blur Deko · Farbige Borders >1px · Harte Offset Shadows außerhalb neobrutalist ·
Sparklines/Progress Rings als Content-Platzhalter · Monospace Kostüm · System Display Face ·
Emoji als Icons · Geometrische Masks · Light/Dark nach Kategorie

## Review-Checkliste

_(Mit Repo-Abstimmung: 375px Breite, ≥44px Touch-Targets.)_

1. Bei 375px Breite kein horizontales Scrollen? 2. Alle interaktiven Elemente ≥48dp? 3. Primäraktion im unteren
   Drittel? 4. Laden/Leer/Fehler/Erfolg vorhanden? 5. Kontraste geprüft? 6. Bei 200 % Textgröße noch bedienbar? 7. Nur Token-Werte? 8. `prefers-reduced-motion` behandelt?

## Prinzip bei Konflikten

Bedienbarkeit schlägt Ästhetik. Konsistenz schlägt Kreativität. Weniger Elemente schlägt bessere
Anordnung vieler Elemente.

**Impeccable Ergänzung:** Mit jedem Check grün — die Page dem committed World widmen. Zwischen refined und committed: commit.
