## Erledigt
- 2026-08-25 Spec-Phase: `docs/spec/issue-1020.md` angelegt (AK1–AK5 + Messtechnik + Abgrenzung zu #931/#228-AK-6), rote Tests geschrieben, verifiziert rot, Branch `feat/issue-1020-koltable-erledigt` gepusht, Draft-PR erstellt, VERDICT: ready.

## Relevante Stellen
- `frontend/src/components/CompletedTasksTable.test.tsx` — NEU, AK1-Vitest (2 Tests): mockt `KolTableStateful` zu native Test-Tabelle (Muster `TaskTable.test.tsx`), spiegelt `_headers`-Labels/`_label`/`_fixedCols`; Fixture-Säule „Körperliche Gesundheit & Fitness" (33 Z) für Kürzungsnachweis.
- `frontend/e2e/completed-tasks.spec.ts:177` — AK-6 (neu, #1020 AK3+AK4): 375px, Host `.completed-tasks kol-table-stateful`, Kopfzeile sichtbar, native Tabelle count 0, interner Scroller via Shadow-Rekursion (findScroller, overflow-x auto|scroll + scrollWidth>clientWidth), hostRight ≤ 376.
- `frontend/e2e/completed-tasks.spec.ts:281` — #1020-AK2-Describe: kolHeaderGeometry (th im thead via Shadow-Rekursion `collect`), count≥3 (All-Quantor-Schutz), Titel > jede Punkte-Spalte, maxHeightRatio < 2 (einzeilig, lineHeight 'normal' → 1,5×fontSize).
- `frontend/e2e/completed-tasks.spec.ts:343` — AK-307-5: Schluss-Assertion ersetzt (toter body.scrollWidth → hostRight Bounding-Box).
- `frontend/e2e/fixtures.ts:43` — `type Locator` zusätzlich exportiert.
- #931-Geometrie-Block (3 Tests, table-layout fixed/55%/td[data-label]-Styling) ENTFERNT — Dokumentation im PR-Body „Test-Pflege-Bedarf".

## Annahmen
- KoliBri 4.3.0 `KoliBriTableCell` (node_modules …/schema/types/table.d.ts): `label`, `render`, `textAlign`, `width` — KEIN `title`-Prop → Volltext-Tooltip nur UX-Empfehlung in Spec, nicht getestet.
- KolTable-Host-Tag heißt `kol-table-stateful` (aus @public-ui/react-v19 dist index.mjs).
- Nach Umbau bleiben getByRole('row'/'columnheader')-Locators gültig (Playwright pierct offene Shadow-Roots nativ) — AK-1..4/AK-307-3 liefen im Kontrolllauf grün.
- eslint #824-Guard verbietet JEDE `.shadowRoot`-Member-Expression → je Block ein `eslint-disable-next-line no-restricted-syntax` mit Begründung (etabliertes Muster).

## Verworfen
- title-Attribut-Assertion am Header (KoliBri hat kein title-Prop) — stattdessen Spec-Klarstellung.
- `td[data-label]`-count-0 im e2e (KoliBri-Internelements könnten data-label nutzen → Falsch-Rot-Risiko) — stattdessen native `table.completed-tasks-table` count 0 + sichtbare columnheader.
- Eigener AK5-Test — Dedup: unangetastete done-toggle/done-auto-remove + Kontrolllauf decken es.
- #931-Striktheit (Titel ≥2×/45%) beibehalten — KolTable gehört das Layout; nur „breiter als jede Punkte-Spalte".

## Offen
- -

## Nächster Schritt
- Umsetzungs-Phase (4/6): CompletedTasksTable.tsx auf KolTableStateful umbauen (Vorbild TaskTable.tsx:120-173), app.css `.completed-tasks*`-Karten-/Native-Blöcke (1524-1650) bereinigen, obsoleten Kommentar Z. 26-34 entfernen; danach müssen genau die 3 roten e2e + 2 roten Vitest grün werden.

## Fallstricke
- Playwright-Chromium war nicht installiert (`npx playwright install chromium`, ~115 MB) — e2e-Rot-Verifikation schlug zunächst fehl.
- `locator.evaluate` auf fehlendem Element = 30s-Timeout (AK-307-5), nicht sofort rot — für schnelles Rot besser `await expect(locator).toBeVisible()` vor evaluate.
- cwd der Bash-Shell bleibt nach `cd frontend` kleben → absolute Pfade oder `cd` zurück.
- gh/PR-Body per `--body-file` (Klammern/Unicode sonst Bash-Fehler, s. MEMORY 08-24).
- Zeilenausrichtung in Edit-old_string exakt (3 Tabs im #307-Describe!) — sonst „not found".
