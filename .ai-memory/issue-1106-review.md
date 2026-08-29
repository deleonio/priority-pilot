# Issue 1106 — Review (Phase 5), Stand 2026-08-29

**ERGEBNIS:** Runde 1 = Kreuzverhör, `needs-fixup` (F1/F2/F3, Review-ID 5056959815, Sammelkommentar 5460449424). Fixup `f71781b8` (05:43Z) → Runde 2 = Fixup-Nachweis, **`reviewed` (🟢)**: alle 3 Findings gegen den Quelltext verifiziert, Sammelkommentar in-place gepatcht (gleiche ID, Review-Typ: Fixup-Nachweis). Keine Entscheidungs-Findings.

## Erledigt
- MODE-Bestimmung: Marker `<!-- ai-review -->` gefunden (issuecomment 5460449424, updatedAt 2026-08-29T04:57:53Z) → Fixup-Verification, Delta-Review nur ab diesem Zeitpunkt.
- Delta = genau 1 Commit: `f71781b8` „fix(frontend): Strg+Enter im Serien-Dialog auf den sicheren Default binden (#1106)" (6 Dateien, +123/−32).
- F1 ✓: `ConfirmDeleteDialog.tsx` Prop `hotkeyTarget?: 'confirm' | 'safeDefault'` (Default `confirm`), `hotkeyAction`-Verzweigung, `DeleteSeriesDialog.tsx` setzt `safeDefault` → Strg+Enter = `run(secondaryAction.onClick)` = „Nein“/`cascade=false`; Kommandar im Dialog aktualisiert.
- F2 ✓: `delete-dialog-focus.spec.ts` AK3 (:166-217) und AK9 (:360-400) auf DOM-Vertrag Abbrechen → Nein → Ja umgestellt (Initialfokus „Abbrechen“, Tab-Ziel „Nein“), Datei-Header + Helper-Kommentare konsistent korrigiert.
- F3 ✓: `ConfirmDeleteDialog.test.tsx:156-158` pinnt `useCtrlEnter.mock.calls.at(-1)?.[1] === false`; `DeleteSeriesDialog.test.tsx` Mock auf durchreichendes `vi.fn()` umgestellt + neuer Test pinnt `enabled=true`, Ziel `cascade=false`, All-Call-Assertion `cascade === false` für jeden Call.
- Title Gate: `refactor(frontend): unify delete dialogs in ConfirmDeleteDialog (#1106)` = gültig (type(scope), englisch, lowercase, ~71 Zeichen) → kein Rename.
- Sammelkommentar 5460449424 per PATCH aktualisiert (Review-Status reviewed, F1-F3 in Behobene-Anmerkungen-Tabelle, Footer Fixup-Nachweis).
- CI auf `f71781b8` war bei Verdict-Abgabe pending (e2e-Shards ~4 min) — nicht rot; finaler Entscheid liegt beim deterministischen Gate-/Auto-Merge-Schritt.

## Relevante Stellen
- `frontend/src/components/ConfirmDeleteDialog.tsx:32` (Prop), `:78-84` (`hotkeyAction` + `useCtrlEnter(() => void hotkeyAction?.(), !deleting)`) — F1-Kern.
- `frontend/src/components/DeleteSeriesDialog.tsx:28` — `hotkeyTarget="safeDefault"` + neuer Kommandar.
- `frontend/src/components/ConfirmDeleteDialog.test.tsx:153-158` — F3a.
- `frontend/src/components/DeleteSeriesDialog.test.tsx:46-49` (Mock), `:143-162` (Kürzel-Ziel-Test) — F3b.
- `frontend/e2e/delete-dialog-focus.spec.ts` — AK3 `:166-217`, AK9 `:360-400` — F2 (Datei liegt außerhalb des ursprünglichen PR-Diffs → kein Inline-Anker möglich).

## Annahmen
- Fixup-Memo (`.ai-memory/issue-1106-fixup.md`) berichtet lokales GATE grün (format/prettier/lint/knip/test + `npx playwright test e2e/delete-dialog-focus.spec.ts` exit 0) — nicht selbst nachgefahren (Sandbox ohne Chromium-Setup, Zeitdeckel).
- `hotkeyTarget` statt des im Finding zuerst genannten `confirmHotkey?: boolean` ist akzeptierte Lösungsform (Finding nannte beide Varianten; im F1-Thread begründet).
- Fokus-Vertragsänderung Serien-Dialog („Nein“ → „Abbrechen“ als Initialfokus) ist durch AK4 gedeckt — Issue #1106 regelt Button-Reihenfolge/Fokus für ALLE vier Dialoge; #553 bleibt nur fürs Kürzel-Ziel bindend.

## Verworfen
- Neue Kreuzverhör-Runde über den ganzen PR — MODE Fixup-Verification verbietet das (SKILL.md Diff-Scoping); nur Fixup-Diff + neue Probleme geprüft.
- Warten auf CI vor dem Verdict — pending ist nicht rot (SKILL: „don't conclude 🟢 while CI is red“); Gate-Schritt degradiert bei Rot selbst auf ai:needs-changes. Zeitdeckel sprach zusätzlich dagegen.
- Statische TDZ-Sorge am `vi.mock`-Factory-Muster (Const-Referenz in Factory) — empirisch durch grünen Lauf widerlegt, nicht als Finding erhoben.

## Offen
- `.ai-memory/issue-1108-review-body.md` ist Wegwerf-Artefakt (Sammelkommentar-Body) — NICHT committen; `rm` brauchte bisher Freigabe (Muster #1083/#1095/#1098/#1106). Nur diese Datei hier ist die echte Phasen-Notiz.

## Nächster Schritt
- `-`: PR #1108 ist review-seitig abgeschlossen (`reviewed`); merge-Entscheidung beim Gate/Menschen.

## Fallstricke
- Finding-Nummern F1-F3 stabil halten — Threads sind resolved und referenzieren sie; Umnummerieren bricht die Historie im Sammelkommentar.
- Sammelkommentar in-place patchen (`PATCH /issues/comments/<id>`), NICHT neu anlegen — genau 1 `<!-- ai-review -->`-Kommentar pro PR.
- `git show <sha>` im lokalen Checkout ist die schnellste Fixup-Diff-Quelle (`gh api .../commits` liefert `files: null` für diesen Commit-Typ) — Repo-Objekte lagen lokal vor.
- E2E-Fokus-Verträge stehen in `delete-dialog-focus.spec.ts` AUSSERHALB des ursprünglichen PR-Diffs → Anker nur am Quelltext/Commit möglich.
