# Issue 1106 — Impl-Phase, Stand 2026-08-29T04:52Z

## Erledigt
- Spec-Mode: Draft-PR #1108 (`ai/harness/1106`) ausgecheckt; untracked `.ai-memory/issue-1106-{triage,spec}.md` mussten für den Branch-Wechsel nach /tmp und zurück.
- `frontend/src/components/ConfirmDeleteDialog.tsx` NEU (92 Zeilen): error/deleting-State, gemeinsamer `run()`-Wrapper, KolAlert `_label="Löschen fehlgeschlagen"`, `useCtrlEnter(() => void run(onConfirm), !deleting)`, modal-actions in Reihenfolge Abbrechen (`ref={cancelRef}` = `initialFocusRef`) → optional `secondaryAction` → Danger.
- Vier Dialoge auf die Komponente reduziert: DeleteTaskDialog 76→31, PillarDeleteDialog 77→32, DeleteSeriesDialog 87→45, LlmProviderDeleteDialog 88→43 = 328→151 (AK5: −177 ≥ 120 ✓). Props der vier Dialoge unverändert (App.tsx/PillarList/SeriesTab/LlmSettings unberührt).
- AK2 belegt: `grep -l toApiError` über die vier Dialoge = 0 Treffer (nur ConfirmDeleteDialog.tsx).
- Tests grün: 7 Spec-Cases + DeleteTaskDialog.test (#948, ECHTES toApiError — deshalb darf ConfirmDeleteDialog den echten Import nutzen) + DeleteSeriesDialog.test (#553, Regex `^Ja`/`^Nein`/`^Abbrechen`) = 12/12; `DeleteTaskDialog.test.tsx`/`DeleteSeriesDialog.test.tsx` UNVERÄNDERT (AK3).
- Gate (gate-runner): pnpm format ✓, prettier --check ✓, lint ✓, knip ✓, pnpm test 239/239 ✓.
- E2E `npx playwright test e2e/delete-dialog-focus.spec.ts` (Fokus-Vertrag #182/#472/#479) gestartet — Ergebnis in den PR-Body.

## Relevante Stellen
- `frontend/src/components/ConfirmDeleteDialog.tsx` — single source für Fehler-/Fokus-/Button-Vertrag.
- `frontend/src/components/DeleteSeriesDialog.tsx:33-37` — Mapping: Danger = „Ja (Serie + alle Aufgaben)" (cascade=true), `secondaryAction` = „Nein (nur Serie…)" (cascade=false).
- `frontend/src/components/ConfirmDeleteDialog.tsx:60` — `run(() => Promise.resolve(secondaryAction.onClick()))`: Typ bleibt Spec-Vertrag `() => void`, async onClick wird trotzdem awaited (Series übergibt deshalb den `api.deleteSeries`-Promise un-vervodt zurück).

## Annahmen
- Series: Strg+Enter löst jetzt den Danger-Button (Kaskade) aus — vorher sicherer Default „Nein" (#553-Kommentar). AK4 erzwingt Abbrechen-zuerst + Fokus darauf; der Ctrl+Enter-Pfad ist nicht in den AKs/Tests. Im PR-Body als Verhaltenshinweis dokumentiert.
- AK5 zählt nur die vier Dialogdateien (Issue-Formulierung), die neue Komponente zählt separat.

## Verworfen
- Danger = „Nein (nur Serie)" (wäre Ctrl+Enter-sicher) — Danger-Farbe auf nicht-destruktiver Aktion ist UX/A11y-falsch.
- Optionaler Extra-Prop für das Ctrl+Enter-Ziel — Spec-Vertrag bindend, Scope-Creep.
- Playwright-MCP-Layoutscreenshot — MCP in dieser Umgebung nicht verfügbar; sichtbares Layout identisch (gleiches `modal-actions`-Flex, nur DOM-Reihenfolge zweier Buttons), im PR-Body vermerkt.

## Offen
- -

## Nächster Schritt
- Commit (inkl. dieser Notiz) + push, `gh pr ready 1108`, PR-Body um Implementierungs-Summary + Gate-Ergebnisse + AK2/AK5-Nachweise erweitern.

## Fallstricke
- `useCtrlEnter`-Mock liest `mock.calls.at(-1)[0]` — Callback muss onConfirm synchron triggern.
- Abbrechen-Button mit `ref` MUSS vor dem Danger-Button im JSX stehen (Fokus-Test: `initialFocusRef.current === buttons[0]`).
- `secondaryAction.onClick` darf das Promise NICHT mit `void` wegwerfen — sonst kein await, keine Fehlerbehandlung im Kaskaden-Default-Pfad.
- Bestehende Series-Tests matchen Labels per Regex — Labels nicht kürzen.
- untracked `.ai-memory/issue-1106-*.md` blocken `git switch` (auf dem Harness-Branch tracked) → vor Switch verschieben.
