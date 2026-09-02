# Issue 1169 — Spec (Phase 3), Stand 2026-09-02

## Erledigt
- Harness-Kommentar (ID 5515221872) geladen, KI-ANALYSE (AK1–AK6, TF1–TF6) + KI-UX-Block in die Spec-Ableitung einbezogen; kein offener PR vorhanden → Erstlauf der Spec-Phase.
- Branch `ai/harness/1169` ausgecheckt (lokale untracked Phasen-Notizen kollidierten mit den getrackten Branch-Kopien → nach /tmp gesichert, gelöscht, checkout; Branch-Inhalt ist kanonisch).
- Spec `docs/spec/issue-1169.md` neu erstellt: Modul-Vertrag für `frontend/src/lib/confetti.ts` + AK1–AK6 mit Abläufen, Test-Mapping-Tabelle, Abgrenzungen (completeTask-Pfad, DONE_REMOVAL_DELAY_MS, Render-Technik frei).
- Rote Unit-Tests `frontend/src/lib/confetti.test.ts`: Vertrag `shouldCelebrateDone(from, to)` (AK3, matchMedia-unabhängig) + `launchConfetti()` (AK1 return true/Overlay, AK5 aria-hidden + pointer-events:none inline-style, AK2 Fake-Timer-Teardown ≤ 6 s, AK6 reduce → false/kein Overlay). Rot verifiziert: `npx vitest run src/lib/confetti.test.ts` → 1 file failed (unresolved import `./confetti`) = legitimer erster roter Zustand.
- Rote E2E `frontend/e2e/issue-1169-confetti.spec.ts` (6 Tests, Vorlage done-toggle.spec.ts): AK1 Full-Viewport-Bounding-Box, AK2 toBeHidden(6,5 s) + count 0 (DOM-Entfernung), AK3 API-Seed Done→UI-Reopen ohne Overlay, AK5 zweite Aufgabe während Animation bedienbar, AK4 375×667 eigener Testfall (rAF-Begründung im Kommentar), AK6 emulateMedia reduce. Prettier + ESLint über beide Dateien gelaufen (clean).
- Commit `test: red spec tests for #1169` (Spec + beide Test-Dateien + diese Notiz) mit `--no-verify` (Pre-Commit-Knip/tsc failt am noch nicht existierenden Modul — Präzedenz #1130, Memory 2026-09-02/2026-08-30), Draft-PR erstellt.

## Relevante Stellen
- `frontend/src/App.tsx:382-426` — `handleDoneToggle`, `markingDone` :385 = Trigger-Kriterium (markingDone-Zweig :399-411 = Einbauort für die Impl).
- `frontend/e2e/done-toggle.spec.ts` — Vorlage für API-Seed/Popover-Navigation/afterEach-Cleanup; neue Spec nutzt dieselben Locators (`task-list-item-{id}`, `[role="toolbar"]`, „Weitere Aktionen").
- `frontend/src/lib/use-is-mobile.ts:13` — matchMedia-Muster; Unit-Tests stubben `matchMedia` per `vi.stubGlobal` (jsdom liefert keine Preferences).
- `frontend/vitest.config.ts:42` — jsdom-Umgebung bestätigt.

## Annahmen
- Overlay-Vertrag `data-testid="confetti-overlay"` als einziger Kopplungspunkt Spec↔Impl; Technik (Canvas/DOM, Lib/Eigenbau) bewusst nicht getestet.
- `shouldCelebrateDone(from, to)` als reine Funktion (statt App-Integration-Test) — Richtung ist damit isolated und matchMedia-frei prüfbar (TF3-Vorgabe).
- Teardown per setTimeout ≤ 6 000 ms als Unit-verträgliche Konkretisierung von AK2 („4–6 s"); E2E prüft das sichtbare Fenster (6,5 s-Timeout) zusätzlich.
- `page.request.patch` mit `{title, status, priority, estimatedEffort}` setzt den Status ohne UI-Trigger (AK3-Seed); Felder-Menge identisch zum createTask-Seed der Vorlage.
- E2E-rot wurde nicht live ausgeführt (Playwright-Umgebung in der Sandbox nicht aufgesetzt); Rot ergibt sich konstruktiv: `confetti-overlay` existiert nirgends im DOM → jede Ziel-Assertion scheitert.

## Verworfen
- Dedup-Recherche zu bestehenden Konfetti-Tests — `grep -ri confetti frontend/src frontend/e2e` laut Triage leer; done-toggle.spec deckt nur Status-Persistenz, keine Überlappung.
- App-Level-Integrationstest (App.test.tsx) für die Verdrahtung handleDoneToggle→launchConfetti — E2E AK1 deckt den Choke-Point end-to-end ab; Unit + E2E reichen (wenige, aber beißende Tests).
- Frame-Metrik-Assertion für AK4 — in CI nicht zuverlässig messbar (Triage-Fallstrick); architektonische Begründung im Test-Kommentar.
- Untere Grenze „≥ 4 s" in E2E (AK2) — flaky per Konstruktion (nicht-deterministische Frame-Timing); Fenster über Unit-Timeout + 6,5-s-E2E-Obergrenze gesichert.

## Offen
- `.ai-memory/issue-1169-harness-spec.md` ist Wegwerf-Artefakt (lokaler Kommentar-Dump) — NICHT committen; `/tmp/1169-backup/` enthält die vormals untracked gewesenen Phasen-Notizen-Kopien (identisch mit Branch-Stand, kann weg).

## Nächster Schritt
- Impl-Phase: `frontend/src/lib/confetti.ts` nach Modul-Vertrag implementieren, in `handleDoneToggle` (markingDone-Zweig) verdrahten, Overlay-CSS (fixed, inset 0, pointer-events none, z-index unter Popovers) — dann Unit- und E2E-Tests grün schalten.

## Fallstricke
- Pre-Commit-Hook failt am fehlenden Modul → Spec-Commit lief mit `--no-verify` (Begründung im PR-Body); mit existierendem Modul verschwindet die Knip-Meldung.
- jsdom `matchMedia` muss gestubbt sein, sonst rot aus falschem Grund (Stub ist im Test enthalten).
- E2E AK2: die sticky-Zeilen-Entfernung nach `DONE_REMOVAL_DELAY_MS = 5000` lädt neu — Overlay ist App-Level, davon unberührt; nicht koppeln.
- E2E AK3: Status per API seeden (nicht per UI-Klick), sonst läuft das Open→Done-Konfetti vorab und der Test wäre falsch rot.
- Keine Labels setzen — Workflow regelt `ai:needs-impl` selbst.
