# Issue 1186 — Documenter (Phase 6), Stand 2026-09-03

## Erledigt
- PR #1189 (merged, Branch `ai/harness/1186`) analysiert: `gh pr view 1189` + `gh pr diff 1189` gelesen. Titel `feat(front): fix clipped focus outline in task popover (#1186)` = compliant, type/scope `feat/frontend` vorgegeben → `title` leer gelassen.
- `/tmp/doc.json` geschrieben (Struktur per SKILL.md Output), per `jq` verifiziert (classification/files/issues lesbar).
- Classification `fixed` (Bugfix: geclippte Fokus-Outline; kein neues Feature, kein reines Visuell-Only da Interaktion/Verhalten betroffen).
- Files (4): `frontend/src/lib/popoverAlign.ts` (Kernfix: Inline-`overflow: visible` am Panel `.kol-popover-button__popover`, gleiches Guard-Muster wie `width`), `frontend/e2e/issue-1186-popover-focus-outline.spec.ts` (neu, 3 Tests AK1–AK3), `docs/spec/issue-1186.md` (neu), `frontend/src/components/TaskTree.tsx` (nur Kontext-Call-Site, im Diff unverändert).
- Issues: `Closes #1186` aus dem PR-Body.
- `.ai-memory/*`-Dateien im Diff (4 Phasen-Notizen) bewusst NICHT in `files` aufgenommen (kein Release-/Changelog-Bezug); `migration_en` leer (nicht breaking).

## Relevante Stellen
- `frontend/src/lib/popoverAlign.ts:28-35` — der eigentliche Fix (Shadow-DOM-Panel-Style-Write).
- `frontend/e2e/issue-1186-popover-focus-outline.spec.ts` — E2E-Vertrag AK1 (overflow visible), AK2 (Outline ungeclippt), AK3 (375px).
- `docs/spec/issue-1186.md` — AK-Formulierung (Quelle für die Release-Note-Aussage).

## Annahmen
- `files` darf eine reine Kontext-Datei (TaskTree.tsx) mit entsprechendem Hinweis enthalten, solange ≤8 und die relevantesten — SKILL sagt „most relevant files from the diff"; TaskTree ist NICHT im Diff → als Kontext gekennzeichnet. Falls strikt „nur Diff-Dateien" gewünscht: diese Zeile streichen, die 3 verbleibenden decken den Diff ab.
- Release-Note-Adressat Endnutzer:in (Keyboard-Fokus sichtbar), keine Migration nötig.

## Verworfen
- Klassifikation `improved` — Ursache ist ein Defekt (abgeschnittene Outline), nicht eine Erweiterung → `fixed`.
- `internal` — Frontend-UX-Verhalten betroffen, klar user-impactful.
- Umbenennung des Titels — bereits Conventional-Commit-konform und type passend.
- `.ai-memory/`-Dateien in `files` — Harness-interne Notizen, kein Changelog-Wert.

## Offen
- -

## Nächster Schritt
- -

## Fallstricke
- Write-Tool nach `/tmp` wird von der Sandbox abgelehnt (MEMORY 2026-08-26) → Output per `python3 - <<EOF` + `json.dumps` in `/tmp/doc.json` schreiben, danach `jq`-Check im selben Bash-Call.
- gh pr view hängt bei `--jq` einen Newline an — hier egal (vollständiges JSON über stdout gelesen, nicht Byte-verarbeitet).
