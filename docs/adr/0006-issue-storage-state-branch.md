# ADR 0006 — Issue-Storage: ein State-Branch pro Issue (statt Artefakt und Cache)

- **Status:** Superseded (2026-08-28) durch [ADR 0007](0007-issue-storage-harness-branch.md)
- **Datum:** 2026-08-23

Entschieden wurde, den Issue-Storage statt aus Workflow-Artefakt und Cache in einen eigenen,
nie gemergten Git-Branch `ai/state/issue-{N}` zu legen (orphan-Wurzel, nur Storage-Pfade):
Phasen-Notizen in `.ai-memory/issue-*.md` plus `state.json`, Restore fail-open, Save per
Temp-Index als fetch-then-commit ohne Force-Push, Abbau ausschließlich durch den
Hygiene-Sweep in `cache-cleanup.yml` (Issue geschlossen und letzter Commit älter als 7 Tage),
Vor-Phasen-Kontext in den Prompt eingerendert statt angefragt, jede Phase schreibt ohne
Ausnahme. Ersetzt, weil ADR 0007 den Storage committet im Harness-Branch `ai/harness/{N}`
mit dem PR nach `main` reisen lässt — die Notizen werden damit dauerhaft statt mit dem Branch
verwaist, `state.json` entfällt, der separate Transport entfällt; der Legacy-Fallback für
Bestands-`ai/state/`-Branches läuft weiter über diesen Mechanismus.

Volltext dieser Entscheidung: `git show fbd9265c499687aefba4d43336e04d6bea253c4f:docs/adr/0006-issue-storage-state-branch.md`
