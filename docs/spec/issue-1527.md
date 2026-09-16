# Spec: Issue #1527 — Ohne KI-Berechtigung keine KI-Bedienelemente, Säulen-Berater eingeschlossen

Quelle: harness marker comment (KI-ANALYSE, stand=2026-09-16T20:12:30Z).

## Ausgangslage

`TaskForm.tsx:1462-1480` rendert die Säulen-Editor-Kopfzeile (`.pillar-editor-head`) mit
Überschrift, `PlanBadge feature="ai_assist"` und dem Button „Säulen vorschlagen" — Badge und
Button sind **nicht** in `aiEnabled &&` gekapselt, anders als der Lektorat-Block
(`TaskForm.tsx:1041-1046`, `aiEnabled = useAiFeaturesGate()`, `TaskForm.tsx:274`). Zusätzlich
stößt der Mount-Effekt `TaskForm.tsx:635-641` (`#305`) beim Anlegen mit vorbelegtem Titel
ungefragt `suggestPillars()` an — auch ohne KI-Gate.

Der Rest des Anlege-Wegs ist bereits gegated (#1335, #1525): `App.tsx:1052-1070` rendert bei
`aiEnabled === false` direkt `TaskFormModal` statt `QuickCaptureModal`. Der Säulen-Berater im
Formular ist der letzte ungegatete KI-Einstieg.

## Erwartetes Verhalten (AK1–AK6)

- **AK1:** Gate aus → `.pillar-editor-head` enthält weder den Button „Säulen vorschlagen" noch
  ein Element mit `data-testid="plan-badge-ai_assist"`.
- **AK2:** Überschrift „Säulen (optional)", Säulen-Regler und deren Entfernen-Buttons bleiben bei
  ausgeschaltetem Gate vorhanden und bedienbar.
- **AK3:** Gate an → Badge und Button erscheinen wie bisher, Klick löst weiterhin
  `POST /tasks/suggest-pillars` aus (`api.suggestPillars`).
- **AK4:** Gate aus → kein Aufruf von `api.suggestPillars`, auch nicht über den Auto-Vorschlag-
  Effekt beim Anlegen mit vorbelegtem Titel (`TaskForm.tsx:635-641`).
- **AK5:** Free-Konto (`pp-ai-enabled='true'`, keine `ai_assist`-Berechtigung, kein Custom-
  Provider) — im gesamten Anlege-Weg kein KI-Bedienelement, kein Request an `/pillars/advisor`,
  `/tasks/parse-text` oder `/tasks/suggest-pillars`.
- **AK6 (375px):** Gate aus → `.pillar-editor-head` enthält auf 375px nur die Überschrift, bleibt
  im Viewport (`x + width <= 375`) und wächst nicht auf eine zweite Zeile.

## Umsetzung (Implementierungsphase, hier nur als Kontrakt)

`TaskForm.tsx:1471-1479`: `PlanBadge` + Button in `aiEnabled && (...)` kapseln, analog zum
Lektorat-Block. `TaskForm.tsx:635-641`: Effekt-Bedingung um `aiEnabled` erweitern.

## Testfälle

- AK1–AK3: Vitest-Unit `TaskForm.test.tsx`, `PlanProvider`-Varianten `allowed: false` /
  `allowed: true`.
- AK4: Vitest-Unit `TaskForm.test.tsx`, `initialValues={{ title: … }}` bei `allowed: false` vs.
  `allowed: true` (Einmal-Garantie aus #305 bleibt erhalten).
- AK5/AK6: Acceptance-e2e `frontend/e2e/ai-disable.spec.ts`, neuer #1527-Block nach dem Muster
  des #1525-Blocks (`POST /auth/test-login` liefert Paket `free`).

## Test-Pflege-Bedarf

`TaskForm.test.tsx:2566-2583` (#1484 AK3) — `renderWithEntitlement(false)` erwartet aktuell
mindestens ein `plan-badge-ai_assist`. Mit dieser Änderung verschwindet das Badge bei
`allowed: false`, weil das Gate dann aus ist. Der Test wird auf `renderWithEntitlement(true)`
umgestellt — #1527 hebt die #1484-Grenzstelle an dieser Stelle bewusst auf (im harness marker
comment als Randbedingung benannt).
