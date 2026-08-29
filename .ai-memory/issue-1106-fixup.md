# Issue 1106 — Fixup (Phase 7), Stand 2026-08-29

**ERGEBNIS:** 3/3 Findings der Review-Runde 1 (Review-ID 5056959815) behoben, commit+push **f71781b8** auf `ai/harness/1106`, alle 3 Threads beantwortet + resolved. Kein Decision-Finding → **kein Verdict** (kein `needs-human`, kein `already-done`). Lokales GATE komplett grün; CI auf f71781b8 lief beim Lauf-Ende noch (s. Offen).

## Erledigt
- Review-Threads geladen: F1 (3885640141, `DeleteSeriesDialog.tsx:35`), F2 (3885640143, `ConfirmDeleteDialog.tsx:77`), F3 (3885640145, `ConfirmDeleteDialog.test.tsx:61`).
- CI-Log des roten `e2e (1)` (Job 99054596060, per Subagent): genau 2 Playwright-Failures, beide in `frontend/e2e/delete-dialog-focus.spec.ts` — AK3 (:170) und AK9 (:360), je `toBeFocused failed: Expected focused, Received inactive` auf `Nein`. Kein Flake/Timeout, kein anderes Spec → REAL (kein rerun).
- **F1:** `ConfirmDeleteDialog.tsx` neuer Prop `hotkeyTarget?: 'confirm' | 'safeDefault'` (Default `'confirm'`); Kürzel-Ziel `confirm` → `run(onConfirm)`, `safeDefault` → `run(secondaryAction.onClick)` (ohne secondaryAction wirkungslos). `DeleteSeriesDialog.tsx:28` setzt `hotkeyTarget="safeDefault"` → Strg+Enter = „Nein" (cascade=false) wie vor #1106.
- **F3a:** `ConfirmDeleteDialog.test.tsx` (deleting-Test) pinnt `useCtrlEnter.mock.calls.at(-1)?.[1] === false`.
- **F3b:** `DeleteSeriesDialog.test.tsx:46-49` — Mock von no-op auf durchreichendes `vi.fn()` umgestellt; neuer Test „Strg+Enter löst den sicheren Default „Nein" (cascade=false) aus, niemals die Kaskade" (:143-162, pinnt enabled=true, Ziel cascade=false, kein einziger cascade=true-Call).
- **F2:** `frontend/e2e/delete-dialog-focus.spec.ts` — AK3 (Titel → „Initialfokus auf „Abbrechen"", :206 → Abbrechen fokussiert, :214 → Tab-Ziel „Nein") und AK9 (Initialfokus Abbrechen, Tab → „Nein") auf den neuen DOM-Vertrag (Abbrechen → Nein → Ja) gestellt; Inline-Kommentare :166-170, Helper-Kommentar („Ja/Nein/Abbrechen"-Wording) und Datei-Header Punkt 1 korrigiert.
- GATE via `gate-runner`-Subagent: format / prettier --check / lint / knip / test / `npx playwright test e2e/delete-dialog-focus.spec.ts` — alles Exit 0.
- 3 Thread-Replies gepostet (discussion_r3885730052/-115/-142) und per `resolveReviewThread` resolved (alle `isResolved: true`).
- GraphQL-Details fürs Nachmachen: `addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:ID!, body:String!}){comment{url}}` — Variablen müssen `ID!` (nicht `String!`) sein, Payload hat KEIN Feld `thread`.

## Relevante Stellen
- `frontend/src/components/ConfirmDeleteDialog.tsx:70-77` — Kürzel-Wiring (`hotkeyAction` + `useCtrlEnter(() => void hotkeyAction?.(), !deleting)`).
- `frontend/src/components/DeleteSeriesDialog.tsx:25-30` — `hotkeyTarget="safeDefault"` + aktualisierter Kommandar.
- `frontend/src/components/ConfirmDeleteDialog.test.tsx:153-158` — F3a.
- `frontend/src/components/DeleteSeriesDialog.test.tsx:46-49,141-162` — F3b Mock + Pinning-Test.
- `frontend/e2e/delete-dialog-focus.spec.ts` — AK3 (:166-217) und AK9 (:360-400), reine Test-Anpassung (Produktcode unverändert).

## Annahmen
- `hotkeyTarget` (Zwei-Werte-Prop) statt des im Finding genannten `confirmHotkey?: boolean`: erfüllt F1 UND F3b (Kürzel liegt auf dem sicheren Default statt ersatzlos zu entfallen) — der Finding nannte beide Formen („(oder Strg+Enter auf die sichere secondaryAction binden)"); im F1-Thread begründet.
- Nur e2e-Shard 1 lief delete-dialog-focus.spec.ts → nach dem Fix genügt lokal dieser eine Spec als Nachweis.

## Verworfen
- `confirmHotkey={false}` (Kürzel im Serien-Dialog ersatzlos deaktiviert) — verwirft das alte #553-Verhalten und kollidiert mit F3b.
- E2E-Tab-Ziel „Ja (…)" laut F2-Finding-Text — reale DOM-Reihenfolge nach AK4 ist Abbrechen → Nein → Ja, implementiert ist der echte Vertrag (im F2-Thread transparent gemacht).

## Offen
- CI auf f71781b8 war beim Lauf-Ende noch pending (e2e-Shards brauchen ~4 min); die beiden roten Stellen (AK3/AK9) sind lokal grün. Nächste Runde: `gh pr checks 1108` — falls `e2e (1)` erneut rot, Log lesen (Job-Id über `gh pr checks`), kein Blind-Rerun.
- Fixup-Nachweis im `<!-- ai-review -->`-Sammelkommentar (issuecomment 5460449424) ist NICHT aktualisiert — das macht die Re-Review-Runde (Phase 5/7), nicht der Fixup (Run-Prompt: ai-review-Kommentar unangetastet lassen).

## Nächster Schritt
- Re-Review der Fixup-Runde: 3 Findings gegen f71781b8 prüfen (F1 Prop + Serien-Binding, F2 E2E am Quelltext — Datei liegt außerhalb des alten PR-Diffs, F3 beide Pinning-Assertions) und Sammelkommentar in-place patchen.

## Fallstricke
- F2-Datei (`delete-dialog-focus.spec.ts`) liegt außerhalb des ursprünglichen PR-Diffs → kein Inline-Anker möglich, Nachweis nur am Quelltext.
- Finding-Nummern F1-F3 stabil halten (nicht umnummerieren) — Threads sind resolved, replies referenzieren sie.
- Sekundär-Aktion „Nein" behält error/deleting-Handling über `run()` — beim nächsten Eingriff nicht antasten.
- E2E lokal: `npx playwright test e2e/<datei>.spec.ts` im `frontend`-Dir (`pnpm --filter frontend test:e2e -- <pattern>` filtert nicht).
- KoliBri-Fokus in E2E: SETTLE_MS=150 + shadow-durchdringendes `toBeFocused` beibehalten, kein `document.activeElement`.
- Soft-Deadline war 1787982501 — nach dem Push blieben <3 min; CI-Abwarten bewusst der nächsten Runde überlassen.
