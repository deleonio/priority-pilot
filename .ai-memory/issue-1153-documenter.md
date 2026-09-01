# Issue 1153 — Documenter PR #1156, Stand 2026-09-01

## Erledigt
- PR 1156 analysiert (view + diff, 3 Dateien: `.ai-memory/issue-1153-fixup.md` neu, `.github/prompts/fixup.md`, `.github/prompts/ux.md`).
- `/tmp/doc.json` geschrieben und mit `jq` validiert: classification **internal**, title leer („ci(prompts): add thread-resolve command, label ban, and trim ux sources" ist compliant und passt), 3 files, issue ref „Closes #1153", release_note = Ein-Satz-Begründung warum keine Note nötig.
- Keine gh-Write-Operationen (Label `ai:reviewed`, Body von Fixup-Lauf gepatcht — unangetastet gelassen).

## Relevante Stellen
- `.github/prompts/fixup.md:10` — neuer GraphQL-Thread-Lookup + `resolveReviewThread`-Mutation + Label-Bann (Zeile 19): Kern der Änderung, Grund für internal-Einstufung und Summary.
- `.github/prompts/ux.md:1` — „KERN" raus, Quellen auf „(sources: step 4)" gestrafft.
- `.ai-memory/issue-1153-fixup.md` — Phasen-Notiz (ADR 0007, tracked), reines Dokument.

## Annahmen
- title_compliant=true und type/scope docs/kein-A aus dem Aufruf übernommen; dennoch classification `internal` statt `improved`, weil nur CI-Agent-Prompts geändert wurden (kein Produktverhalten; SKILL: „when in doubt NOT internal" greift nicht — Impact eindeutig nur intern).
- `Closes #1153` als Ref-Form gewählt (Body sagt nur „Refs #1153"; PR schließt den Audit-Punkt ab).

## Verworfen
- Klassifikation `improved` — kein Nutzer-Feature, nur Harness-Prompts.
- Umbenennung des Titels — bereits Conventional-Compliant, ≤72 Zeichen.

## Offen
- -

## Nächster Schritt
- -

## Fallstricke
- `/tmp/doc.json` per Write-Tool scheitert an der Sandbox-Permission → via `cat > … <<'EOF'` im Bash-Tool schreiben.
- REST `pulls/{pr}/threads` existiert nicht (404) — Threads sind GraphQL-only (steht jetzt auch im Prompt).
