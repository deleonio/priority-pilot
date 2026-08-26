## Erledigt

- Spec-Phase für #1037 abgeschlossen. Neuer Branch `feat/issue-1037-llm-provider-buttons`
  (kein Draft-Branch vorhanden — `ai/state/issue-1037` enthält nur Trigger-Commits `state: ux`/
  `state: triage`, keine Spec-Arbeit).
- `docs/spec/issue-1037.md` neu angelegt (Format wie `docs/spec/issue-1017.md`).
- `frontend/e2e/issue-1037-llm-action-buttons.spec.ts` neu — 5 Tests (AK1/AK2 mobil, AK3/AK4
  desktop, AK5 dreifach für 320/375/1280px).
- Playwright lokal ausgeführt (`pnpm exec playwright test issue-1037-llm-action-buttons`):
  AK1/AK2 und AK3/AK4 sind ROT wie erwartet (Buttons sind aktuell inhaltsbreit statt
  responsiv). AK5 ist bereits grün (kein Clipping — reiner Regressionsschutz, kein AK-Verstoß).
- Commit `bb49a61e` „test: rote Spec-Tests für 1037", gepusht.
- Draft-PR https://github.com/deleonio/priority-pilot/pull/1038 erstellt, `Closes #1037`
  verifiziert (`closingIssuesReferences` = 1037, `isDraft` = true).

## Relevante Stellen

- `frontend/src/components/LlmSettings.tsx:296-337` — Button „Neuer Provider" (kein Layout-Klasse),
  `.llm-provider-admin__actions` mit Testen/Bearbeiten/Löschen.
- `frontend/src/app.css:1861-1919` — `.llm-provider-admin*`, `.llm-provider-admin__actions` ist
  Flex-Row mit `flex-wrap: wrap`, KEIN `flex-direction: column` mobil → muss für die Umsetzung
  ergänzt werden (Fallstrick unten).
- `frontend/src/app.css:1442-1451` — `.settings-action-btn`, Vorbild-Muster (align-self stretch/
  flex-start, 768px-Breakpoint).
- `frontend/e2e/settings-action-buttons.spec.ts` — Messmuster (Host-BoundingBox, Computed-Style-
  Innenbreite), 1:1 übernommen.
- `server/src/express/routes/llmProviders.ts:46-60` — POST-Body-Felder `name`/`endpoint`/
  `apiKey`/`model` (im Test per `page.request.post` genutzt).

## Annahmen

- `.settings-llm` (SettingsPage.tsx:303, app.css:1774) ist der richtige Referenz-Container für
  Innenbreite/-rand (analog `.settings-general` in #1017).
- Toleranz ±2px für "linksbündig"/"gleiche Zeile" (AK3/AK4 aus dem Issue-Body übernommen, nicht
  selbst gewählt).
- Custom-Provider-Zeile wird per API-Anlage erzeugt (`createCustomProvider`), nicht per UI-Dialog
  — schneller, deterministischer Testaufbau, analog `llm-settings.spec.ts`.

## Verworfen

- `getByRole('button', {name}).locator('xpath=ancestor-or-self::kol-button')` für den Host-Zugriff
  — funktioniert vermutlich, aber `kol-button[_label="..."]` ist das im Repo etablierte Muster
  (SettingsPage.test.tsx) und robuster; daher stattdessen verwendet.

## Offen

- Keine offenen Fragen im PR-Body nötig — alle 6 AK waren testbar, Issue hatte bereits
  „❓ Offene Fragen: Keine.".

## Nächster Schritt

- Umsetzungsphase (`ai:needs-impl`, falls vom Spec-Workflow gesetzt) übernimmt: CSS-Regel für
  `.llm-provider-admin` (Neuer-Provider-Button) und `.llm-provider-admin__actions` (Zeilen-Buttons)
  nach dem `.settings-action-btn`-Muster ergänzen, `align-self`/`flex-direction` je Breakpoint.

## Fallstricke

- `.llm-provider-admin__actions` ist selbst ein Flex-**Container** (row, wrap) — anders als bei
  #1017, wo die Buttons direkte Kinder einer Column sind. Für AK2 (untereinander bei <768px)
  braucht `.llm-provider-admin__actions` zusätzlich `flex-direction: column` mobil, NICHT nur
  `align-self` an den Kindern (das reicht bei #1017, hier nicht).
- `_label` liegt als Attribut auf dem `kol-button`-HOST (nicht im Shadow-DOM) — Selektor
  `kol-button[_label="..."]` funktioniert direkt, kein Shadow-Piercing nötig.
- Playwright-Browser waren im Sandbox-Checkout nicht installiert (`playwright install chromium`
  nötig vor dem ersten Lauf) — falls Folgelauf denselben Container nutzt, ggf. erneut nötig.
