# Issue 1169 — Implement (Phase 4), Stand 2026-09-02

**ERGEBNIS: VERDICT needs-review.** Draft-PR #1177 auf `ai/harness/1169` umgesetzt (spec mode): `confetti.ts` implementiert, in `handleDoneToggle` verdrahtet, Unit-Tests 7/7 grün, E2E 4/6 grün (AK3/AK5 = Test-Pflege-Bedarf, s. u.), Gate komplett grün, PR ready gesetzt + Beschreibung erweitert.

## Erledigt
- Draft-PR #1177 (`ai/harness/1169`) ausgecheckt; untracked Phasen-Notizen waren byte-identisch mit Branch-Kopien → gelöscht (rm), sauberes Checkout.
- `frontend/src/lib/confetti.ts` NEU nach Modul-Vertrag (docs/spec/issue-1169.md): `shouldCelebrateDone(from, to)` rein (`from !== Done && to === Done`); `launchConfetti()` — matchMedia-reduce-Guard → false/kein Overlay (AK6), fixed Full-Viewport-Overlay `data-testid="confetti-overlay"` inline-styled (inset 0, z-index 500, pointer-events none, aria-hidden, overflow hidden, AK1/AK5), Canvas viewportskaliert (dpr≤2), 120 Partikel, rAF-Loop mit dt-Clamp 32 ms + Respawn oben, Teardown-Timeout 5 000 ms entfernt Overlay aus DOM + cancelAnimationFrame (AK2). Farben aus `--pp-status-done/--pp-success/--pp-pillar-*` per getComputedStyle (Fallback #1a7f37).
- `frontend/src/App.tsx`: Import + Trigger im `markingDone`-Zweig von `handleDoneToggle` (nach await api.updateTask, vor Sticky-Logik): `if (shouldCelebrateDone(task.status, next)) launchConfetti();` — 6 eingefügte Zeilen, sonst unberührt.
- `frontend/src/lib/confetti.test.ts:73`: minimale Typ-Korrektur `querySelector<HTMLElement>(…)` (tsc-Error TS2339 `Element.style` — Spec-Commit lief mit --no-verify, tsc sah die Datei nie; KEINE Assert-Änderung, im PR-Body dokumentiert).
- Unit: `npx vitest run src/lib/confetti.test.ts` → 7/7 grün (jsdom-„Not implemented: getContext"-Log ist erwartbar, ctx===null-Zweig im Modul).
- E2E: `npx playwright test e2e/issue-1169-confetti.spec.ts` → 4/6 grün (AK1/AK2/AK4/AK6 ✅). AK3 + AK5 rot — KEINE Impl-Fehler, s. Fallstricke.
- Gate (gate-runner, 2 Läufe): `pnpm format` / `prettier --check` / `lint` / `knip` (nur Config-Hints) / `pnpm test` alle exit 0. `pnpm format` schrieb nichts.
- Commit + Push + `gh pr ready 1177` + PR-Body erweitert (Zusammenfassung, Testergebnisse, Test-Pflege-Bedarf).

## Relevante Stellen
- `frontend/src/lib/confetti.ts` — das neue Modul (Komplettimplementierung, Vertrag aus docs/spec/issue-1169.md).
- `frontend/src/App.tsx:399-405` — Trigger im markingDone-Zweig (Choke-Point beider TaskTree-Mounts); Import bei den anderen lib-Imports (~:41).
- `frontend/e2e/issue-1169-confetti.spec.ts:128,148` — die zwei rot laufenden Spec-Tests (Test-Pflege-Bedarf, s. PR-Body).
- `frontend/src/components/CompletedTasksTable.tsx` — zeigt Done-Aufgaben OHNE `task-list-item-{id}`-Testid und ohne Toolbar-Popover (Beleg für AK3-Unmöglichkeit).
- `frontend/src/App.tsx:688-718` — Aufgaben-Tab: `taskViewMode==='open'` → TaskTree (nur offene Aufgaben), `'done'` → CompletedTasksTable.

## Annahmen
- z-index 500 (unter UpdatePrompt 1000, über Content) erfüllt die KI-UX-Empfehlung „unter Popovers/Toasts"; pointer-events:none macht die Schicht unkritisch (KoliBri-Popover-z-index nicht forensisch geprüft — bewusst).
- Teardown bei exakt 5 000 ms liegt im AK2-Toleranzfenster (4–6 s) und unter der E2E-Obergrenze 6,5 s.
- getComputedStyle liefert in jsdom leere Tokens → Fallback-Palette greift (nur Log-Payload, keine Assertion betroffen).

## Verworfen
- App.tsx-Reload/Polling ändern, damit AK5s per API nachgeladene Aufgabe B in der Liste erscheint — außerhalb des Ticket-Scopes („kein incidentelles Refactoring"); Test-Pflege-Bedarf stattdessen.
- E2E-Tests „reparieren" (AK3/AK5-Seeding anpassen) — Trennung der Pflichten: Spec-Tests sind Vertrag; Bedarf im PR-Body dokumentiert.
- `app.css`-Regel fürs Overlay — Inline-Styles gewählt (KI-UX: „flüchtig und tokenfrei positioniert"; weniger Dateien berührt).
- Animations-Bibliothek — Eigenbau wie von Analyse empfohlen (keine neue Dependency).

## Offen
- AK3/AK5-E2E brauchen Test-Pflege (Vorschläge im PR-Body § Test-Pflege-Bedarf) — Entscheidung liegt beim Menschen/Review, nicht bei der Impl-Phase.
- `.ai-memory/issue-1169-harness-impl.md` ist Wegwerf-Artefakt (Harness-Kommentar-Dump) — NICHT committet.

## Nächster Schritt
- Review-Phase (Workflow setzt `ai:needs-review`): Kreuzverhör des PR #1177; offene Findings in Fixup-Runden abarbeiten.

## Fallstricke
- AK3-E2E ist STRUKTURELL unmöglich: per API auf Done gesetzte Aufgabe erscheint nie im offenen Wald (GET /forest = nur offene); im `view=done`-Tab rendert CompletedTasksTable OHNE `task-list-item-{id}` und OHNE „…"-Popover-Toggle. Präzedenz-Reopen-Pattern: done-toggle.spec.ts:108 (UI-Toggle, Zeile bleibt sticky, Popover offen).
- AK5-E2E ebenso: Aufgabe B wird per API NACH page.goto erzeugt — Liste lädt nicht nach (kein Polling in App.tsx) → Zeile nie sichtbar. Fix wäre: B vor goto erzeugen oder reload.
- Beide rot laufenden Tests NICHT durch Produktiv-Änderungen „grün schalten" wollen — das wäre Scope-Verletzung.
- Der Pre-Commit-Hook (tsc/knip) läuft jetzt grün — kein --no-verify mehr nötig.
- E2E-Run im `frontend`-Verzeichnis direkt `npx playwright test e2e/<datei>.spec.ts` (Filter nach `--` greift nicht, Memory 2026-08-26).
