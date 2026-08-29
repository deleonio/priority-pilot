# Issue 1106 — Fixup (Phase 7), Stand 2026-08-29

**AUSGANGSLAGE:** PR #1108 (Branch `ai/harness/1106`), Review-Runde 1 (Review-ID 5056959815) = 3 Findings, alle UNMISSVERSTÄNDLICH mit konkretem Lösungsvorschlag → alle fixen. Kein Decision-Finding → kein `needs-human`. CI vor dem Fix: `verify` ✓, `e2e (2-4)` ✓, `e2e (1)` ✗.

## Erledigt
- Review-Threads geladen: F1 (3885640141, `DeleteSeriesDialog.tsx:35`), F2 (3885640143, `ConfirmDeleteDialog.tsx:77`), F3 (3885640145, `ConfirmDeleteDialog.test.tsx:61`).
- CI-Log (Job 99054596060, Subagent): genau 2 Playwright-Failures, beide `frontend/e2e/delete-dialog-focus.spec.ts` — AK3 (:170) und AK9 (:360), je `toBeFocused failed: Expected focused, Received inactive` auf `Nein`. Kein Flake/Timeout, kein anderes Spec betroffen → REAL, nicht rerun.
- **F1 fix:** `ConfirmDeleteDialog.tsx` neuer Prop `hotkeyTarget?: 'confirm' | 'safeDefault'` (Default `'confirm'`); Kürzel-Ziel: `confirm` → `run(onConfirm)`, `safeDefault` → `run(secondaryAction.onClick)` (ohne secondaryAction wirkungslos). `DeleteSeriesDialog.tsx` setzt `hotkeyTarget="safeDefault"` → Strg+Enter = „Nein" (cascade=false) wie vor #1106 (alter Code: `confirm(false)`).
- **F3 fix:** `ConfirmDeleteDialog.test.tsx` (deleting-Test) assertion `useCtrlEnter.mock.calls.at(-1)?.[1]` === false; `DeleteSeriesDialog.test.tsx` Mock von no-op auf durchreichendes `vi.fn()` umgestellt + neuer Test „Strg+Enter löst den sicheren Default „Nein" (cascade=false) aus, niemals die Kaskade" (pinnt `enabled`=true, Ziel cascade=false, kein einziger cascade=true-Call).
- **F2 fix:** `frontend/e2e/delete-dialog-focus.spec.ts` — AK3 (Titel + :206→Abbrechen fokussiert, :214 Tab→„Nein") und AK9 (Initialfokus Abbrechen, Tab→„Nein") auf den neuen DOM-Vertrag (Abbrechen → Nein → Ja) gestellt; Inline-Kommentare :165-169, Helper-Kommentar („Ja/Nein/Abbrechen statt Endgültig löschen") und Datei-Header Punkt 1 korrigiert.
- Achtung: Review-Finding nannte als Tab-Ziel „Ja (…)" — falsch, DOM-Reihenfolge nach AK4 ist Abbrechen → Nein → Ja; implementiert ist der reale Vertrag (im Thread begründet).

## Relevante Stellen
- `frontend/src/components/ConfirmDeleteDialog.tsx:70-77` — Kürzel-Wiring (`hotkeyAction` + `useCtrlEnter(() => void hotkeyAction?.(), !deleting)`).
- `frontend/src/components/DeleteSeriesDialog.tsx:25-30` — `hotkeyTarget="safeDefault"`, Kommandar-Doku aktualisiert.
- `frontend/src/components/ConfirmDeleteDialog.test.tsx:153-158` — F3a-Assertion.
- `frontend/src/components/DeleteSeriesDialog.test.tsx:46-49,137-160` — F3b Mock + Pinning-Test.
- `frontend/e2e/delete-dialog-focus.spec.ts` — AK3 (:170-217) und AK9 (:360-400).

## Annahmen
- `hotkeyTarget` als Zwei-Werte-Prop statt des im Finding genannten `confirmHotkey?: boolean`: erfüllt F1 UND F3b (Kürzel liegt auf dem sicheren Default statt ersatzlos zu entfallen) — der Finding nannte beide Formen („(oder Strg+Enter auf die sichere secondaryAction binden)").
- E2E-Shard-Zuordnung: nur e2e (1) lief delete-dialog-focus.spec.ts → nach dem Fix muss nur dieser Spec lokal grün sein.

## Verworfen
- `confirmHotkey={false}` (Kürzel ersatzlos deaktiviert im Serien-Dialog) — verwirft das alte #553-Verhalten (sicherer Default per Kürzel) und kollidiert mit F3b.
- E2E-Tab-Ziel „Ja (…)" laut Finding-Text — siehe Erledigt (reale DOM-Reihenfolge).

## Offen
- -

## Nächster Schritt
- GATE (gate-runner: format/prettier/lint/knip/test + `npx playwright test e2e/delete-dialog-focus.spec.ts` im frontend-Dir) → commit+push inkl. dieser Notiz → 3 Threads reply+resolve → Fixup-Nachweis im `<!-- ai-review -->`-Sammelkommentar (5460449424) updaten.

## Fallstricke
- F2-Datei liegt außerhalb des PR-Diffs (kein Inline-Anker) — Fixup-Nachweis am Quelltext prüfen.
- Finding-Nummern F1-F3 stabil halten (nicht umnummerieren).
- Sekundär-Aktion „Nein" behält error/deleting-Handling über `run()` — nicht antasten.
- E2E lokal: `npx playwright test e2e/<datei>.spec.ts` im `frontend`-Dir (`-- <pattern>` filtert nicht).
- KoliBri-Fokus in E2E: SETTLE_MS=150 + shadow-durchdringendes `toBeFocused` beibehalten.
