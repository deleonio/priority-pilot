# Documenter-Notiz — PR 1081

## Erledigt
- PR 1081 analysiert: `gh pr diff 1081` (87 KB, 21 Dateien), `gh pr view 1081 --json title,body,files,labels,author`.
- Klassifikation: `internal` (CI/Actions/Workflows/Doku, kein Anwendercode).
- Titel: `ci: harness-branch issue storage (ADR 0007) + adr-sync workflow` — konform (Conventional Commits, `ci:` Prefix, 63 Zeichen, ≤72), type/scope chore/k.A. passt → `title` leer gelassen.
- 7 most-relevante Dateien ausgewählt (aus 21 im Diff).
- `issues`: leer — PR-Body enthält kein "Closes #" / "Fixes #".
- `/tmp/doc.json` geschrieben, mit `jq .` verifiziert (valides JSON).

## Relevante Stellen
- `.github/workflows/claude-adr-sync.yml` — neuer Workflow (328 Zeilen), wöchentliche ADR-Konsolidierung.
- `.github/actions/issue-state-save/action.yml` — Kernumbau: Main-Basis statt Orphan, Phase-Notiz-Filter.
- `.github/actions/setup-claude/action.yml` — Memory-Load mit Legacy-Fallback + state.json-Exclude.
- `docs/adr/0007-issue-storage-harness-branch.md` — neues ADR, 128 Zeilen.
- `.gitignore` — issue-*.md/state.json aus Gitignore entfernt.
- `.github/workflows/cache-cleanup.yml` — Sweep über beide Storage-Präfixe.
- `.github/workflows/05-claude-pr-review.yml` — Review-Policy-Änderung (Opus bei PR ohne Issue).

## Annahmen
- Titel-Konformität (true, chore/k.A.) aus dem aufrufenden Prompt korrekt — Titel beginnt mit `ci:`, ist 63 Zeichen, passt zum Typ.
- Keine verlinkten Issues: PR-Body erwähnt ADR 0007/0006 aber schließt kein Issue; `issues` bleibt leer.

## Verworfen
- Titel-Rename — bestehender Titel ist konform und type passt (chore/ci), leer lassen per SKILL.md-Regel.
- `migration_en` — nur für `breaking`, hier `internal`.
- Weitere Dateien in `files` (14 weitere im Diff) — alle niedrigere Relevanz (Prompt-Anpassungen, Workflow-Minor-Edits, AGENTS.md, ADR 0006 Stub-Update).

## Offen
- -

## Nächster Schritt
- - (Documenter-Phase abgeschlossen)

## Fallstricke
- Keine `gh pr edit/comment/label` Aufrufe — SKILL.md verbietet es explizit.
- `title` leer wenn konform + type passt — nicht den Titel wiederholen.
