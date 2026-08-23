# Spec 931 — Erledigte-Aufgaben-Tabelle: Spaltenbreiten für Lesbarkeit (Desktop)

Status: Spec-Phase (rote Tests) · Issue: #931 · Vorgänger: #228 (Tabelle), #307 (Toolbar-Icon-Button)

> Hinweis: Der KI-ANALYSE-Block im Issue-Body ist defekt (enthält eine Shell-Platzhalter-Zeile statt
> Inhalt). Die Akzeptanzkriterien unten sind aus Titel, KI-UX-Block („UX-Beratung", Verdict ux-ready)
> und dem Analyse-Bot-Kommentar („Fix lokal in `CompletedTasksTable.tsx` + `app.css`
> (table-layout/colgroup im Desktop-Zweig) — Mobile-Layout (375px, AK-6) bleibt unberührt") abgeleitet.

## Ziel

Die Desktop-Darstellung (≥ 48rem) der Erledigt-Ansicht bekommt ein **deterministisches
Spaltenlayout**, damit lange Titel lesbar bleiben und die Punkte-Spalten nicht willkürlich
weit/niedrig dimensioniert sind. Das Mobile-Karten-Layout (< 48rem) bleibt unverändert.

## Vorbedingung

- App läuft, Nutzer hat mind. einen Task mit Status `Done` (nicht im Aufgabenwald sichtbar).
- Ansicht: Tab „Aufgaben" → Umschalter „Erledigte Aufgaben anzeigen" geprüft (vgl. Spec #228).
- Desktop-Viewport ≥ 768px (48rem), z. B. 1280×800.

## Akzeptanzkriterien

- **AK-931-1 (fixes Spaltenlayout ab Desktop):** Ab 48rem nutzt `.completed-tasks-table` ein
  fixes Spaltenlayout (`table-layout: fixed`, z. B. via `colgroup`/CSS-Breiten im Desktop-Zweig
  von `app.css`), statt des browser-gesteuerten Auto-Layouts. Unter 48rem bleibt das
  Karten-Layout (AK-6 aus #228) unberührt — dort gilt weiterhin: kein horizontales Scrollen bei
  375px (bereits durch den bestehenden Test `AK-6` in `frontend/e2e/completed-tasks.spec.ts`
  gedeckt, kein neuer Test).
- **AK-931-2 (Titel-Spalte dominant):** Die Titel-Spalte ist auf Desktop die dominante Spalte:
  Sie ist mindestens ** doppelt so breit wie jede einzelne Punkte-Spalte** und belegt mindestens
  **45 % der Tabellenbreite**; die Tabelle bleibt dabei ohne horizontales Scrollen vollständig im
  Viewport (`scrollWidth ≤` Viewport-Breite).
- **AK-931-3 (tabellarische Zahlen, rechtsbündig):** Die Punkte-Zellen (`td[data-label]`) sind
  auf Desktop rechtsbündig (`text-align: right`) und nutzen tabellarische Ziffern
  (`font-variant-numeric: tabular-nums`), damit Zahlen gleicher Größenordnung untereinander
  vergleichbar sind (KI-UX-Block, Abschnitt „A11y/BITV → Zahlen-Ausrichtung").

## Ablauf (Desktop-Prüfung, 1280×800)

1. Task mit Titel anlegen (UI), als erledigt markieren, Erledigt-Ansicht öffnen.
2. Berechnetes Layout der Tabelle prüfen: `getComputedStyle(table).tableLayout` === `fixed`.
3. Spaltenbreiten der Kopfzellen (`thead th`) messen: Titel ≥ 2 × max(Punkte-Spalten) und
   ≥ 45 % der Tabellenbreite; `document.body.scrollWidth` ≤ Viewport-Breite.
4. Berechnete Ausrichtung einer Punkte-Zelle prüfen: `text-align: right`,
   `font-variant-numeric: tabular-nums`.

## Erwartetes Ergebnis

- Schritte 2–4 erfüllen die drei AK oben (derzeit rot: Ist-Zustand ist `table-layout: auto`,
  alle Zellen linksbündig, `font-variant-numeric: normal`, Titel-Spalte ohne definierte Breite).
- Rein visuelle Anteile des KI-UX-Blocks (Touch-Target ≥ 44px des „Wieder öffnen"-Buttons,
  Kontrast/Farbtokens) werden ohne Test im Implementierungs-PR visuell begründet — die
  Test-Regel des Repos erzwingt für reines Styling keinen Test.

## Testabdeckung (rot bis Implementierung)

- `frontend/e2e/completed-tasks.spec.ts`, Describe `#931 — Desktop-Spaltenbreiten`:
  - AK-931-1 → Test „table-layout fixed ab 48rem"
  - AK-931-2 → Test „Titel-Spalte dominant, kein horizontales Scrollen"
  - AK-931-3 → Test „Punkte rechtsbündig mit tabellarischen Ziffern"
- Dedup: Bestehende Tests der Datei (AK-1..4, AK-6, #307) bleiben unberührt; keines deckte
  Spaltenbreiten/Ausrichtung ab.
