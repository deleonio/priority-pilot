# Spec #1574 — Speichern unausgewogener Säulen-Gewichtungen nur mit Bestätigung

## Ziel

Das Speichern einer stark unausgewogenen Säulen-Verteilung (`PillarWeightsForm`, Karte
„Säulen-Gewichtung", beide Einbindungen: Settings-Tab „Säulen" und `PillarWeightsModal`) fragt
über ein **Bestätigungs-Modal** nach, bevor `PUT /pillars/weights` gesendet wird. Verteilungen,
bei denen nach der Normierung eine Säule **0 % oder 100 %** erhielte, werden **gar nicht**
gespeichert (blockierender Fehler) — das Issue nahm an, das sei bereits abgesichert; im Code ist
es das nicht (Slider erlauben Rohwert 0,0, der Server prüft nur Summe = 100 und `weight ≥ 0`).
Der API-Vertrag und die Server-Route bleiben unverändert (reine Frontend-Änderung).

## Neue reine Funktion `hasExtremeShare` (`frontend/src/lib/pillar.ts`)

```ts
hasExtremeShare(raws: readonly (number | null)[]): boolean
```

- Anteil je Säule: `shareᵢ = rohᵢ / Σroh` (null zählt als 0) — dieselbe Anteilsrechnung wie
  `isDistributionUnbalanced`.
- **Extrem** genau dann, wenn `n ≥ 2` und ein Anteil **≈ 0 %** oder **≈ 100 %** ist
  (Float-Toleranz analog `WEIGHT_SUM_EPSILON`).
- **Ausnahme (AK4):** `n ≤ 1` → `false` — bei genau einer Säule ist 100 % die einzig gültige
  Verteilung und muss speicherbar bleiben.
- Nicht normierbar (Σroh ≤ 0) → `false` — dafür ist der bestehende Summen-Fehlerzustand
  zuständig, kein Doppelmelden.

Beispiele: `[1, 0]` → `true`; `[0.45, 0.05, 0.2, 0.15, 0.15]` → `false` (unausgewogen, aber ohne
Extrem → Confirm-Fall); `[0.6, 0.1, 0.1, 0.1, 0.1]` → `false`; `[0.2, 0.2, 0.2, 0.2, 0]` →
`true`; `[0.4, null]` → `true`; `[1]` → `false`.

## Save-Pfad (`PillarWeightsForm.save()`)

Reihenfolge des Gates — gilt für den Speichern-Button **und** den Strg+Enter-Shortcut (beide
laufen durch `save()`; beide Einbindungen erben):

1. `isRawDistributionValid` verletzt → bisheriger Summen-Fehler (unverändert).
2. **Neu:** `hasExtremeShare` → **blockierender** Fehler (`KolAlert _type="error"` direkt im
   Formular, mit Icon und Text — nicht im Modal, dort gibt es nichts zu bestätigen), **kein PUT**,
   Reglerwerte bleiben unverändert.
3. **Neu:** `isDistributionUnbalanced` → **Bestätigungs-Modal** öffnen statt PUT. Der Formular-
   Strg+Enter-Shortcut darf dabei nicht erneut feuern (kein zweites Modal, kein PUT).
4. Sonst: PUT wie bisher (normierte Gewichte, Summe 100).

## Bestätigungs-Modal (Vertrag)

- Basis `Modal.tsx` (`KolDialog` variants `card`, natives `<dialog>`: `role="dialog"`,
  `aria-modal`, Fokus-Falle); Muster `ConfirmDeleteDialog.tsx`.
- Inhalt: `KolAlert _type="warning"` mit dem #1555-Hinweistext (gleicher Wortlaut wie der
  formularseitige Hinweis). Die non-blocking #1555-Warnung **bleibt zusätzlich** im Formular.
- Buttons: **„Trotzdem speichern"** (primary) und **„Abbrechen"** (secondary); der Label benennt
  die Action (kein generisches OK). Initialfokus auf „Abbrechen" (sichere Wahl), Fokus-Rückgabe
  zum Speichern-Button nach Schließen.
