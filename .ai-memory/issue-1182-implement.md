# Issue 1182 — Implement (Mach-Phase), Stand 2026-09-02

## Erledigt
- Branch `ai/harness/1182` ausgecheckt (war durch lokale untracked Kopien der identischen Phasen-Notizen blockiert → nach /tmp verschoben, dann Switch; Inhalt per diff IDENTICAL verifiziert). Draft-PR #1185 (closing ref auf #1182) übernommen, Issue zugewiesen.
- Implementierung: `frontend/src/App.tsx` `completeTask` (hinter `openComplete`, jetzt ~:437-455) — nach erfolgreichem `api.updateTask` auf `Done`: `if (shouldCelebrateDone(task.status, TaskStatus.Done)) { launchConfetti(); }`, Muster 1:1 aus `handleDoneToggle` (:403-405). Imports waren vorhanden (App.tsx:42).
- E2E verifiziert: `npx playwright test e2e/issue-1182-dashboard-confetti.spec.ts` → 3 passed (AK1/AK3/AK4 grün). Regression: `issue-1169-confetti.spec.ts` + `issue-1168-dashboard-done-button.spec.ts` → 10 passed.

## Relevante Stellen
- `frontend/src/App.tsx:437-455` — `completeTask`, der einzige Produktions-Code-Change (+4 Zeilen +2 Kommentarzeilen).
- `frontend/src/lib/confetti.ts` — unverändert; `shouldCelebrateDone` :40-42, reduce-Check in `launchConfetti` :75.
- `frontend/e2e/issue-1182-dashboard-confetti.spec.ts` — Spec-Vertrag (nicht geändert), jetzt grün.

## Annahmen
- Gate-Ergebnis s. PR-Body; knip/lint durch gate-runner (SKILL Delegation).

## Verworfen
- Eigene reduce-Prüfung an der Call-Site — `launchConfetti` prüft selbst (Fallstricke der Triage-Notiz).
- Sticky-Logik für Dashboard-Pfad — bewusst nur Aufgabenliste (#1168).

## Offen
- -

## Nächster Schritt
- Gate grün → Commit (inkl. dieser Notiz) + Push + `gh pr ready 1185` + PR-Body erweitern.

## Fallstricke
- `pnpm test` lokal rot an `session.test.ts` (Redis fehlt in Sandbox, MEMORY 2026-08-27/29) → pre-existing, im PR-Body dokumentieren, nicht fixen.
- knip nur via Root-`pnpm knip` (MEMORY 2026-09-02).
