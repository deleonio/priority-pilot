# Issue 1225 — Review (PR #1245), Stand 2026-09-06T02:17Z (FINAL — needs-fixup)

**ERGEBNIS: needs-fixup, 2 Blocker offen.** Sammelkommentar (Marker `<!-- ai-review -->`,
ID 5555806946, PATCH 02:16:36Z) finalisiert: Finding #2 vom „vorläufig/flake?“ zum
**bestätigten Regression-Mechanismus** hochgestuft, Review-Typ Kreuzverhör. Zusätzlich
Inline-Review 5123815540 (Finding #2 anchored `GroupDetail.tsx:134`); bestehendes Inline-
Finding #1 (Review 5123564217) unverändert gültig. Verdict als `/tmp/claude-verdict`
(`needs-fixup`) + Output-Zeile emittiert.

## Erledigt
- MODE laut Anweisung: Marker vorhanden → Fixup-Verifikation; real aber **kein Fixup**:
  alle 3 Fixup-Commits (6b71b7a9, 8cf812db, 8b3159ee) sind leer (memory-only, Läufe
  crashten — Bot-Kommentare „Claude-Schritt failure (Crash)“, Stop-Guard 11>10 Commits,
  Runden-Deckel 01:54:47Z), kein `ai-fixup-decisions`-Kommentar → keine Claim-Checkliste,
  beide Findings bleiben offen (SKILL: findings without claim row stay open).
- Finding #2 aufgedröselt über CI-Artefakte: `gh api actions/runs/<id>/artifacts` →
  `playwright-report-shard-1` (ID 9980743260) → zip → `test-results/*/error-context.md`
  (= Playwright-Page-Snapshot). Beide Fehlcases (AK7 `groups-for-each-other.spec.ts:132`,
  AK8 `:192`) zeigen identisch: Mitgliederliste nur [Admin], Einladung „Ausstehend“,
  Aufgaben-EMPTY-Hint, **plus 409-Alert „Die Gruppe braucht mindestens einen Administrator“**.
- Mechanismus bewiesen (siehe Fallstricke): Detailkopf (~56 px, `GroupDetail.tsx:134`) ver-
  schiebt die Kartenmitte auf den Demote-Button → `handleRoleChange` → 409 (Guard
  `groups.ts:479`, nur diese Quelle produziert den Text) → `catch` setzt nur `setError`,
  KEIN `load()` → Detail bleibt Altstand (vom Einlade-Zeitpunkt) → Aufgabe erscheint nie.
- Baseline verifiziert: letzte 3 Main-CI-Läufe `success` → #1223-Tests auf main grün.
- Finding #1 gegen aktuellen Stand re-geprüft: `GroupDetail.test.tsx` im Diff NICHT
  enthalten; neue e2e (`groups.spec.ts` Diff :318-365) prüft nur `card.locator('kol-avatar')`
  (Liste), Detail nie aufgeklappt → Blocker hält.
- e2e/playwright.config.ts geprüft (`fullyParallel:false, workers:1, retries:0`) →
  keine Cross-Test-Interferenz als Alternative.
- Titel-Gate: `feat(groups): add group image via https url (#1225)` konform (52 Z., CC ok).

## Relevante Stellen
- `frontend/src/components/GroupDetail.tsx:109` (`handleRoleChange`, 409-catch ohne reload),
  `:134` (`.group-detail-head` — Verursacher des Layout-Shifts) — Fixziele für Finding #2.
- `frontend/src/components/GroupsSection.tsx:169-178` — li-onClick-Refresh-Vertrag (#1223);
  Guards für kol-button existieren, aber der Test-Klick trifft den Button selbst (legal).
- `frontend/e2e/groups-for-each-other.spec.ts:127,183` — `listitem.click()` (Mitte) = die
  fragile Stelle; Umbau auf neutrale Refresh-Zone (`.group-tasks`/`.group-detail-head`).
- `frontend/src/components/GroupDetail.tsx:123` — Fehler-Alert-Renderpffad (setError-Quellen).

## Annahmen
- Geometrie-Behauptung (Mitte trifft Demote-Button) ist aus Snapshot + Alert-Text +
  Determinismus (2/2 Läufe, workers:1) geschlossen — nicht lokal nachgestellt (keine
  node_modules/Browser in der Sandbox, Vorlauf-Entscheid 1. Lauf).
- „Empfängerin fehlt/Ausstehend“ im Snapshot ist der Altstand VOR accept (kein Reload nach
  409), kein Server-Bug bei invitations/accept — Server-Diff ist isoliert sauber
  (imageUrl-Validierung, 403/404-Split, Migration; tasks-Query unberührt).

## Verworfen
- Flake-Theorie endgültig — 2/2 Läufe identisch, retries:0, main grün.
- Server-seitige Ursache (Migration/accept/Task-Query) — Diff berührt nichts davon;
  createForeignTaskViaApi beweist Mitgliedschaft zum Erzeugungszeitpunkt (assert 201).
- needs-human/Entscheidungs-Finding — Fix ist mechanisch (reload im Fehlerpfad +
  Test-Klick-Ziel), kein Produktentscheid nötig.
- Shard-3/4-Rots (issue-843 Spacing, issue-865 console, settings-switch-layout) als
  Finding — andere Fehlerklasse, im Vorlauf-Lauf grün, Infrastruktur-Noise-Signatur;
  nicht Diff-attribuierbar.

## Offen
- `ai-fixup-decisions` existiert nicht → kein Fixup-Nachweis möglich; Finding-Nummern
  #1/#2 bleiben stabil für den Fixup-Lauf.
- Review-Job des letzten CI-Runs (34005162971) `pending` — lautet auf denselben Diff;
  ändert nichts am Verdict (needs-fixup ohnehin).
- Wegwerf-Artefakte untracked in `.ai-memory/`: `issue-1225-review-finding2.md`,
  `issue-1225-review-collected.md` (Body-Staging) — NICHT committen.

## Nächster Schritt
- Fixup-Phase (nach Mensch/Label): Finding #1 (Detail-Avatar-Test: e2e Detail aufklappen
  mit `.group-detail-head`/`kol-avatar`-Assertion oder Vitest mit `group`-Prop) +
  Finding #2 (a) `load()` im 409-Fehlerpfad, (b) beide #1223-Tests auf neutrale
  Refresh-Zone umstellen, Testpflege im PR-Body dokumentieren. Nits optional mitnehmen.

## Fallstricke
- Playwright-Fehldiagnose steht in den CI-**Artefakten**, nicht im Log: 
  `gh run view --log-failed` liefert nur Assertion+Codezeile; die Page-Snapshots
  (`error-context.md`) liegen in `playwright-report-shard-N` → via
  `actions/runs/<id>/artifacts` + zip holen (404 auf `jobs/<id>/artifacts` — Run-Level
  abfragen!). Das war der Schlüssel zur Mechanismus-Findung.
- „Detail-Alert“ im Snapshot = `setError`-Zustand des Details, NICHT session-/seiteweit;
  409-Text „letzter Admin“ kommt NUR aus `handleRoleChange`/`handleRemove` — das
  identifiziert den unbefugten Klick ohne lokalen Repro.
- Karten-Mittelklick-Tests (`listitem.click()` auf geöffneter Karte) sind layoutfragil:
  jede Höhenänderung des Details verschiebt die Mitte auf ein anderes Element — neue
  Detail-Blöcke immer auf dieses Muster prüfen (Finding #2 exakt dieses Muster).
- `gh api pulls/1245/comments --input` akzeptierte `line`/`subject_type` hier NICHT
  (422 „not a permitted key“) — Inline-Kommentar stattdessen über
  `POST pulls/1245/reviews` mit `comments[]` gepostet (hat funktioniert, zweites Mal).
