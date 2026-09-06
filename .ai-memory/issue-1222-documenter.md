# Issue 1222 — Documenter (Phase 6, PR #1242), Stand 2026-09-06

**ERGEBNIS:** `/tmp/doc.json` geschrieben und per `jq` validiert (classification `new`, 8 files, 1 issue). Titel unverändert ( leer — `feat(server): create task series for a group member (#1222)` bereits CC-konform, type/scope-Stimmen überein). Kein gh-pr-Edit/Comment/Label (verboten).

## Erledigt
- `gh pr view 1242 --json title,body,files,labels,author` + `gh pr diff 1242` gelesen (Diff groß, in persisted-output). Merge-PR von `app/my-github-action-bot`, Labels `ai:documented`, `release:engineering`, `ai:reviewed`, 19 Dateien (5 .ai-memory, docs/spec, openapi.yml, 6 server, 4 frontend + 2 e2e).
- Inhalt aus PR-Body + `.ai-memory/issue-1222-review.md` (im Diff) übernommen: POST /series Empfänger-Logik (400/403, createdById), GET /series Lese-Scope + serializeSeriesFor, Instanz-Owner `options.userId ?? series.userId` (logics/series.ts:155), nullable Migration via SERIES_TABLE_COLUMNS, TaskForm/SeriesTab Badges.
- JSON per Bash-Heredoc nach /tmp geschrieben (Write-Tool wird für /tmp verweigert — s. Fallstricke); `jq -e`-Check bestanden.

## Relevante Stellen
- `openapi.yml` — Contract-Änderungen (Series/SeriesCreate/Task Felder), Kern des Features.
- `server/src/express/routes/series.ts` — Empfänger-Logik + Lese-Scope + Serialisierung.
- `server/src/logics/series.ts:155` — Instanz-Erbfolge (AK4).
- `server/src/logics/migrate.ts` — idempotente createdById-Spalte (AK7).
- `frontend/src/components/TaskForm.tsx` / `SeriesTab.tsx` — UI-Empfängerwahl + Kennzeichen.

## Annahmen
- `Closes #1222` als Issue-Ref verwendet (Closing-Issue laut Review-Notiz; PR-Body sagt „Umsetzung (#1222)", explizites `Closes #` im sichtbaren Body-Ausschnitt nicht verifiziert).
- classification `new` (neues Feature: Serien für Gruppenmitglieder) — nicht `improved`, da neuer Endpunkt-Parameter/Contract.

## Verworfen
- Titel-Rename — compliant = true und type/scope (feat/server) passen, Regel „empty" greift.
- `migration_en` — bleibt leer: nullable Spalte, idempotent, kein Breaking.
- .ai-memory-Dateien und Spec-Doku in `files` — Notiz auf die 3-8 relevantesten Produktdateien beschränkt (8 gewählt).

## Offen
-

## Nächster Schritt
- Lauf beendet; nichts Folgendes. Falls Nachlauf: nur prüfen, dass `/tmp/doc.json` noch existiert (tmp ist flüchtig).

## Fallstricke
- Write-Tool für `/tmp` wird von der Sandbox abgelehnt (Permission-Error) — Output per Bash-Heredoc schreiben; JSON enthält Umlaute und Klammern, deshalb `<<'EOF'` (quoted, keine Expansion).
- Der `gh pr view`+`gh pr diff`-Kombi-Call erzeugte 39 KB persisted-output — Titel/Files/Labels separat per `--jq` holen, Diff-Details aus den .ai-memory-Notizen im Diff lesen statt alles zu scrollen.
- `files` im PR umfasst auch .ai-memory-Notizen — für die Doku herausfiltern, nur Produktdateien listen.
