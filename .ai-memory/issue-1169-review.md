# Issue 1169 / PR 1177 — Review (Kreuzverhör Runde 1), Stand 2026-09-02

**ERGEBNIS: VERDICT needs-fixup, Ampel 🟡.** Kein `<!-- ai-review -->`-Marker vorhanden → MODE Kreuzverpfung (Erstreview, ganzer Diff). Review 5094585339 (event COMMENT) mit 2 Inline-Findings gepostet, Sammelkommentar einmalig erstellt. Titel per Title-Gate umbenannt in `feat(frontend): add confetti success feedback on task completion`.

## Erledigt
- Modus bestimmt (Marker-Suche leer), Issue #1169 Harness-Kommentar (KI-ANALYSE + KI-UX) gelesen, vollen Diff (683 Adds, ohne .ai-memory-Skip) kreuzverhört.
- Impl als solide bewertet: `App.tsx:401-405` Trigger nur im `markingDone`-Zweig nach PATCH + `shouldCelebrateDone`; `confetti.ts` reduced-motion-JS-Guard, pointer-events/aria-hidden, Teardown 5 000 ms, rAF + dt-Clamp 32 ms, 120 Partikel, Canvas viewport-skaliert, Rollen-Token-Farben. Unit 7/7, e2e AK1/AK2/AK4/AK6 grün (PR-Body-Belege).
- Findings gepostet (fixbar): F1 e2e AK3 `issue-1169-confetti.spec.ts:137` (API-Done-Task erscheint nie im Aufgaben-Tab — `GET /forest` nur offene, `view=done` = CompletedTasksTable ohne Testid) → Fix UI-Reopen-Pattern `done-toggle.spec.ts:108`. F2 e2e AK5 `:151` (Task B nach `page.goto` erzeugt, kein Polling) → Fix B vor Navigation seeden.
- Titel-Rename + Sammelkommentar (Struktur lt. SKILL, Footer `Review-Typ: Kreuzverhör`).

## Relevante Stellen
- `frontend/e2e/issue-1169-confetti.spec.ts:137,151` — die 2 roten Spec-E2Es (Offene Findings 1+2).
- `frontend/src/lib/confetti.ts` — Modulvertrag erfüllt; mehrfache `launchConfetti()`-Aufrufe erzeugen mehrere Overlays (je Klick einer, je Selbst-Teardown — als kosmetisch NICHT als Finding gewertet).
- `frontend/src/App.tsx:401-405` — Konfetti-Trigger; `completeTask`-Pfad bewusst ohne Konfetti (Abgrenzung Spec).
- `frontend/src/lib/confetti.test.ts` — einzige Nachtrage der Impl: Typ-Fix `querySelector<HTMLElement>` Zeile 73-äquivalent (Spec-Commit lief --no-verify); keine Assertion geändert → Trennung der Pflichten gewahrt.

## Annahmen
- PR-Body-Testbelege (lokal Runner-Sandbox) stimmen; CI-E2e-Ergebnis nicht selbst geprüft (Zeitbudget).
- z-index 500 < UpdatePrompt 1000 laut Code-Kommentar (app.css nicht selbst verifiziert — unkritisch, pointer-events none).
- Keine Entscheidungs-Findings: Fixes verletzen keine Menschen-Entscheidung/ADR (Spec-Tests gegen unhaltbare Präbedingungen sind Pflege, keine Verhandlung).

## Verworfen
- Drittes Finding „Doppel-Overlay bei schnellem Doppel-Done" — je Klick genau ein Regen ist spec-konform, Selbst-Teardown vorhanden; wäre Pseudo-Finding.
- needs-human — beide Funde fixbar, PR-Body liefert selbst die Fix-Vorschläge.
- MEMORY.md-Eintrag — kein neues Fehlermuster (Spec-rot-vs-CI-Thema ist schon über ticket-spec geregelt).

## Offen
- Fixup-Phase: F1 + F2 umsetzen, dann Fixup-Nachweis (MODE FIXUP VERIFICATION: nur Delta + Offene Findings abhaken).

## Nächster Schritt
- Fixup: e2e AK3 auf UI-Reopen-Pattern umbauen, AK5 B vor `goto` seeden; Sammelkommentar dann auf `reviewed` heben, falls Diff-Check sauber.

## Fallstricke
- Fixup-Runde: KEIN neues Kreuzverhör des ganzen PRs — nur Fixup-Diff + Offene Findings 1/2 (Sammelkommentar-`updatedAt` als Diff-Grenze).
- Finding-Nummern stabil: F1=AK3-Test, F2=AK5-Test — nicht umbenennen.
- e2e lokal: `npx playwright test e2e/issue-1169-confetti.spec.ts` im `frontend`-Verzeichnis (Filter-Falle, MEMORY 2026-08-26); Chromium-Install bei frischer Sandbox (MEMORY 2026-08-20).
- AK3-Fixdetail: nach UI-Done läuft schon ein Konfetti — beim Reopen-Assert zählen, nicht Sichtbarkeit prüfen (Overlay vom ersten Toggle kann noch da sein).
