# PR 1128 — Fixup Runde 1, Stand 2026-08-30

**Finding 1 behoben:** Prettier `--check .` war rot (CI `verify`, Job 99199256565) an 6 PR-Dateien. `pnpm exec prettier --write` auf `docs/spec/issue-{704,948,1077,1080,1095,1098}.md`, danach `--check .` → "All matched files use Prettier code style!" (Diff +30/−30, reine Whitespace/Zeilenbruch-Korrekturen, kein Inhalt geändert).

## Erledigt
- Review-Kontext aus `.ai-memory/issue-1128-review.md` übernommen: genau 1 fixables Finding (Prettier), Inline-Kommentar `docs/spec/issue-704.md:7`, Review 5059824585 (COMMENT).
- Branch `chore/spec-sync-all` (= PR-Head, verifiziert via `gh pr view`) war schon ausgecheckt; `git status` clean bis auf untracked Phasen-Notiz.
- Prettier-Fix angewendet + repo-weites `--check .` als Gate (docs-only PR → lint/knip/test laut Review-Notiz nicht betroffen, Test-Gate entfällt).
- Commit + Push auf `chore/spec-sync-all`, inkl. `.ai-memory/issue-1128-fixup.md` (ADR 0005: Fixup+Implementierung eine Phase; ADR 0007: Notiz getrackt).
- Review-Thread zum Inline-Kommentar via GraphQL `resolveReviewThread` aufgelöst.

## Relevante Stellen
- `docs/spec/issue-704.md` u. 5 weitere Spec-Dateien — Prettier-Zeilenbruch/Listenformat.
- `.ai-memory/issue-1128-review.md` — Review-Runde-1-Notiz mit Findings und CI-Run-ID.

## Annahmen
- Docs-only-PR: restliche Gate-Schritte (lint/knip/tests) von Markdown-Änderungen unberührbar; einziger roter CI-Job war Prettier.
- Keine Entscheidungs-Findings → kein needs-human, kein ai-fixup-decisions-Kommentar nötig.

## Verworfen
- Sammelkommentar `<!-- ai-review -->` ändern — Fixup-Verifikation/abhaken ist Aufgabe der Review-Phase (Workflow 07), nicht des Fixups; Thread-Resolve reicht als Nachweis.
- Voll-ReReview / Delta-Diff — ausdrücklich nicht Teil der Fixup-Phase (SKILL.md step 5: nur gemeldete Findings).

## Offen
- -

## Nächster Schritt
- CI von PR 1128 abwarten (sollte grün); ggf. Re-Review durch Review-Workflow auslösen lassen.

## Fallstricke
- Sammelkommentar nicht neu anlegen (Review-Notiz) — nur PATCHen, falls überhaupt.
- Keine Labels setzen (Workflow macht das).
- „Review ohne Issue"-Zeile im Sammelkommentar für Folgerunden erhalten.
