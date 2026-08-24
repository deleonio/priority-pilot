# Mobile: Säulen-Verteilung im Task-Formular — Slider volle Breite, Entfernen gut klickbar

**Stand:** 2026-08-24
**Issue:** #996
**Ziel:** Die `.pillar-row` des TaskForm (Säulen-Beiträge: Anteil + Konfidenz + Entfernen-Button) quetscht auf Mobilgeräten nichts mehr nebeneinander; Desktop bleibt unverändert.

## Ziel

1. Bei Viewport ≤ 768 px liegt jeder `KolInputRange` einer Säulen-Zeile (Anteil und Konfidenz) in **eigener Zeile** und füllt sie mit **≥ 90 % der Zeilen-Innenbreite** (Inhaltbreite = `clientWidth` − horizontales Padding).
2. Der Entfernen-Button (✕, `KolButton` mit `_variant="danger"`, `_hideLabel`) hat auf Mobile ein Tap-Target von **≥ 44×44 px** (WCAG 2.5.8) und bleibt am **rechten Rand** seiner `.pillar-row` erreichbar.
3. Bei Viewport > 768 px bleibt das bisherige Layout unverändert: Anteil + Konfidenz **nebeneinander in einer Zeile**, Entfernen rechts (`grid-template-columns: 1fr 1fr auto`).
4. Keine `.pillar-row` läuft bei 320 px horizontal aus dem Viewport (Bounding-Box-Check, nicht `scrollWidth` — die App-Shell clippt mit `overflow-x: hidden`, ein stiller Overflow erzeugt keinen Scrollbalken).

## Vorbedingung

- Nutzer ist angemeldet; mindestens eine Säule existiert (Default-Pillar `id: 1`).
- Task mit Säulen-Beitrag (z. B. `pillars: [{ pillarId: 1, share: 0.5, confidence: 80 }]`) ist angelegt.
- TaskForm-Bearbeiten-Dialog geöffnet: Aufgaben-Tab → „Weitere Aktionen" → „Bearbeiten" — der Block „Säulen-Beiträge" rendert pro Beitrag eine `.pillar-row` mit 2× `KolInputRange` + `KolButton`.

## Schritte

1. **Bearbeiten-Dialog bei 375×812 öffnen**
   - Anteil- und Konfidenz-Slider stehen **untereinander** (y(Anteil) < y(Konfidenz)).
   - Jeder Slider füllt ≥ 90 % der Zeilen-Innenbreite.
   - Der ✕-Button ist ≥ 44×44 px und endet nah an der rechten Zeilenkante.
2. **Viewport auf 1280×800 vergrößern**
   - Beide Slider liegen **nebeneinander** (x(Anteil) < x(Konfidenz), ±10 px gleiche Zeile), ✕-Button rechts davon.
3. **Viewport auf 320×812 verkleinern**
   - Jedes `kol-input-range` und jeder `kol-button` innerhalb aller `.pillar-row` endet bei `x + width ≤ 320` (kein stilles Clipping).

## Erwartetes Ergebnis

- **AK1** (Mobile volle Breite): e2e bei 375 px misst `boundingBox()` beider Slider je `.pillar-row` gegen die per `evaluate` ermittelte Inhaltbreite der Zeile — Stapelung + ≥ 90 %. Rot im Status-quo, weil `1fr 1fr` jedem Slider ≤ ~50 % zuweist.
- **AK2** (Tap-Target): e2e bei 375 px misst die `kol-button`-Host-Bounding-Box (≥ 44×44 px, 1 px Toleranz) und die rechte Kante (≤ 40 px vor Zeilenende). KoliBri gibt dem Button bereits 44 px Mindestgröße — der Test ist Schutz-Test (wie #934 AK2): heute vermutlich grün, rot sobald das Mobile-Layout den Button visuell schrumpft.
- **AK3** (Desktop unverändert): e2e bei 1280 px — x-Reihenfolge Anteil < Konfidenz < Button, ±10 px gleiche Zeile für beide Slider. Schützt die Rückseite der Media-Query (> 768 px Zweispaltigkeit bleibt).
- **AK4** (kein Overflow 320 px): e2e — All-Quantor über alle `.pillar-row`-Kinder (`kol-input-range`, `kol-button`) mit Guard „mind. eine Zeile vorhanden"; Bounding-Box statt `scrollWidth` (stilles Clipping, siehe Ziel 4).

## Abgrenzungen

- Keine Änderung an `removePillar`, den Slider-Werten, der Normierung (#82) oder am Dialog-Verhalten — reines CSS/Markup-Layout von `.pillar-row` (`frontend/src/app.css`, Muster: `.range-inputs-row` #727).
- Der Vitest-Regressionstest „Entfernen-Click ruft `removePillar(pillarId)` auf" existiert nicht als eigener Fall; bestehende Rendering-Checks in `TaskForm.test.tsx` (`.pillar-row` im DOM, Z. 317/737) sichern die Struktur. Da der Callback von diesem Ticket unangetastet bleibt, wird kein grüner Test nachgerüstet (kein roter Spec-Test möglich).
- Priorität/Aufwand-Range (`.range-inputs-row`, #727) und Säulen-Gewichtung (`.pillar-weights-grid`, #763) sind andere Verwendungsstellen und bleiben unberührt; ihre Suites laufen weiter grün.

## Referenzen

- Issue #996 (KI-ANALYSE + KI-UX-Block), Lösungsskizze: Mobile-Media-Query für `.pillar-row` analog `.range-inputs-row` (#727).
- Verwandt: #727 (Range-Inputs responsiv), #934 (Mindestbreite `min(300px, 100%)`), #763 (Säulen-Gewichtung Mobile-Grid).
