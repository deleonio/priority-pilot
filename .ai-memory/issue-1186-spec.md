# Issue 1186 — Spec (rote Tests), Stand 2026-09-02

## Erledigt
- Branch `ai/harness/1186` (existierte mit Triage-Commit `ff71d301`) fortgesetzt; kein Draft-PR existierte zuvor (gh pr list leer).
- Spec angelegt: `docs/spec/issue-1186.md` (Ziel/Vorbedingungen/Schritte/Erwartetes Ergebnis AK1–AK3, Testführung, Non-Goals).
- Rote E2E-Tests: `frontend/e2e/issue-1186-popover-focus-outline.spec.ts` — 3 Tests: AK1 Panel-`overflow: visible` per getComputedStyle; AK2 Outline (`outline-style`/`outline-width`) + Clipping-Ancestor-Walk im Popover-Shadow-DOM; AK3 beides bei 375x667 (`test.use`).
- Rot-Verifikation lokal (Chromium headless nachinstalliert): alle 3 Tests rot — AK1/AK3 „Expected visible, Received auto" am Panel; AK2 „Outline wird von kol-popover-button__popover geclippt" (exakt der Ziel-Clipper).
- WICHTIG Befund: Der Toolbar-Inhalt ist SLOTTED (Light-DOM des kol-popover-button), kein DOM-Nachfahre des Panels → Clipping-Walk über parentElement erreicht das Panel NIE. AK2 prüft deshalb zusätzlich das Panel-Overflow explizit per eigenem Locator (Promise.all in `clippingAncestorInPopover(button, panel)`); Walk endet am kol-popover-button-Host.
- Commit + Draft-PR erstellt (Titel = Issue-Titel verbatim, Body mit AK-Liste + „rote Spec-Tests; Implementierung folgt").

## Relevante Stellen
- `frontend/src/lib/popoverAlign.ts:25-45` — Helper greift per `host.shadowRoot.querySelector('.kol-popover-button__popover')` auf das Panel zu; hier muss die Impl `overflow: visible` ergänzen (Impl-PR, nicht Spec-PR).
- `frontend/src/components/TaskTree.tsx:118-201` — `KolPopoverButton _label="Weitere Aktionen"` + `KolToolbar`; einziger Call-Site des Helpers.
- `frontend/e2e/done-toggle.spec.ts:66-81` — Muster für Task-Anlage per API, Aufgaben-Tab, Popover-Öffnen (übernommen).
- `frontend/e2e/issue-761-layout-optimization.spec.ts:203-228` — Muster `locator.focus()` + `toBeFocused` + Outline-Check per getComputedStyle (übernommen; KoliBri zeigt Outline auf :focus).
- `frontend/e2e/issue-930-transparent-backgrounds.spec.ts:346-361` — Stil-Assertions-Vorbild.
- `frontend/src/migration-check.test.ts:36-47` — verbietet `.shadowRoot` in frontend/src-Tests → bewusst E2E statt Unit.

## Annahmen
- `locator.focus()` löst die KoliBri-Outline aus (Präzedenz issue-761 AK6 nutzt exakt dieses Muster erfolgreich).
- Playwright-Locators piercen die offenen Shadow Roots (kol-popover-button → Panel, kol-toolbar → kol-button), daher keine eigenen shadowRoot-Zugriffe im Test nötig (migration-check-konform).
- AK2-Messgröße „an allen vier Kanten sichtbar" ist über „Outline vorhanden + kein clippender Vorfahr bis Panel" operationalisiert (so auch im Analyse-Block des Issues formuliert).
- Clipping-Walk stoppt am Popover-Shadow-Root-Host — App-Shell (`overflow-x: hidden`) liegt außerhalb des Vertrags.

## Verworfen
- Unit-Test mit eigenem shadowRoot-Zugriff — von migration-check.test.ts verboten.
- Bounding-Box-Assertion gegen Viewport als AK2-Kern — App-Shell clippt overflow-x:hidden, wäre aus dem falschen Grund rot; Clipping-Ancestor-Check ist zielgenauer.
- dedup-Check: kein bestehender Test deckt Panel-overflow/Popover-Outline ab (grep `.kol-popover-button__popover` in e2e/src → nur popoverAlign.ts; issue-930/761 prüfen andere Elemente).

## Offen
- -

## Nächster Schritt
- Impl-Phase: `overflow: visible` am Panel in `popoverAlign.ts` ergänzen (Warnhinweis erweitern), Tests grün machen; @public-ui-Pins 4.3.0 unangetastet lassen.

## Fallstricke
- Tests müssen rot sein: heute computed `overflow: auto` am Panel (vom Autor verifiziert) → AK1/AK3 rot; AK2 rot über Clipping-Ancestor (Panel selbst ist der Clipper).
- Panel-Locator auf `kol-popover-button.task-tree-more` innerhalb `task-list-item-{id}` scopen — App hat weitere Popover-Menüs (Avatar).
- `getByRole('button').first()` in der Toolbar = Erledigt-Toggle; Label statusabhängig, deshalb nicht per Name lokatieren.
- E2E-Verifikation einzeln: `cd frontend && npx playwright test e2e/issue-1186-popover-focus-outline.spec.ts` (nicht `pnpm --filter frontend test:e2e --`, filtert nicht — MEMORY 2026-08-26).
- Pre-Commit-Hook: falls knip wegen des neuen Spec-Files blockiert, `--no-verify` mit Begründung im PR-Body (MEMORY 2026-08-30-Muster) — hier nicht nötig gewesen, da keine neuen Importe fehlen.
