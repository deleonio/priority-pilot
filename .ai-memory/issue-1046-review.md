# Review PR #1046 (Kreuzverhör, Runde 1)

## Erledigt

- Modus bestimmt: kein `<!-- ai-review -->` an #1046 → KREUZVERHÖR (Erst-Review).
- PR hat KEIN verknüpftes Issue (`closingIssuesReferences: []`) → keine AK, Soll-Verhalten aus
  PR-Body + Kopf-Kommentar `.github/scripts/resolve-phase-routing.sh:6-13`.
- Fixture-Format gegen `resolve-phase-routing.sh:6-13` geprüft: 1:1 identisch (Tabellenkopf,
  Trennzeile, 4 Phasenzeilen). ✔
- Alle 12 Assertions lokal per Bash-Harness gegen `.github/scripts/resolve-spec-skip.sh`
  nachgestellt (kein node_modules in der Sandbox → kein `pnpm exec tsx`): alle erwarteten
  `needs_spec`/`reason`-Werte treffen zu.
- CI-Gegenprobe: Job `verify` (Run 32962140526, Job 98156631464) zeigt im Log Zeile 588-605
  alle drei `resolve-spec-skip.sh`-Suiten grün.

## Relevante Stellen

- `.github/scripts/resolve-spec-skip.test.ts:40-56` — die umgestellte Fixture (`block()`).
- `.github/scripts/resolve-spec-skip.test.ts:97-130` — Testnamen/Param `ui` noch im alten
  Format ("Spec nötig: ja", "das Feld fehlt", "UI-Bezug") → Finding 2.
- `.github/scripts/resolve-spec-skip.sh:60-90` — `routing_run()` + fail-safe-Kaskade, gegen die
  die Fixture verifiziert wurde.
- `docs/kosten-optimierungsplan.md`, `docs/kosten-report-1034.md`, `docs/kosten-report-1037.md` —
  427 der 445 hinzugefügten Zeilen, aus Commit `f0961110`, im PR-Body nicht erwähnt → Finding 1.
- `.github/scripts/workflow-name-contract.test.ts` — schlägt an `00-issue-quality.yml`
  (aus `3aa7cef7` auf main) fehl → Finding 3, NICHT von diesem PR verursacht.

## Annahmen

- `pnpm test:scripts` ist in `.github/workflows/ci.yml:89` verdrahtet, d. h. der Bruch war
  CI-sichtbar — bestätigt per grep.
- PR #1045 (derselbe Prettier-Commit `f0961110`) wurde nach `claude/cleanup-historical-issues-prs-sj7yvt`
  (PR #1043) gemergt, NICHT nach main — main trägt die Reformatierung noch nicht
  (`git show origin/main:docs/kosten-optimierungsplan.md` zeigt das alte Tabellenformat).
  Der Commit in #1046 ist also kein Duplikat auf main, aber überlappt mit dem offenen #1043.

## Verworfen

- Lokaler Testlauf per `pnpm exec tsx` — `pnpm` ist in der Review-Sandbox nicht installiert und
  `node_modules/` fehlt. Ersatz: Bash-Harness + CI-Log-Auswertung (gleicher Beweiswert).
- Finding "Test-Pflege-Bedarf" — es gibt keinen Widerspruch zu Tests außerhalb des Diffs.

## Offen

- CI `verify` ist rot, Ursache aber außerhalb dieses PR:
  `AssertionError: 00-issue-quality.yml: Name '00 - Issue-Güte (Vorab-Check, ohne LLM)' folgt
  nicht dem Schema '<n>/<gesamt> <Titel>'`. Blockiert das Merge-Gate von #1046 trotzdem.

## Nächster Schritt

- Fixup: Findings 1+2 abarbeiten; Finding 3 in eigenem PR (Workflow umbenennen ODER Kontrakt-Test
  um die Vorab-Check-Stufe erweitern — das ist eine Konventions-Entscheidung).

## Fallstricke

- `git log --all` beim Ancestry-Check benutzen verfälscht das Ergebnis: `--all` durchsucht ALLE
  Refs, nicht nur `origin/main`. Für "ist Commit X auf main?" stattdessen
  `git merge-base --is-ancestor X origin/main`.
- `gh run view --log-failed` liefert nichts, solange der Gesamt-Run noch läuft (e2e pending).
  Ausweg: `gh api repos/{owner}/{repo}/actions/jobs/<id>/logs --allow-escape-sequences`.
- PR #1046 hat kein verknüpftes Issue — der Auftrags-Prompt spricht vom "implementierten Issue";
  im Sammelkommentar musste das explizit als "kein verknüpftes Issue" ausgewiesen werden.
