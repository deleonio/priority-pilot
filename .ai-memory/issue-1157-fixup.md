# Issue 1157 — Fixup (PR #1158), Stand 2026-09-01

## Erledigt
- **ERGEBNIS: 0 Findings, kein Fix nötig; flaky e2e (4) per Rerun grün.** Findings-Lage aufgenommen: ai-review-Kommentar zu PR #1158 = 🟢 **null Findings** („Alle AKs durch grüne Tests abgedeckt, keine Findings"). Inline-Kommentare (`pulls/1158/comments`) = leer, Review-Threads = 0 → kein Fix-Aufwand aus dem Review.
- CI geprüft: `gh pr checks 1158` — verify pass, e2e Shards 1–3 pass, **e2e (4) fail** (Run 33471908740, Job 99743204737).
- Failure analysiert: `e2e/series.spec.ts:552` „AK3 — Bearbeiten + Speichern ohne Änderung erhält die Säulenzuordnung (Round-Trip)" — `expect(after.pillars.length).toBeGreaterThan(0)` bekam 0 (GET /series/:id liefert 200, aber pillars leer; Zeile 600).
- Ursachen-Einordnung **flaky/nicht PR-verursacht**:
  - E2E läuft ohne Auth: `frontend/playwright.config.ts:71` setzt `GOOGLE_CLIENT_ID: ''` → `isAuthActive()` false → `getUserId()` undefined → `ownerScope(undefined) === {}` (`server/src/express/requireAuth.ts:34`) → sämtliche #1157-Änderungen an `server/src/express/routes/series.ts` sind in E2E verhaltenstransparent (nur `where`-Klauseln, die leer bleiben).
  - Der Diff fügt keinerlei Logik hinzu, die Säulen-Beziehungen bei PATCH verändern könnte; Fehlerbild (UI-Round-Trip verliert pillars) ist ein Timing/Pre-existing-Thema außerhalb des Diffs.
- Concurrency-Check vor Rerun (MEMORY 2026-08-23): verify.yml group `ci-1158` cancel-in-progress=true, 04-implement group `claude-implement` — getrennt, kein aktiver ci-1158-Run → `gh run rerun 33471908740 --failed` gefeuert (nur e2e (4) neu), 60s gewartet.

## Relevante Stellen
- `server/src/express/routes/series.ts` — PR-Kern: ownerScope auf GET /series, GET/PATCH/DELETE /:id, POST /:id/generate + `findSeriesWithPillars(id, userId)` (findOne statt findByPk).
- `server/src/express/requireAuth.ts:34` — `ownerScope`: Pass-Through bei undefined userId.
- `frontend/playwright.config.ts:64-71` — E2E-Anti-Auth-Beweis (GOOGLE_CLIENT_ID leer).
- `frontend/e2e/series.spec.ts:552-600` — der flaky AK3-Round-Trip-Test (Umwelt: create via API, UI-PATCH, GET-Vertrag).

## Annahmen
- Rerun wird grün (einmaliger Timing-Fehler); falls der Rerun ERNEUT an derselben Stelle rot ist, ist es real → dann Ursache im Frontend-PATCH-Round-Trip jagen (außerhalb des #1157-Diffs, pre-existing) und im ai-fixup-decisions dokumentieren statt in diesem PR fixen.

## Verworfen
- Fix-Versuch des AK3-Tests — kein Finding des Reviews und durch den PR nicht verursachbar (Auth-off-Beweis); Scope-Verletzung.
- Lokale Reproduktion via Playwright — Sandbox hat kein Chromium installiert (MEMORY 2026-08-20) und CI-Rerun ist der schnellere Beweis.

## Offen
- -

## Nächster Schritt
- Keiner für Fixup: Review 🟢 mit 0 Findings, alle PR-Checks grün (e2e-Rerun Job 99745499042 nach 3m52s pass, 126/127→127 bestanden). Pipeline (gate-merge) übernimmt. Ein eventueller memory-only-Push (diese Notiz, ADR 0007) löst einen erneuten CI-Lauf aus — reiner Memory-Commit, kein Verhalten.

## Fallstricke
- Kein zweiter Rerun hintereinander ohne Ursachenanalyse — zwei identische Roter = real.
- Verify-Rerun testet den ALTEN (Review-HEAD-)SHA; das ist hier korrekt, da kein neuer Push nötig war.
- KEINE Labels anfassen (Workflow-Pflicht im Prompt).
