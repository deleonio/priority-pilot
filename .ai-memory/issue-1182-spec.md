# Issue 1182 — Spec-Phase (rote Tests), Stand 2026-09-02

## Erledigt
- Harness-Kommentar (KI-ANALYSE stand=2026-09-02T23:28:00Z) gelesen; kein KI-UX-Block (rein verhaltensseitig), Ampel 🟢, keine offenen Fragen.
- Branch `ai/harness/1182` ausgecheckt (existierte, Triage-Notiz drauf), Idempotenz geprüft: kein offener PR zu #1182.
- Spec `docs/spec/issue-1182.md` erstellt (AK1–AK4, Dashboard-Pfad-Vertrag auf `completeTask`).
- Rote e2e `frontend/e2e/issue-1182-dashboard-confetti.spec.ts`: AK1 (Overlay sichtbar + count===1), AK3 (reduce → kein Overlay), AK4 (375×667, Bounding-Box im Viewport).
- Rot verifiziert: AK1/AK4 rot an der Ziel-Assertion (`expect(confetti).toBeVisible()` — element(s) not found); AK3 grün als Regression-Guard (kann heute nicht rot sein, hat Zähne gegen reduce-ignorierende Impl).
- Commit + Push + Draft-PR erstellt.

## Relevante Stellen
- `frontend/src/App.tsx` — `completeTask` (hinter `openComplete`): der fehlende `launchConfetti()`-Aufrufort; Muster steht in `handleDoneToggle` (dort #1169-Kommentar, `shouldCelebrateDone` + `launchConfetti` nach erfolgreichem updateTask auf Done).
- `frontend/src/lib/confetti.ts` — Overlay-Vertrag `data-testid="confetti-overlay"`, reduce-Check in `launchConfetti`.
- `frontend/src/components/Dashboard.tsx` (~198-205) — KolButton „Erledigt" im Signal-Panel `dashboard-next-task-content`.
- `frontend/src/components/CompleteTaskDialog.tsx` — Dialog „Aufgabe erledigen", Confirm-Button „Als erledigt markieren", Abbrechen initial fokussiert.
- `frontend/e2e/issue-1168-dashboard-done-button.spec.ts` — Helfer-Muster (openDashboard mit reload, Priorität-5-Seed deterministisch über GET /next).
- `frontend/e2e/issue-1169-confetti.spec.ts` — confetti-Locator + AK3 (Reopen) = AK2-Abdeckung hier.

## Annahmen
- „Genau ein Overlay" (AK1) als count()===1 geprüft — Doppel-Start aus Dialog-/Panel-Pfad wäre die plausible Fehl-Impl.
- AK3 kann im Rot-Zustand nicht rot sein (Feature fehlt → 0 Overlays erfüllt die Assertion); als Guard trotzdem wertvoll, im PR-Body dokumentiert.
- Selbst-Abbau/Teardown nicht erneut getestet — in #1169 (dort AK2) vertraglich gesichert.

## Verworfen
- Eigener AK2-Test (Reopen ohne Konfetti) — Dedup gegen issue-1169-confetti.spec.ts AK3; Dashboard hat keinen Reopen-Pfad.
- Unit-Tests zu confetti.ts — existieren aus #1169 unverändert; Issue ändert nur den Aufrufort in App.tsx.

## Offen
- -

## Nächster Schritt
- Impl-Phase: `completeTask` in App.tsx um `shouldCelebrateDone`/`launchConfetti` erweitern (Muster handleDoneToggle), dann sind AK1/AK4 grün.

## Fallstricke
- Panel-Button mit `getByRole('button', { name: 'Erledigt', exact: true })` adressieren — ohne exact matcht er auch „Als erledigt markieren" (strict-mode violation).
- Neue Sandbox braucht `npx playwright install chromium --with-deps` (MEMORY 2026-08-20); direkter Lauf `npx playwright test e2e/<datei>.spec.ts` im frontend-Verzeichnis (MEMORY 2026-08-26).
- cwd des Bash-Tools persistiert — nach frontend-Wechsel kein zweites `cd frontend`.
- AK4: scrollWidth-Aussage zwecklos (overflow-x: hidden clippt), Bounding-Box prüfen (MEMORY 2026-08-24).
