# PR 1043 — Review (Kreuzverhör, Runde 1)

## Erledigt

- MODUS bestimmt: kein `<!-- ai-review -->` am PR 1043 vorhanden → **Kreuzverhör** (Erst-Review).
- Vollständigen Diff gelesen (4 Dateien, +188/-25): `.github/scripts/image-strip-backfill.sh` (neu, 64 Z.),
  `.github/scripts/pr-image-strip.sh` (`--issue`-Modus), `.github/scripts/strip-images.test.ts` (+1 Test),
  `.github/workflows/image-strip-backfill.yml` (neu).
- Ticket #1021 gelesen (AK1–AK4 im `KI-ANALYSE`-Block). Wichtig: `closingIssuesReferences` von PR 1043 ist
  **leer** — der PR ist formal an kein Issue gekoppelt, referenziert #1021 nur im Text. #1021 ist bereits CLOSED;
  seine Interpretationsfestlegung sagt ausdrücklich „kein einmaliger Backfill … sollte der gewünscht sein,
  separates Ticket. Ausbaustufe (optional, nicht AK): Backfill-Skript für **offene** Issues".
- 6 Findings als Inline-Review (event=COMMENT) gepostet, Sammelkommentar angelegt, Verdict `needs-fixup`.
- Titel-Gate: alter Titel war deutsch/nicht-CC → umbenannt in `ci(image-strip): add backfill for historical issues and prs`.

## Relevante Stellen

- `.github/scripts/image-strip-backfill.sh:42-45` — PR-Schleife; Listing via Process-Substitution mit `2>/dev/null || true`.
- `.github/scripts/image-strip-backfill.sh:63-64` — Summary mit `pr_failed`/`issue_failed`.
- `.github/scripts/pr-image-strip.sh:165` — Abschluss-Echo mit `${PR:+, }` (Trailing-Komma im reinen `--pr`-Pfad).
- `.github/scripts/pr-image-strip.sh:117-131` — neue `strip_issue()`-Funktion (gemeinsamer Kern, sauber extrahiert).
- `.github/workflows/image-strip-backfill.yml:17` — `workflow_dispatch: {}` ohne Inputs; `:31` `timeout-minutes: 340`.

## Annahmen

- `pr-image-strip.sh` endet in allen Sweep-Pfaden mit Exit 0 (nur Arg-Fehler → 2, fehlendes node → 0, Zeile 50–53) —
  daraus folgt F2 (tote Fehlerzähler). Per Codelesen verifiziert, nicht durch Ausführen.
- GitHub-Rate-Limits (5.000 req/h primär, ~80 content-creating req/min sekundär) als Grundlage von F5 — Doku-Wissen,
  nicht im Repo belegt.

## Verworfen

- Tests lokal ausführen: `pnpm` fehlt in dieser Sandbox, `node_modules` nicht installiert
  (`node node_modules/.bin/prettier` → MODULE_NOT_FOUND). Stattdessen `npx --yes prettier@3 --check` genutzt.
- Format-Check-Rotfärbung als PR-Finding: `npx prettier@3 --check .` zeigt nur `docs/kosten-optimierungsplan.md`,
  `docs/kosten-report-1034.md`, `docs/kosten-report-1037.md` — alle drei **nicht im PR-Diff**, also
  Vorschaden auf `main`. Nur als Kontext im Sammelkommentar erwähnt, kein Finding gegen diesen PR.

## Offen

- CI-Check `verify` ist rot (Step „Format-Check", Job 98153643608) — Ursache liegt außerhalb dieses PRs (s. o.),
  blockiert aber `ai:ready-to-merge` über `claude-pr-gate-merge.yml`.
- Produktfrage (in F4 gestellt, nicht entschieden): sollen auch **offene** Issues/PRs bereinigt werden?
  #1021 nennt genau das als Ausbaustufe, der PR deckt nur `state=closed` + `merged_at != null` ab.

## Nächster Schritt

Fixup-Runde abwarten; im Folge-Review MODUS = Fixup-Nachweis fahren (nur Findings F1–F6 gegenprüfen + neuen Diff).

## Fallstricke

- `gh pr view 1043 --json closingIssuesReferences` liefert `[]` → das Ticket lässt sich nur über den Fließtext (#1021)
  finden; nicht auf die API-Verknüpfung verlassen.
- Inline-Kommentare an einer **neuen** Datei brauchen `side: RIGHT` + eine Zeile, die im Diff-Hunk liegt.
- Finding-Nummern F1–F6 sind über Runden stabil zu halten.
