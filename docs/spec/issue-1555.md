# Spec #1555 — Hinweis bei stark unausgewogener Säulen-Gewichtung

## Ziel

Die Säulen-Gewichtung (`PillarWeightsForm`, Karte „Säulen-Gewichtung" im Settings-Tab „Säulen",
`/settings/pillars`) zeigt einen **freundlichen, nicht blockierenden** Warn-Hinweis
(`KolAlert _type="warning"`, Muster `AiQuotaHint.tsx`), sobald die aktuelle Verteilung stark vom
gleichmäßigen Zustand abweicht. Speichern bleibt immer möglich; bestehende Summen-/Validierungslogik
(`isRawDistributionValid`, `isWeightSumValid`, EPSILON) und der Fehler-Alert bleiben unberührt.

## Unausgewogenheit (reine Funktion, `frontend/src/lib/pillar.ts`)

Neue exportierte Funktion `isDistributionUnbalanced(raws: readonly (number | null)[]): boolean`:

- Anteil je Säule: `shareᵢ = rohᵢ / Σroh` (null zählt als 0).
- **Unausgewogen** genau dann, wenn ein Anteil **strikt größer als 2×** oder **strikt kleiner als ½**
  des gleichmäßigen Anteils `1/n` ist („mehr als das Doppelte", „weniger als die Hälfte").
- Grenzfälle **exakt** 2× und exakt ½ sind **kein** Hinweis (Float-Toleranz analog
  `WEIGHT_SUM_EPSILON`).
- Skaleninvariant: nur die Anteile zählen (`5 × 0,1` ≡ `5 × 1` ≡ `5 × 20`).
- Nicht normierbar (Σroh ≤ 0, z. B. alle 0/null): `false` — dafür ist der bestehende
  Summen-Fehlerzustand zuständig, kein Doppelmelden.

Beispiele (5 Säulen): `45/5/20/15/15` → `true`; `5 × 20` → `false`; `40/20/20/10/10` (exakt 2× und
exakt ½) → `false`; `42/20/20/9/9` → `true`.

## Formular-Verhalten (`PillarWeightsForm.tsx`)

- Der Hinweis wird **über den Slidern** gerendert (gleicher Einbettungsort wie der bestehende
  Fehler-Alert, `KolAlert _type="warning"` mit eigenem `_label`, semantisch getrennt vom
  Fehler-Alert; beide können gleichzeitig sichtbar sein).
- Prüfpunkte: **Initialstand** (Rohwerte aus `pillars` via `weightToRaw`) und **jede
  Slider-Eingabe** ( dieselben Events, die bereits `setSum` feuern: `onInput`/`onChange`).
- Live-Umschlag: Übergang ausgewogen → unausgewogen zeigt den Hinweis, Übergang unausgewogen →
  ausgewogen entfernt ihn — ohne Fokusversatz, ohne Modal, ohne Toast.
- **Nicht blockierend**: Speichern-Button wird durch den Hinweis **nicht** deaktiviert
  (`_disabled` bleibt an `saving || pillars.length === 0 || !distributionValid` gebunden);
  der Speicher-Fluss (normieren → `PUT /pillars/weights`) bleibt unverändert.
- A11y (KI-UX-Block): Screenreader-Ankündigung höflich (kein assertives `_alert`), Bedeutung trägt
  der Text (`_type="warning"` liefert Icon + Farbe).

## Akzeptanzkriterien → Test-Mapping

| AK                                                        | Test                                                                                             |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| AK1 (45/5/20/15/15 → Alert; 5×20 → kein Alert)            | Unit `SettingsPage.test.tsx` + Grenzfälle in `pillar.test.ts` + e2e Anfangszustand               |
| AK2 (live beim Verstellen, beide Richtungen)              | Unit (Slider-`onInput`) + e2e (`press('End')`/alle `End`)                                        |
| AK3 (gespeicherte ungleiche Verteilung, ohne Interaktion) | Unit `SettingsPage.test.tsx` (Initial-Render mit ungleichen `pillars`)                           |
| AK4 (Speichern trotz Hinweis möglich)                     | Unit (`api.setPillarWeights` aufgerufen) + e2e (Speichern → Erfolg)                              |
| AK5 (375px lesbar, kein horizontaler Überlauf)            | e2e mit 375px-Viewport, Bounding-Box-Check (Memory: `scrollWidth` unbrauchbar, App-Shell clippt) |

## Nicht-Ziel

- Keine Änderung an Normierung, Validierung, Speicher-Route oder Slider-Mechanik.
- Keine Blockierung, kein Bestätigungsdialog, keine Pflicht zur Balance.
- Wortlaut von Hinweistext und `-Label` ist Impl-Entscheidung (Tests prüfen Typ/Anwesenheit, nicht
  den konkreten Satz).