- **Abbrechen** (Button, Esc, Backdrop): Modal schließt (unmount), **kein PUT**, Slider-Werte
  unverändert, erneutes Speichern wieder möglich.
- **Bestätigen**: sendet **genau einen** PUT mit normierten Gewichten und schließt das Modal.
  Strg+Enter **im Modal** bestätigt (konsistent zum ConfirmDeleteDialog-Muster).
- **Keine künstliche Verzögerung** (AK5): der PUT feuert unmittelbar nach dem Klick — kein
  `setTimeout`/keine Wartefrist im Save-Pfad (heute existiert keine, es darf keine hinzukommen).
  Ladezustand am Bestätigen-Button (disabled + Spin) ist erlaubtes Feedback.
- **Mobile (375 px, AK6):** Hinweistext lesbar (unkürzen), Buttons **untereinander in voller
  Breite**, je ≥ 44 px Touch-Höhe mit ≥ 8 px Abstand, kein horizontaler Überlauf
  (Bounding-Box-Prüfung; `scrollWidth` ist unbrauchbar, die App-Shell clippt `overflow-x: hidden`).
- Design-Tokens: `Modal.tsx`-Tokens (`--pp-shadow-overlay`, 200 ms ease-out,
  `prefers-reduced-motion`), Abstände nur `--pp-space-3/4` — keine neuen Hex-Werte.

## Akzeptanzkriterien → Test-Mapping

| AK                                                    | Test                                                                                                 |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| AK1 (Warnung → Modal, kein PUT, auch Strg+Enter)      | Unit `SettingsPage.test.tsx` (#1574-Block, 2 Tests) + e2e Modal-Sichtbarkeit                         |
| AK2 (Bestätigen = 1 PUT normiert; Abbrechen ohne PUT) | Unit `SettingsPage.test.tsx` + e2e `issue-1574-saeulen-confirm.spec.ts` (Route-Counting)             |
| AK3 (ausgewogen → direkt speichern, kein Modal)       | Unit `SettingsPage.test.tsx` (Regression-Guard; e2e-seitig deckt settings-page AK5 den PUT ab)       |
| AK4 (0 %/100 % blockiert; Ausnahme Einzel-Säule)      | Unit `pillar.test.ts` (`hasExtremeShare`) + Unit Form-Test (blockierter Save / Einzel-Säule erlaubt) |
| AK5 (keine Verzögerung im Save-Pfad)                  | Unit: unmittelbare Assertion nach Bestätigungs-Klick (kein waitFor/Timer)                            |
| AK6 (Modal bei 375 px nutzbar)                        | e2e `issue-1574-saeulen-confirm.spec.ts` (Bounding-Box, Buttons gestapelt, ≥ 44 px)                  |
| KI-UX (Strg+Enter im Modal bestätigt)                 | Unit `SettingsPage.test.tsx` (genau 1 PUT, kein zweites Modal)                                       |

## Test-Pflege (bestehende Tests, widersprechen dem neuen Vertrag)

- `SettingsPage.test.tsx` #1555-AK4-Test („trotz Hinweis bleibt Speichern aktiv und ruft
  `api.setPillarWeights` auf"): entfernt — AK1 verlangt vor dem PUT das Bestätigungs-Modal; der
  Fall lebt im #1574-Block (Bestätigen → genau 1 PUT) weiter.
- `frontend/e2e/issue-1555-saeulen-hinweis.spec.ts` AK4 und `frontend/e2e/crud.spec.ts`
  „Säulen-Gewicht ändern": speicherten eine 100 %/0 %-Extremverteilung — seit AK4 blockiert.
  Beide auf die unausgewogene, extremfreie Verteilung `[0.6, 0.1, 0.1, 0.1, 0.1]` (Summe 1.0 →
  Normierung ist die Identität, Round-Trip bleibt deterministisch) + Bestätigung über
  „Trotzdem speichern" umgestellt.

## Nicht-Ziel

- Keine Änderung an Server-Route, API-Vertrag, Normierung oder Slider-Mechanik.
- Die #1555-Warnung im Formular bleibt unverändert non-blocking.
- Wortlaut von Hinweis-/Fehlertexten über den Typ hinaus ist Impl-Entscheidung.
