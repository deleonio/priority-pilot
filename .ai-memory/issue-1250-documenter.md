# Issue 1250 — Documenter (Phase 6), Stand 2026-09-06

**ERGEBNIS:** `/tmp/doc.json` geschrieben + `jq -e .` VALID. Classification `fixed`, `title` leer (bestehender Titel compliant, Review-Phase hatte ihn bereits korrigiert: "fix(server): creator read access ends with group membership (#1250)", 63 Zeichen, conventional, lowercase).

## Erledigt
- SKILL + MEMORY.md gelesen; `gh pr view 1261` (title/body/files/labels/author) → `/tmp/pr1261-view.json`, `gh pr diff 1261` (692 Zeilen) → `/tmp/pr1261.diff`.
- Cross-Check gegen git-Log: Merge-Commit 07bfb0db auf main enthält denselben Titel → Review-Phase-Rename ist gelandet; Titel compliant, kein Rename nötig.
- Diff-Klassifizierung: Produktcode nur tasks.ts + series.ts (Scope-Bindung), Rest Spec-Doc + 4 .ai-memory-Phasen-Notizen + 2 Testdateien → `fixed` (Fehlerkorrektur mit User-Sichtbarkeit), nicht internal.
- files-Liste (5): routes/tasks.ts, routes/series.ts, beide created-by-Testdateien, docs/spec/issue-1250.md (.ai-memory-Notizen bewusst weggelassen — Harness-Artefakte, kein Changelog-Wert).
- issues: "Fixes #1250" aus dem Prompt-Kontext + PR-Body.
- Titel-Compliance-Flag kam als `true` → nur vertraut nach Byte-Gegenprobe (siehe Fallstricke).

## Relevante Stellen
- `server/src/express/routes/tasks.ts:160-200` — loadSharedUserIds + async taskReadScope (Kern des Fixes).
- `server/src/express/routes/series.ts:148-171` — seriesReadScope, Import aus ./tasks.js.
- `server/src/express/{tasks,series}-created-by.test.ts` — AK1-AK7-Abdeckung.
- PR-Body (view-JSON) enthielt vollständige AK/Tests-Matrix — primäre Quelle für summaries ohne eigenen Code-Leselauf.

## Annahmen
- `Op.in: []` → nichts sichtbar (impl-Phase durch AK2-Test grün bestätigt) — für summaries übernommen.
- Titel-Flag `true` stimmt mit tatsächlichem PR-Titel überein (verifiziert, nicht nur vertraut).

## Verworfen
- `new`/`improved` — rein einschränkende Verhaltenskorrektur eines bestehenden Features, kein neuer Umfang.
- `internal` — User-sichtbares Rechteverhalten geändert (when in doubt, NOT internal).
- `.ai-memory/*` und `docs/spec/issue-1250.md` in files — nur 3-8 relevanteste Dateien; Tests + Kerncode + Spec reichen.

## Offen
- -

## Nächster Schritt
- Kein weiterer Schritt: Phase 6 ist die letzte; /tmp/doc.json liegt für den aufrufenden Run bereit.

## Fallstricke
- .ai-memory/*.md sind im Diff — nicht in files übernehmen (Präzedenz: Changelog soll Produktänderungen beschreiben).
- gh pr view/diff Output groß → in /tmp-Dateien schreiben, nicht stdout auswerten (PIPESTATUS-Verlust, MEMORY 2026-08-25).
