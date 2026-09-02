# Issue 1168 — Fixup (PR #1170), Stand 2026-09-02 (Runde 3)

## Erledigt
- Runde 3 (dieser Lauf): ai-review-Kommentar Runde 2 gelesen → 🟢 reviewed, 0 offene Findings, 0 Entscheidungs-Findings; beide Review-Threads (PRRT_…Z6W-, PRRT_…Z6XC) isResolved=true verifiziert → kein Code-Fix nötig. Einziges Problem: `e2e (3)` rot in Run 33637299033 (HEAD 06041ce8). Fehlgeschlagen: `issue-969.spec.ts:86` (Settings-Tab-Padding AK4) — NICHT im PR-Diff (`gh pr diff 1170 --name-only` bestätigt), identischer Code (06041ce8 = 324fe706 + reine .ai-memory-Commits) war in Run 33635957687 komplett grün → FLAKY/unrelated. `gh run rerun 33637299033 --failed` angestoßen, 60 s gewartet, Status in_progress (E2E braucht ~4 min, wurde nicht bis Abschluss abgewartet — nächster Lauf prüft das Ergebnis).
- Runde 1 (Commits a9f1be36/bf1a9426): beide Review-Findings gefixt (Seed-Priorität 5/2, Mock PATCH), Threads aufgelöst — s. alte Notiz unten.
- Runde 2 (dieser Lauf): CI-Auswertung von Run 33604034767 (HEAD 78f2c8e9) — e2e-Shard 2 rot, TF3+TF6, gleiche Spec, aber NEUE Ursachen (per Playwright-Artifact `playwright-report-shard-2`, Error-Context-Snapshots):
  - TF3 `spec.ts:62`: strict-mode violation — ungescopter `getByText` matcht 4 Elemente (Panel-Titel, Top-Task, Aufgabenliste, Wald). Seed-Fix aus Runde 1 WIRKTE (Aufgabe #46 existierte). Fix: Zeile 62 auf `.dashboard-next-task-content` toContainText gescoped, Zeile 66 (AK2 „Dialog nennt Aufgabe") auf `.modal-body` gescoped — NICHT auf `getByRole('dialog')`: der native `<dialog>` steckt im Shadow-DOM des KolDialog-Hosts, sein textContent umfasst geschlottete Light-DOM-Kinder nicht („Aufgabe erledigenSchließen"-Falle, lokal reproduziert).
  - TF6 `spec.ts:128`: Dialog ZEIGTE den Fehler („Erledigen fehlgeschlagen/Serverfehler"), aber `getByRole('alert')` fand nichts — nacktes `KolAlert` exponiert keine alert-Rolle (issue-620-Spec dokumentiert dasselbe). Fix in `CompleteTaskDialog.tsx:57-63`: KolAlert in `<div role="alert">` gewrappt — etabliertes App-Muster (`App.tsx:599,606`), a11y-korrekt (Fehler wird announced), Test unverändert.
- Verifikation: `npx playwright test e2e/issue-1168-dashboard-done-button.spec.ts` im frontend-Verzeichnis → 4/4 grün. Gate: format/lint/prettier grün (gate-runner), knip grün mit `pnpm knip` (root, `--config knip.jsonc`), `pnpm test` exit 0 (492 passed).

## Relevante Stellen
- `frontend/src/components/CompleteTaskDialog.tsx:57-63` — role="alert"-Wrapper um das Fehler-KolAlert (Runde-2-Fix TF6).
- `frontend/e2e/issue-1168-dashboard-done-button.spec.ts:62-71` — gescopte Assertions (Runde-2-Fix TF3).
- `frontend/src/App.tsx:599,606` — Vorbild des role="alert"-Wrappers um KolAlert.
- `frontend/src/components/Modal.tsx:159` — `.modal-body` = Light-DOM-Inhaltshülle des Dialogs (e2e-Anchor für Dialoginhalt).

## Annahmen
- Die knip-Fehlermeldung „Unused exports useGeolocation.ts" beim Gate-Runner war ein Artefakt des falsgen Aufrufs OHNE `--config knip.jsonc` (repo-Eigenheit: Root-skript `pnpm knip` ist die richtige Form); mit Config exit 0. Kein Fix an useGeolocation.ts (themenfremd).
- TF6-Fix als Implementierungs- statt Test-Änderung gewählt, weil AK6 eine Fehlermeldung verlangt, die auch assistiv announced wird — deckt sich mit App.tsx-Muster; ConfirmDeleteDialog.tsx:96 hat denselben nackten KolAlert, wurde aber NICHT angefasst (nicht gemeldetes Finding, Scope-Grenze).

## Verworfen
- `getByRole('dialog', { name: ... }).toContainText(...)` — textContent-Falle s. o., lokal rot.
- Fix an `useGeolocation.ts`-Exports — knip-Artefakt falscher Invocation, mit richtiger Config grün.

## Offen
- -

## Nächster Schritt
- Ausgang des Reruns von Run 33637299033 prüfen: grün → nichts zu tun; erneut rot in issue-969.spec.ts → erneut unrelated/flaky, in ai-fixup-decisions dokumentieren und NICHT in diesem PR fixen (Settings-Padding ist #969-Scope).

## Fallstricke
- Knip IMMER als `pnpm knip` (root) laufen lassen — ohne knip.jsonc kommen phantomhafte „Unused exports".
- Assertions auf Dialog-Inhalt: `.modal-body` nehmen, nicht `getByRole('dialog')` (Shadow-DOM/Slot-Falle).
- Nacktes KolAlert ⇒ keine alert-Rolle im A11y-Baum; e2e-Fehler-Assertions brauchen den role="alert"-Wrapper.

# --- Runde 1 (archiviert) ---
## Erledigt (R1)
- ai-review-Kommentar (Runde 1, 🟡 needs-fixup) gelesen: genau 2 offene Findings, beide fixable, beide vom Autor im PR-Body bereits selbst diagnostiziert.
- Finding #1 (`frontend/e2e/issue-1168-dashboard-done-button.spec.ts:58`, TF3/AK2/AK4/AK5): Seed-Priorität `9` > Server-Limit `max: 5` (`server/src/models/task.ts:113-116`) → `createTask()` scheitert still (kein `response.ok()`-Check im Helper). Fix: erste Aufgabe `9`→`5`, zweite Aufgabe `5`→`2` (Reihenfolge bleibt deterministisch, beide ≤5).
- Finding #2 (`frontend/e2e/issue-1168-dashboard-done-button.spec.ts:114`, TF6/AK6): `page.route`-Mock filterte auf `method() === 'PUT'`, `api.updateTask` sendet aber PATCH (`frontend/src/api.ts:192-193`) → Fehlerfall nie getriggert. Fix: `'PUT'` → `'PATCH'`.
- Beide Edits angewandt, Gate (format/prettier/lint/knip/test) via gate-runner-Subagent grün (alle 5 Befehle exit 0).

## Relevante Stellen (R1)
- `frontend/e2e/issue-1168-dashboard-done-button.spec.ts:58,59,114` — die beiden Fixes.
- `server/src/models/task.ts:113-116` — Prioritäts-Obergrenze `max: 5` (Beleg für Finding #1).
- `frontend/src/api.ts:192-193` — `updateTask` nutzt PATCH (Beleg für Finding #2).

## Annahmen (R1)
- Der `createTask()`-Helper selbst (fehlender `response.ok()`-Check) wird NICHT geändert — das Review-Finding nennt es nur als Ursachenerklärung, der vorgeschlagene Fix betrifft ausschließlich die Prioritätswerte/Mock-Methode (Scope-Grenze: nur gemeldete Findings fixen).

## Verworfen (R1)
- Erweiterung des `createTask()`-Helpers um eine `response.ok()`-Assertion — nicht Teil des gemeldeten Findings, würde über den Scope hinausgehen.

## Offen (R1)
- (erledigt in R2 — CI war auf 78f2c8e9 rot)

## Nächster Schritt (R1)
- (erledigt in R2)

## Fallstricke (R1)
- Threads sind GraphQL-only (REST `pulls/{pr}/threads` existiert nicht) — Thread-IDs vorher per `reviewThreads`-Query holen, nach Pfad+Zeile matchen, nur `isResolved=false`.
