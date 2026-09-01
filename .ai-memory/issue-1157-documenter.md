# Issue 1157 — Documenter (PR #1158), Stand 2026-09-01

## Erledigt
- `/tmp/doc.json` geschrieben und per `jq -e` validiert (classification/files≥3/issues≥1/title leer/migration leer → true). Klassifikation **fixed** (Datenisolation-Lücke, nicht `feat/server` des Titel-Gates — Typ des Inhalts zählt), `title` leer (Merge-Titel `fix(server): scope series routes to owner (data isolation) (#1157) (#1158)` ist CC-konform, Review-Notiz Runde 1 dokumentiert die Umbenennung von `[arch-opt] …` bereits).
- inputs gelesen: `gh pr view 1158` (Body mit roten Spec-Tests + Gate-Ergebnissen, Label ai:reviewed, Author app/my-github-action-bot, 8 Files) + `gh pr diff 1158` (Phasen-Notizen, docs/spec/issue-1157.md, series.ts +22/−11, series-dataisolation.test.ts +159).
- `files` NUR aus dem Diff gewählt (3 Einträge: series.ts, series-dataisolation.test.ts, docs/spec/issue-1157.md) — erste Version hatte requireAuth.ts/logics/series.ts als Kontext-Dateien, die im Diff nicht vorkommen; SKILL verlangt „from the diff", daher entfernt (Inhalt in summary/notes gerettet).
- Wegwerf-Zwischendatei `.ai-memory/issue-1157-doc.json` nach /tmp-Kopie wieder `rm`'d (Write-Tool kann nicht nach /tmp — MEMORY 2026-08-26; deshalb repo-interner Umweg + cp).

## Relevante Stellen
- `server/src/express/routes/series.ts` — PR-Kern: ownerScope auf 5 Query-Stellen, `findSeriesWithPillars(id, userId)` via findOne statt findByPk.
- `server/src/express/series-dataisolation.test.ts` — 5 Tests (AK1 Liste, AK2 4× 404 + Positivfälle).
- `docs/spec/issue-1157.md` — Spec.
- `server/src/express/requireAuth.ts:34` — nicht im Diff, aber relevant: `ownerScope(undefined) === {}` = Pass-Through bleibt (in summary erwähnt).

## Annahmen
- Klassifikation `fixed` statt `improved`/`internal`: Sicherheitslücke = Bugfix, SKILL „when in doubt NOT internal" erfüllt; Titel bleibt unverändert (compliant = true vom Calling-Prompt).
- `summary_de`/`note_de` auf Deutsch (SKILL gibt Deutsch für notes vor, summary_en/de explizit).

## Verworfen
- Titel-Vorschlag — vorhandener Titel konform (Flag `title compliant = true`).
- migration_en — kein Breaking Change (API-Vertrag nur gehärtet, 404 für fremde IDs ist Fixes-Verhalten).
- MEMORY.md-Eintrag — kein neuer Fehler (Write-nach-/tmp-Schräglage ist schon unter 2026-08-26 erfasst).

## Offen
- -

## Nächster Schritt
- Keiner — Pipeline-Endphase; /tmp/doc.json liegt bereit.

## Fallstricke
- Write-Tool scheitert auf /tmp (Sandbox aufs Repo beschränkt, MEMORY 2026-08-26) → repo-interne Zwischendatei + `cp`, Datei danach aufräumen, damit sie nicht im nächsten Memory-Commit landet.
- `files` nur Diff-Dateien; Kontext-Dateien (requireAuth.ts) nur in Prosa, nicht als File-Eintrag.
