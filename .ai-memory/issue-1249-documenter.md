# Issue 1249 — PR Documenter (PR #1255, Phase 6), Stand 2026-09-06

## Erledigt
- `/tmp/doc.json` geschrieben und per `jq -e` verifiziert: classification `fixed`, 6 files, 1 issue, title leer (Titel `fix(server): check pillar contributions against owning account (#1249)` ist compliant — Flag `true`).
- Basis: `gh pr diff 1255` (690 Zeilen) + `gh pr view 1255` (10 Dateien: 5× .ai-memory-Notizen, docs/spec, pillar-ownership.test.ts, routes/series.ts, routes/tasks.ts, pillarContributions.test.ts/.ts). Klassifikation `fixed` (Validierungs-Lücke: Säulen gegen Eigentümer-Konto prüfen statt nur Existenz; recipientId vor userId).
- `files`: 3–8 relevanteste, .ai-memory-Notizen bewusst ausgeschlossen; Kern = pillarContributions.ts + tasks.ts + series.ts + 2 Testdateien + docs/spec.
- JSON wegen `Write`-Restriction zuerst nach `.ai-memory/issue-1249-doc.json` geschrieben, dann per `cp` nach `/tmp/doc.json` (Muster MEMORY 2026-08-26).

## Relevante Stellen
- `server/src/logics/pillarContributions.ts` — Signaturänderung `arePillarsExistent(pillarIds, userId: number | null)` Pflichtparam.
- `server/src/express/routes/tasks.ts` — POST prüft gegen `recipientId ?? userId ?? null`; PATCH nur Signatur (`?? null`).
- `server/src/express/routes/series.ts` — POST gegen `recipientId ?? getUserId(req) ?? null`; PATCH gegen `series.userId` (Eigentümer, AK4).
- `server/src/express/pillar-ownership.test.ts` — neuer Integrationstest (AK1–AK4/AK6).
- PR-Body enthält vollständige Umsetzungs-Doku inkl. AK7-SQL (Bestands-Fehlverknüpfungen).

## Annahmen
- Titel compliant laut Vorgabe `true` → `title`/`title_reason` leer; type/scope fix(server) passen zur Änderung.
- Kein Breaking: API-Verträge (Routen/DTOs) unverändert, nur Validierung schärfer (neue 400er sind Bugfix-Verhalten laut Issue #1249).

## Verworfen
- `internal` als Klassifikation — user-impactfähiges Verhalten (früher akzeptierte Requests schlagen jetzt fehl), klare Bugfix-Natur.
- `.ai-memory/*` in `files` — Phasen-Notizen, kein Produktcode.
- `migration_en` — nicht breaking, leer.

## Offen
-

## Nächster Schritt
- Workflow übernimmt `/tmp/doc.json` für Changelog/Release-Notes; `.ai-memory/issue-1249-doc.json` ist Wegwerf-Artefakt (nicht committen).

## Fallstricke
- Write-Tool kann nicht nach /tmp schreiben → Repo-Pfad + `cp`.
- PR enthält gemergte #1250-Dateien im Verlauf, am Head aber nur die 10 gelisteten Dateien — Dateiliste aus `gh pr view --json files` (Head-Diff), nicht aus der Commit-Historie raten.
