# Issue 1106 — Spec-Phase, Stand 2026-08-29T04:12Z

## Erledigt
- Harness-Branch `ai/harness/1106` ausgecheckt (existierte, Triage-Note drauf); Idempotenz geprüft: kein offener PR zu 1106.
- Ist-Zeilen der vier Dialoge verifiziert: DeleteTaskDialog 76, PillarDeleteDialog 77, DeleteSeriesDialog 87, LlmProviderDeleteDialog 88 = 328 Zeilen (AK5-Basis).
- Spec `docs/spec/issue-1106.md` neu (Vertrag `ConfirmDeleteDialog` inkl. Props-Tabelle, Kapselung, AK1–AK5, Begründung fehlender Tests für AK2/AK5).
- Rote Tests `frontend/src/components/ConfirmDeleteDialog.test.tsx` (neu, 7 Vitest-Cases): Button-Reihenfolge + Initialfokus-Ref, title/fallbackFocusRef-Durchreichung an Modal, Abbrechen→onClose, Erfolg→onDeleted ohne Alert, deleting-Zustand (disabled + Label „Löschen…"), Fehlerfall (toApiError gemockt, Alert-Label „Löschen fehlgeschlagen", deleting-Reset), secondaryAction (3 Buttons), Ctrl+Enter-Callback. Rot bestätigt: `npx vitest run src/components/ConfirmDeleteDialog.test.tsx` → „Failed to resolve import ./ConfirmDeleteDialog" (fehlender Export = legitimer erster roter Zustand).
- Commit + Draft-PR erstellt (siehe PR-Body: gedeckte AKs, Test-Pflege-Bedarf leer, Offene Fragen leer).

## Relevante Stellen
- `frontend/src/components/DeleteTaskDialog.tsx` — Referenz-Skelett: State-Paar error/deleting (:23-24), cancelRef :28, confirm :30-42, useCtrlEnter :45, modal-actions :61-75.
- `frontend/src/components/DeleteSeriesDialog.tsx:34-87` — Kaskaden-Fall mit 3 Buttons; Danger zuerst (:66-71), „Nein (nur Serie…)" fokussiert (:72-79), „Abbrechen" ghost :83 — beim Umbau per `secondaryAction` abbilden, AK4 verlangt Abbrechen zuerst.
- `frontend/src/components/LlmProviderDeleteDialog.tsx:35` — Danger-Button steht dort vorne (Drift, AK4).
- `frontend/src/components/PillarDeleteDialog.tsx:41` — fehlerhaft maskiertes `\"` im Kommentar (AK4-Edit, kein Test).
- `frontend/src/lib/apiError.ts:33` `toApiError` — nach Umbau nur noch in ConfirmDeleteDialog.tsx (AK2, Grep im PR).
- `frontend/src/components/Modal.tsx:34-47` — `initialFocusRef`/`fallbackFocusRef`-Vertrag (Test mockt Modal und captured die Props).
- Bestehende Tests `DeleteTaskDialog.test.tsx` / `DeleteSeriesDialog.test.tsx` — bleiben unverändert (AK3, Dedup: kein neuer Test).

## Annahmen
- Komponenten-Vertrag (Props exakt wie im Analyse-Block) ist verbindlich; Tests adressieren `title`, `body`, `confirmLabel`, `onConfirm`, `onClose`, `onDeleted`, `fallbackFocusRef`, `secondaryAction?`.
- React 19 erlaubt `ref` als normalen Prop an Funktionskomponenten — der KolButton-Mock rendert ihn auf das native `<button>`, damit die Fokus-Assertion (`initialFocusRef.current === Abbrechen-Button`) echtes Zähnen hat.
- `onDeleted` schließt den Dialog implizit über den Aufrufer (wie heute); ConfirmDeleteDialog ruft nur `onDeleted`, nicht `onClose` — so getestet.
- Button-Reihenfolge bei `secondaryAction`: Abbrechen → secondaryAction → Danger (Spec-Entscheidung; Issue schreibt nur „drei Buttons" vor).

## Verworfen
- Test für AK2 (grep toApiError = 0 Treffer) als Testdatei — String-Match ist ein Change-Detector ohne Zähnen (ADR 0001, SKILL-Regel); Grep-Nachweis im PR-Body.
- Test für AK5 (wc -l ≥ 120 reduziert) — metrische Prüfung, kein Anwendungscode-Verhalten; Nachweis im PR-Body.
- Neue Tests für AK3 — durch bestehende DeleteTaskDialog/DeleteSeriesDialog-Tests abgedeckt (Dedup), Änderung an ihnen wäre Scope-Verletzung.
- Playwright-E2E — reines Refactoring, kein neues Nutzer-Verhalten.

## Offen
- -

## Nächster Schritt
- Impl-Phase (Label `ai:needs-impl`): `ConfirmDeleteDialog.tsx` nach `docs/spec/issue-1106.md` bauen, vier Dialoge umstellen, 7 neuen Tests grün machen, AK2-Grep + AK5-wc-l-Nachweis in den PR-Body.

## Fallstricke
- AK3: bestehende Tests NICHT anfassen — sie sind der Beweis, dass das Refactoring verhaltenstreu ist.
- DeleteSeriesDialog nutzt `_variant="ghost"` für Abbrechen, DeleteTaskDialog `"secondary"` — einheitliches Muster wählen, aber der Test asserted nur `variant !== "danger"` für den ersten Button (Absicht: kein Over-Constraining).
- Modal-Mock ohne initialFocusRef-Ausführung: der Fokus-Test prüft den Ref-Vertrag, nicht die DOM-Fokus-Ausführung — die macht das echte Modal (bestehende Tests mocken Modal genauso).
- Ctrl+Enter-Test liest den zuletzt registrierten `useCtrlEnter`-Callback aus dem Mock — beim Umbau `useCtrlEnter(() => void confirm(), !deleting)` beibehalten, sonst fliegt der Test.
- `toApiError` ist im Test gemockt (Analyse-Block AK1 sagt es explizit); der echte 401-Pfad ist bereits von DeleteTaskDialog.test.tsx abgedeckt.
