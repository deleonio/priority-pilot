# Issue 1127 — Documenter (Phase 6), Stand 2026-08-30

## Erledigt
- `/tmp/doc.json` geschrieben, `jq .` verifiziert (valid JSON, alle Pflichtfelder vorhanden).
- classification = internal (nur CI-Prompts, kein User-Impact).
- title = leer („chore(ci): consolidate phase prompts per prompt audit (#1127)“ bereits konform, ≤72, Conventional Commits).
- 6 Dateien in `files` (nur .github/prompts/*.md, .ai-memory-Dateien ausgeschlossen).
- 1 Issue: Closes #1127.

## Relevante Stellen
- `.github/prompts/ux.md` — größte Änderung (Feldreferenz + gh-Mechanik + Label-Widerspruch).
- `.github/prompts/triage.md` — größte Netto-Reduktion (−11 Zeilen, gh-Inline → SKILL-Verweis).
- `.github/prompts/fixup.md` — Rang 8 (already-done-Begründungsort).

## Annahmen
- title_compliant = true (per Input) → kein Rename nötig.
- type/scope = docs/k.A. aus Input, aber bestehender Titel verwendet chore(ci) — Titel ist konform, also leer gelassen.

## Verworfen
- .ai-memory-Dateien in `files` aufnehmen — interne Phasen-Notizen, nicht Release-relevant.

## Offen
- -

## Nächster Schritt
- -

## Fallstricke
- -
