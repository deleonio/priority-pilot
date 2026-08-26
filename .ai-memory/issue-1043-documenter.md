# PR 1043 — Documenter (Review-Tier, Phase 6)

## Erledigt

- PR 1043 analysiert (gemergt): Titel bereits konform (`ci(image-strip): add backfill for historical issues and prs`), Classification = `internal` (reine CI/Infrastruktur ohne Endnutzer-Impact).
- Vollständigen Diff gelesen (4 Dateien, +188/-25): `.github/scripts/image-strip-backfill.sh` (neu, 152 Z.),
  `.github/scripts/pr-image-strip.sh` (`--issue`-Modus, Failure-Zähler, exponentieller Retry),
  `.github/scripts/strip-images.test.ts` (+175 Tests für `--issue`-Modus und Backfill-Failure-Pfade),
  `.github/workflows/image-strip-backfill.yml` (neu, manueller Workflow mit dry_run-Sicherung).
- `/tmp/doc.json` erstellt mit classification, summaries (EN/DE), release_note, files (4 relevante),
  issues (leer — #1021 nur im Text referenziert, closingIssuesReferences leer).
- Mit `jq . /tmp/doc.json` validiert (JSON valide).

## Relevante Stellen

- `.github/scripts/image-strip-backfill.sh:1-43` — Kopfkommentar mit Scope-Entscheid (nur geschlossene Vorgänge,
  Überschneidungen gewollt/idempotent), Fehlerbehandlung (laut nicht still, Rate-Limit-Handling).
- `.github/scripts/pr-image-strip.sh:170-171` — `--issue`-Modus-Dokumentation; `:221-226` Failure-Zähler;
  `:206-214` exponentieller Retry (5× statt 3× für Backfill-Masse).
- `.github/scripts/strip-images.test.ts:478-542` — Backfill-Tests (Objektauswahl, PR/Issue-Filter, Failure-Pfade).

## Annahmen

- `gh pr view 1043 --json closingIssuesReferences` liefert `[]` → #1021 ist nur im Text referenziert,
  nicht formal verknüpft; daher `issues: []` in doc.json (kein "Closes #"-Referenz im Body).

## Verworfen

- Keine relevanten Alternativen verworfen.

## Offen

-

## Nächster Schritt

PR 1043 ist dokumentiert — Phase 6 abgeschlossen.

## Fallstricke

- Der PR hat ein Label `ai:needs-human` — dokumentiert, aber kein Finding gegen diesen PR (läuft
  ausserhalb des Documenter-Scopes).
- Titel war bereits konform (durch Review-Phase umbenannt) → `title` und `title_reason` bleiben leer.
