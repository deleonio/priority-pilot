# Issue 1134 — Fixup (Runde 1), Stand 2026-08-30

**ERGEBNIS:** Beide Findings (F1, F2) aus dem ai-review-Kommentar (ID 5469728520) behoben — 4 funktionale Skip-Guards + alle gelisteten kosmetischen Alt-Referenzen. Keine Entscheidungs-Findings → kein needs-human.

## Erledigt
- F1 (4× funktional): `gh run list --workflow <alter-name>` auf neue `cron.*`-Dateinamen umgestellt in `cron.sync.guide.yml:78` (`claude-guide-sync.yml`→`cron.sync.guide.yml`), `cron.sync.spec.yml:70`, `cron.sync.adr.yml:70`, `cron.audit.prompt.yml:71`.
- F2 (kosmetisch, alle im Review gelisteten Anker): `cron.continue-sweep.yml:11,23,73` + `claude-pr-gate-merge.yml:60` (`claude-pr-gate-sweep.yml`→`cron.pr-gate-sweep.yml`), `06-claude-pr-documenter.yml:371` (`cache-cleanup.yml`→`cron.cache-cleanup.yml`), `cron.cache-cleanup.yml:28` (`codeql.yml`→`cron.codeql.yml`), `cron.architecture-optimization.yml:14` (`claude-continue-sweep.yml`→`cron.continue-sweep.yml`) + `:18` (`test-optimization.yml`→`cron.ci.test-optimization.yml`), `cron.sync.guide.yml:17` (`claude-spec-sync.yml`→`cron.sync.spec.yml`), `.github/scripts/analyze-test-suite.ts:719` (Report-Header auf `cron.ci.test-optimization.yml`). = 10 Zeilen, Review zählte „9“ — alle gelisteten Anker abgearbeitet.
- Gate: `npx prettier --check` auf allen geänderten Dateien ✔, `pnpm lint:actions` (39 Workflows valide) ✔, `pnpm test:scripts` 251 pass / 0 fail ✔.
- Flaky-CI: `e2e (3)` fail an `issue-969.spec.ts` AK4 (Inset-Assertion, thematisch unberührt — PR ändert nur Workflow-Namen/Doku) → `gh run rerun 33320924024 --failed`.
- Verifikations-Grep: keine alten Workflow-Basenames mehr außerhalb `.ai-memory/` (Lookbehind-freie Muster gegen `.github/` + `.github/scripts/`).

## Relevante Stellen
- `.github/workflows/cron.{sync.guide,sync.spec,sync.adr,audit.prompt}.yml` — Skip-Guards (`last_sha`-Dedup); F1-Kern.
- `.github/scripts/analyze-test-suite.ts:719` — Report-Header-String; einzige TS-Änderung.

## Annahmen
- Review-Anker-Zeilen passten 1:1 auf den Branch-Stand (keine Zwischen-Commits seit Review).
- Flaky-Einstufung von `e2e (3)`: Layout-Inset-Test kann durch Workflow-Renames nicht beeinflusst werden.

## Verworfen
- Display-Name statt Dateiname in den Skip-Guards (Review-Alternative) — Dateiname ist die kleinste, review-konforme Änderung.

## Offen
- -

## Nächster Schritt
- Fixup-Verifikation (Runde 2) durch den Review-Workflow; Commit beinhaltet diese Notiz (ADR 0007).

## Fallstricke
- Grep nach alten Namen ohne `cron\.`-Ausschluss matcht `cron.cache-cleanup.yml` als `cache-cleanup.yml` (false positive) — Ausschluss im Muster nötig.
- `.ai-memory/`-Historie bewusst NICHT umgeschrieben (Geschichtsprotokoll).
