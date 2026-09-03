# Issue 1182 — Triage (Phase 1), Stand 2026-09-02T23:28:00Z

**ERGEBNIS: VERDICT spec-ready, Ampel 🟢.** Initial-Triage (kein Harness-Kommentar; einziger Kommentar = github-actions-Qualitätscheck 2026-09-02T23:16:21Z, keine Entscheidungen). Analyse-Block + Routing-Tabelle als Harness-Kommentar erstellt (issuecomment-5517823487), Labels `ai:needs-analyse` entfernt, `ai:analysed` + `ai:needs-spec` gesetzt. Kein Ping-Kommentar, kein Titel-/Body-Edit, kein Split, kein Auto-Close (Anforderung offenbar NICHT implementiert — `completeTask` hat keinen Konfetti-Aufruf).

## Erledigt
- Issue + Trigger geprüft (Initial-Triage), Body analysiert, Code-Recherche per recherche-Subagent (App.tsx, confetti.ts, Dashboard.tsx, CompleteTaskDialog.tsx, Tests, docs/spec/issue-1169.md, #1169 auf main gemergt).
- Eigene Verifikation Dashboard-Reopen-Pfad: `grep onToggleDone|completeTask frontend/src/components/Dashboard.tsx` — Dashboard hat NUR `onCompleteTask` (Zeile 40, 82, 198-205); kein Reopen-Pfad im Dashboard. Reopen läuft ausschließlich über Aufgabenliste-Umschalter (`handleDoneToggle`, App.tsx:383-432, an :695/:709 gebunden).
- Harness-Kommentar-Datei `.ai-memory/issue-1182-harness.md` (Write-Tool, weil Bash-Heredoc mit `{ reducedMotion: 'reduce' }` von der Sandbox als „expansion obfuscation" abgelehnt wurde) → `gh issue comment 1182 --body-file` → Kommentar-ID 5517823487; Labels verifiziert: `ai:needs-spec`, `ai:analysed`.

## Relevante Stellen
- `frontend/src/App.tsx:437-449` — `completeTask`: setzt immer Done, KEIN Konfetti — HIER kommt `shouldCelebrateDone(task.status, TaskStatus.Done)` + `launchConfetti()` rein (AK1).
- `frontend/src/App.tsx:403-405` — das Muster: `if (shouldCelebrateDone(task.status, next)) { launchConfetti(); }` in handleDoneToggle.
- `frontend/src/lib/confetti.ts:40-42` (`shouldCelebrateDone`: from!==Done && to===Done) + `:74-140` (`launchConfetti`, interner prefers-reduced-motion-Check :75) — Regel bleibt zentral, kein Doppel-Check an Call-Sites.
- `frontend/src/components/Dashboard.tsx:198-205` — „Erledigt"-Button → `onCompleteTask` = `openComplete` (App.tsx:637) → Dialog; `frontend/src/components/CompleteTaskDialog.tsx:37-48` `handleConfirm` (await onConfirm → onCompleted) → `completeTask` via App.tsx:815.
- `frontend/e2e/issue-1169-confetti.spec.ts` — Helfer `seedOpenTask`, `confetti()`-Locator, AK3 Reopen, AK4 375×667, AK6 reducedMotion (:181-194) — Vorlage für neue `issue-1182-dashboard-confetti.spec.ts`.
- `frontend/src/lib/confetti.test.ts` — bestehende Unit-Tests (unangetastet lassen); `frontend/e2e/issue-1168-dashboard-done-button.spec.ts` — Panel-Button-e2e-Präzedenz.
- `docs/spec/issue-1169.md:86-89` — Abgrenzungen: Signal-Panel-Pfad bewusst ohne Konfetti; #1182 hebt das auf.

## Annahmen
- „Bewegung reduzieren" (Issue/AK3) = OS-Media-Query prefers-reduced-motion — es existiert KEINE eigene App-Einstellung dazu (SettingsPage.tsx durchsucht, leer); Messgröße 3 des Issues ist darüber abgedeckt.
- Issue-Messgröße 2 („über das Dashboard wieder auf offen") ist als Nicht-Regression des einzigen Reopen-Pfads (Aufgabenliste) zu lesen, da das Dashboard keinen Reopen-Button hat — als AK2 so formuliert.
- UX übersprungen (Routing ux=nein): reine Verdrahtung des existierenden, in #1169 geprüften Overlays, keine neuen UI-Elemente (Präzedenz #1095).

## Verworfen
- Titeländerung — „Konfetti-Feedback auch beim Erledigen über das Dashboard" trifft exakt zu.
- Split — eine Datei + eine e2e-Datei, ein PR.
- MEMORY.md-Eintrag — kein neues Projekt-Learning; Sandbox-Heredoc-Blockade ist Harness-, nicht Projektwissen (und Lösung = Write-Tool ist hier dokumentiert).
- Auto-Close — `completeTask` ohne Konfetti-Aufruf verifiziert, Anforderung nicht erfüllt.

## Offen
- `.ai-memory/issue-1182-harness.md` ist Wegwerf-Artefakt (Kommentar-Quelle) — NICHT committen; nur diese Datei ist die Phasen-Notiz.

## Nächster Schritt
- Spec-Phase (Label `ai:needs-spec` gesetzt): rote Tests für AK1–AK4 in neuer `frontend/e2e/issue-1182-dashboard-confetti.spec.ts` (Muster/Helfer aus issue-1169-confetti.spec.ts übernehmen), dann Draft-PR.

## Fallstricke
- Konfetti-Aufruf in `completeTask` NUR mit `shouldCelebrateDone(task.status, TaskStatus.Done)`-Guard — nicht ungeprüft `launchConfetti()` (sonst feiert Done→Done bzw. künftige Reopen-Nutzung).
- Reduced-Motion NICHT an der Call-Site prüfen — `launchConfetti` macht das selbst (confetti.ts:75); Doppelprüfung = Duplikation der Regel.
- Sticky-Entfernen `DONE_REMOVAL_DELAY_MS` gilt nur für die Aufgabenliste (Kommentar App.tsx:435) — im Dashboard-Pfad KEINE Sticky-Logik nachziehen.
- `handleDoneToggle`/#1169-Verhalten (Liste) und issue-1169-e2e dürfen nicht rot werden (AK2-Regressionsschutz).
- E2E-Overlay-Assertion: Bounding-Box statt scrollWidth (App-Shell overflow-x:hidden, Memory 2026-08-24); Playwright direkt `npx playwright test e2e/<datei>.spec.ts` im frontend-Verzeichnis (Filter-Bug, Memory 2026-08-26).
