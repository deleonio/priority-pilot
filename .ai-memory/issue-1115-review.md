# Issue 1115 (PR) — Review (Kreuzverhör, Runde 1), Stand 2026-08-29

**ERGEBNIS: VERDICT reviewed, 🟢.** Kein `<!-- ai-review -->`-Kommentar vorhanden → Modus Kreuzverhör. Kein Closing-Issue (closingIssuesReferences=0) → PR-Beschreibung ist massgebende informelle Spezifikation. Titel CC-konform (feat(ci), 60 Zeichen) — kein Rename. Sammelkommentar 1× neu erstellt (Marker Zeile 1).

## Erledigt
- Vollen Diff gelesen (+64/−13: `.github/workflows/05-claude-pr-review.yml` [nur Kommentar], `.github/workflows/claude-pr-gate-merge.yml` [Merge-Schritt], `docs/ci-architecture.md`, `docs/pipeline-flow.md`).
- Zentralen Fakt unabhaengig verifiziert: `gh api repos/deleonio/priority-pilot` → squash=true/merge=false/rebase=false, squash_title=PR_TITLE, squash_msg=BLANK, delete_branch_on_merge=true — PR-Beschreibung trifft exakt zu.
- Shell-Logik der Methodenwahl im Merge-Schritt (claude-pr-gate-merge.yml ~431-470) alle 4 Zweige durchgeprüft: squash→squash; squash=false+merge=true→merge; beide false→`::error`+exit 1; API-Ausfall (`{}`, `// empty`)→Squash-Default. Bash-Array `merge_args=(--squash --subject "$pr_title (#$pr)" --body "")` + `"${merge_args[@]}"` korrekt; Backticks in `merge_method="…(\`…\`)"` sind escaped-literal, kein Command-Substitution-Risiko.
- Blast-Radius: grep nach `pr merge --merge`/`merge_commit` — keine weiteren Code-Stellen, nur die in diesem PR mitgeänderten Docs/Kommentare. Kein Skript parsst Main-Commit-Subjects.
- CI-rot (`e2e (2)`, `issue-969.spec.ts:86`) als nicht diff-bedingt eingeordnet: Diff touchiert keinen App-Code; Frontend-Stand == grünem main (Zwischencommit 8821f851 nur `.costs/1111.json`); zeitgleich unrelated E2E-Fails auf ai/harness/1110 (issue-1110 08:34, issue-697/763 08:20) → Flaky-Fenster. Im Sammelkommentar dokumentiert; Gate degradiert CI-rot eigenständig.
- Sammelkommentar via `.ai-memory/issue-1115-review-comment.md` + `gh pr comment --body-file` gepostet.

## Relevante Stellen
- `.github/workflows/claude-pr-gate-merge.yml:431-470` — neuer Methodenwahl-Block (Repo-API-Lesen, Fallback-Kette, merge_args).
- `.github/workflows/claude-pr-gate-merge.yml:19-39` — Header-Kommentar Merge-Strategie (SQUASH, Repo-Stand 2026-08-29).
- `docs/pipeline-flow.md:236-250` + `docs/ci-architecture.md:480-490` — Doku-Spiegel der neuen Methode.

## Annahmen
- PR-Beschreibung (informelle Spezifikation, kein Issue) deckt den Diff vollständig ab — alle 4 dort genannten Wie-Punkte im Diff wiederfinden gewesen.
- E2E-Fail ist Flake (Indizienkette, s. Erledigt); kein Re-run abgewartet (Soft-Deadline). Gate/Degradation übernimmt das Retry.

## Verworfen
- needs-fixup wegen CI-rot — wäre die dokumentierte Sackgasse (Fixup ohne Commit-Finding → No-Progress → needs-human); Gate degradiert deterministisch selbst.
- Re-run des Shards — Soft-Deadline (6 min Rest) zu knapp für ~4 min Shard-Lauf.
- Subject-Länge `(#Nr)`-Suffix als Finding — GitHub-Konvention, bewusst gewählt und in PR+Doku begründet; CC-Regex prüft nur den PR-Titel.
- Inline-Review-Kommentare — keine Findings, also keine.

## Offen
- `.ai-memory/issue-1115-review-comment.md` = Wegwerf-Artefakt (Body des Sammelkommentars), NICHT committen; nur diese Datei hier ist die Phasen-Notiz.
- Falls eine Fixup-Runde kommt (z. B. über CI-Degradation): Fixup sollte nur den e2e-Shard re-runen, nichts am Code ändern.

## Nächster Schritt
- Phase danach: Gate/Label-Maschinerie übernimmt (reviewed gepostet); bei CI-Grün → ai:ready-to-merge → Auto-Merge (noch mit alter Gate-Version von main, im PR korrekt als Rollout-Hinweis dokumentiert).

## Fallstricke
- Fixup-Runden auf diesem PR dürfen die Merge-Strategie-Logs nicht als Befund missverstehen — der e2e-Fail ist environmental.
- Runde 2 (falls): Modus Fixup-Nachweis, Diff-Scope = Commits nach 2026-08-29T~09:0xZ (updatedAt des Sammelkommentars).
