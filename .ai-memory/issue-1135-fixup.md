# Issue 1135 — Fixup (nach Kreuzverhör Runde 1), Stand 2026-08-30T19:20Z

**Scope:** Findings F1–F7 des ai-review-Sammelkommentars (IC_kwDONloM188AAAABRhLroQ). F8 (Docs-Stale) NICHT gefixt — Autor hat den Aufschub auf Folge-PR deklariert, Review selbst stuft F8 als nicht blockierend ein.

## Erledigt
- F1 `.github/workflows/merge-pr.yml` — Allowlist `workflows: ['CI', '5/6 Review']` → `['Verify', '05 Review']` (:53) + jq-Literale `.workflow == "CI"/"5/6 Review"` → `"Verify"/"05 Review"` (:241-252) + Allowlist-Kommentar (:51-52) und Kommentar :235 mitgezogen.
- F2 `.github/workflows/05-review.yml:441-443` — dieselben jq-Literale → `"Verify"/"05 Review"`; Header-Kommentar :3-4 (`claude-pr-gate-merge.yml`/`"5/6 Review"`) mitgezogen.
- F3 `.github/scripts/workflow-name-contract.test.ts` — `REVIEW_FILE='05-review.yml'`, `GATE_FILE='merge-pr.yml'`; Phasen-Schema-Regex `/^(\d)\/(\d)\s/` → `/^(\d\d)\s/` (assert auf `<nn> <Titel>`, lückenlos 0..6 bleibt); Docstring/Kommentare auf neue Namen. Lokal: `node --import tsx --test .github/scripts/workflow-name-contract.test.ts` → **3 pass, 0 fail**.
- F4 `.github/workflows/cron.resume-pipeline.yml:144-147` — PHASES-Dateinamen: `01-claude-triage.yml`→`01-triage.yml`, `02-claude-ux.yml`→`02-design-ux.yml`, `03-claude-spec.yml`→`03-define-spec.yml`, `04-claude-implement.yml`→`04-implement.yml` (2×), `05-claude-pr-review.yml`→`05-review.yml`.
- F5 `.github/workflows/cancel-pr.yml:70` + `label-pr-review.yml:144` — `for wf in 05-claude-pr-review.yml 04-claude-implement.yml` → `05-review.yml 04-implement.yml`.
- F6 `.github/workflows/cron.merge-prs.yml:110` — `gh workflow run claude-pr-gate-merge.yml` → `merge-pr.yml` (merge-pr.yml hat `workflow_dispatch`, Commit-Input `pr` vorhanden → Dispatch-Vertrag intakt).
- F7 Selbst-Referenzen: `cron.sync-adr.yml:70` (`cron.sync.adr.yml`→`cron.sync-adr.yml`), `cron.sync-guide.yml:78`, `cron.sync-spec.yml:70`, `cron.audit-prompts.yml:71` (`cron.audit.prompt.yml`→`cron.audit-prompts.yml`).
- CI: `verify` rot (Kontrakttest) + `e2e (3)` rot — e2e(3) fiel in `issue-969.spec.ts` AK4 (Settings-Insets), thematisch unrelated zu diesem reinen .github-Rename → als FLAKY eingestuft, `gh run rerun 33329068335 --failed` (verify läuft bewusst mit, weil der Fix den Kontrakttest ändert — Ergebnis muss grün sein).

## Relevante Stellen
- `.github/workflows/merge-pr.yml:53,241-252` — Gate-Allowlist + Check-Bucket-Literale (F1).
- `.github/workflows/05-review.yml:441-443` — Review-Gate-Spiegel (F2).
- `.github/scripts/workflow-name-contract.test.ts:34-35,78+` — Kontrakttest, wandert mit (F3).
- Neue `name:`-Felder (maßgeblich): `Verify` (verify.yml), `05 Review` (05-review.yml), `04 Implement`, `01 Triage`, `02 Design UX`, `03 Define Spec`.

## Annahmen
- `gh run list --workflow <dateiname>` und `gh workflow run <dateiname>` lösen über den Dateinamen — für F4-F7 wurden Dateinamen (nicht `name:`-Felder) nachgezogen, konsistent mit der bisherigen Verwendung.
- Docs-Kommentare mit alten Dateinamen (z. B. `detect-pr-conflicts.yml:4-7,136`, `merge-pr.yml:350,421`, `cron.cache-cleanup.yml:4`) sind F8-Klasse (nicht blockierend, Autor hat Aufschub deklariert) und wurden bewusst NICHT angefasst.

## Gate & CI
- **Gate (step 3c, gate-runner):** prettier --check (geänderte Dateien) exit 0; `pnpm lint:actions` exit 0; YAML-Parse aller 10 geänderten Workflows exit 0; `pnpm test:scripts` — erst fail (s. nächster Punkt), nach Fix **251 pass / 0 fail**.
- **Gate-Kollateral (gleiche Klasse wie F3, nicht als eigenes Finding gemeldet):** `.github/scripts/fixup-rounds.test.ts:24` zeigt auf `04-claude-implement.yml` → ENOENT, `pnpm test:scripts` rot. Auf `04-implement.yml` migriert (inkl. Testtitel :160). Ohne diesen Fix wäre der Gate-Push wieder rot gefahren — Fixup-Loop.
- **CI auf eb4c4747 (Run 33331082779):** verify pass, e2e (1)-(4) pass — komplett grün.
**CI-Rerun 33329068335:** e2e (3) → success (FLAKY bestätigt: issue-969 AK4 Settings-Insets, PR berührt kein Frontend); `verify` blieb failure — erwartet, lief auf dem alten Commit ohne Kontrakttest-Fix; entscheidend ist verify auf dem neuen Commit.

## Verworfen
- F8 Docs-Stale fixen — außerhalb des Auftrags („nur gemeldete Findings"), Autor-Deferral + Review-Einstufung nicht blockierend.
- Echo-Zeilen in merge-pr.yml/detect-pr-conflicts.yml (alte Dateinamen) — gleiche F8-Klasse.
- Konkurs-Test-Assertions verschärfen/weiter reißen — nur Migration, keine Vertragserweiterung.

## Offen
- -(Fixup abgeschlossen: Commit eb4c4747 gepusht, CI komplett grün, Threads resolvt)

## Nächster Schritt
- Nächster Lauf ist Fixup-VERIFICATION gegen den `<!-- ai-review -->`-Sammelkommentar: F1-F7 abhaken (alle in eb4c4747), F8 bleibt offen (Autor-Deferral auf Folge-PR).

## Fallstricke
- merge-pr.yml hat im Rename-Diff keine geänderten Zeilen (R100 pure rename) → F1 war nur im Review-Body verankert, nicht inline.
- Der Phasen-Schema-Test akzeptiert jetzt `00..06`-Namen (`NN Titel`); `deepEqual` auf lückenlose 0..n-1 bleibt unangetastet (7 Workflows 00-06).
