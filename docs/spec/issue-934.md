# InputRange-Mindestbreite 300 px + doppelte Säulen-Beschreibung entfernen

**Stand:** 2026-08-24
**Issue:** #934
**Ziel:** `KolInputRange` bricht nicht mehr um (Slider + Zahlenfeld nebeneinander), Säulen-Beschreibung steht nur noch einmal auf der Seite.

## Ziel

1. Jedes `kol-input-range`-Feld ist auf Desktop (1280 px) mindestens **300 px** breit, sofern der umgebende Container das hergibt — an allen Verwendungsstellen: Säulen-Gewichtung (`/settings/pillars`, Tab „Säulen"), TaskForm (Priorität/Aufwand), DependencyModal (Gewicht).
2. Die Mindestbreite erzeugt bei Mobile (375 px) **keinen horizontalen Scrollbalken** — der Host nutzt einen Fallback wie `min-width: min(300px, 100%)`.
3. Die Säulen-Gewichtung rendert `pillar.description` **nicht mehr** pro Slider (`.pillar-description` entfällt aus dem DOM). Die Beschreibungen der Säulenliste darüber (`.pillar-list-description` in `PillarList`) bleiben unverändert erhalten.
4. Die bestehenden Range-e2e (`input-range-fields.spec.ts` #287, `issue-763.spec.ts` AK1–AK3) laufen weiterhin grün; die #727-Regression (Y-Versatz) wird nicht reaktiviert.

## Vorbedingung

- Nutzer ist angemeldet, mindestens eine Säule mit Beschreibung existiert.
- Säulen-Gewichtung geöffnet: Startseite → „Einstellungen" → Tab „Säulen" (die Säulenliste mit `.pillar-list-description` und darunter die Gewichtungs-Formulars stehen auf demselben Tab).

## Schritte

1. **Säulen-Tab bei 1280 px laden**
   - Jeder `kol-input-range` der Gewichtungs-Cards ist ≥ 300 px breit.
   - Innerhalb jedes `kol-input-range` brechen Slider und Zahlenfeld nicht mehr um.
   - Unterhalb der Slider steht **kein** Beschreibungstext mehr (`.pillar-description` existiert nicht im DOM).
2. **TaskForm bei 1280 px öffnen (Aufgaben-Tab → „…" → Bearbeiten)**
   - Prioritäts- und Aufwands-Range sind jeweils ≥ 300 px breit; der Container (Dialog bei 1280-px-Viewport) bietet das her — notfalls durch Umbruch der `.range-inputs-row` statt side-by-side Quetschung.
3. **Viewport auf 375×812 (und 320×812) verkleinern (Säulen-Tab)**
   - Die Range-Felder bleiben vollständig sichtbar — nichts wird am Viewportrand abgeschnitten. (Die App-Shell clippt mit `overflow-x: hidden`; ein Scrollbalken entsteht strukturell nie, Überlauf führt zu stiller Clipping. Deshalb misst der Test Bounding-Boxes, nicht `scrollWidth`.)
4. **Säulenliste prüfen**
   - Je Säule bleibt die Kurzbeschreibung (`.pillar-list-description`) erhalten — Inhalt = `pillar.description` aus der API.

## Erwartetes Ergebnis

- **AK1** (300 px, alle Verwendungsstellen): e2e misst `boundingBox().width` jedes `kol-input-range` auf dem Säulen-Tab und im TaskForm-Bearbeitungsdialog bei 1280 px — jeweils ≥ 300 px (1 px Toleranz). Das DependencyModal-Gewicht nutzt dieselbe globale Host-Regel und wird über die beiden verprobten Stellen sowie AK4-Regressionsschutz abgedeckt (kein eigener e2e — gleiche CSS-Ursache, keine unabhängige Verhaltensquelle).
- **AK2** (kein horizontaler Überlauf mobil): e2e bei 375×812 **und** 320×812 prüft per Bounding-Box, dass jedes `kol-input-range` vollständig im Viewport liegt. Schutz-Test: heute grün, rot unter naivem `min-width: 300px` ohne `min(300px, 100%)`-Fallback (bei 375 px schluckt das Card-Padding die Differenz, erst 320 px macht den Clipping-Fehler sichtbar — per Mutations-Probe verifiziert).
- **AK3** (doppelte Beschreibung entfernen): Vitest — gerendertes Gewichtungs-Formular enthält kein `.pillar-description`-Element mehr; `PillarList` rendert je Säule `.pillar-list-description` mit dem API-Text (Spiegel gegen stillen Verlust der Stammdaten-Anzeige).
- **AK4** (keine Regression): durch die bereits existierenden Suites `input-range-fields.spec.ts` und `issue-763.spec.ts` AK1–AK3 abgedeckt (Dedup — kein neuer Test). `issue-763` AK4 bleibt grün, weil dessen `.or([class*="description"])`-Locator weiterhin `.pillar-list-description` auf demselben Tab findet.

## Abgrenzungen

- Keine Logikänderung an Gewichtung/Normierung (`PUT /pillars/weights` unberührt).
- `.pillar-list-description`, `PillarWeightsModal`-Rahmen und TaskForm-Feldattribute (min/max/step, #287) bleiben unangetastet.
- Reine Styling-Aspekte jenseits der messbaren Breiten/Scrollbars (z. B. Grid-minmax-Wert im Detail) haben keinen eigenen Test.
