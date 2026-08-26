# Review PR #1047 — Notizen

## Erledigt

- MODUS bestimmt: kein `<!-- ai-review -->`-Kommentar an Issue/PR 1047 vorhanden
  (`gh api repos/deleonio/priority-pilot/issues/1047/comments`) → **KREUZVERHOER** (Erst-Review).
- Diff gelesen: reines Rename, 0 additions / 0 deletions, similarity 100%:
  `.github/workflows/00-issue-quality.yml` → `.github/workflows/issue-quality-check.yml`.
  Kein verknuepftes Issue (`closingIssuesReferences` leer) → AK aus PR-Body.
- Contract-Test `.github/scripts/workflow-name-contract.test.ts` analysiert (Z. 74-98):
  scannt `readdirSync(workflows).filter(/^\d\d-.*\.yml$/)`, verlangt Name-Schema
  `^(\d)/(\d)\s`, Gesamtzahl `6`, und lueckenlos aufsteigende Nummern ab 0.
  Nach dem Rename ist die Menge 00-set-llm-provider..06-claude-pr-documenter mit den Namen
  `0/6 LLM-Provider` .. `6/6 Dokumentation` → seen = [0..6] = erwartet → Test wird gruen.
  Phase-0-Slot bleibt besetzt (kein Loch) — verifiziert per Namensliste aller Workflows.
- Referenz-Check: `grep -rn "00-issue-quality"` repo-weit = 0 Treffer → PR-Body-Behauptung
  „keine anderen Referenzen" **bestaetigt**.
- Anzeige-Name-Check: `grep -rn "Issue-Güte|Issue-Guete"` ausserhalb der Datei = nur ein
  Kommentar in `.github/scripts/verify-issue-quality.sh:2`. `claude-pr-gate-merge.yml:33`
  horcht auf `workflows: ['CI', '5/6 Review']` → der Anzeige-Name der umbenannten Datei ist
  NIRGENDS lastend, Umbenennen des `name:` ist risikofrei.
- FINDING 1 (fixbar) gepostet: `.github/workflows/issue-quality-check.yml:1` traegt weiterhin
  `name: '00 - Issue-Güte (Vorab-Check, ohne LLM)'` — nur der DATEIname wurde aus der
  Phasen-Nummerierung geloest, der Anzeige-Name nicht. In der Actions-Sidebar stehen jetzt
  zwei „00"-Eintraege nebeneinander (`0/6 LLM-Provider` + `00 - Issue-Guete`).
- CI-Befund: `verify` rot, Schritt **Format-Check**. **Pre-existing auf main** (Run 32961754123,
  gleicher Schritt rot): `prettier --check .` meldet `docs/kosten-optimierungsplan.md`,
  `docs/kosten-report-1034.md`, `docs/kosten-report-1037.md`. NICHT von diesem PR verursacht,
  ausserhalb seines Scopes.
- TITEL-GATE: Titel war Conventional-Commits-konform in Form, aber deutsch
  (`fix(ci): 00-issue-quality.yml aus der Phasen-Nummerierung lösen`) → per
  `gh pr edit 1047 --title` auf englisch umbenannt.

## Relevante Stellen

- `.github/workflows/issue-quality-check.yml:1` — der `name:`, der noch das `00 -`-Praefix traegt.
- `.github/scripts/workflow-name-contract.test.ts:74-98` — der Test, dessen Dateinamen-Regex der
  PR ausweicht.
- `.github/workflows/claude-pr-gate-merge.yml:33` — Allowlist, die den Anzeige-Namen NICHT nennt.
- `docs/kosten-*.md` (3 Dateien) — Ursache des pre-existing roten Format-Checks auf main.

## Annahmen

- Der PR-Body ist die AK-Quelle (kein verknuepftes Issue). Ziel = „Datei aus der
  Phasen-Nummerierung loesen"; daran gemessen ist der Anzeige-Name Teil des Ziels.
- Contract-Test lokal NICHT ausgefuehrt (keine `node_modules`, kein `pnpm`/`tsx` in der Sandbox)
  — das Gruen-Werden ist durch Lesen der Testlogik + Namensliste hergeleitet, nicht gemessen.

## Verworfen

- Finding „Rename umgeht den Test statt ihn zu erfuellen" als eigenes Finding: die
  Dateinamen-Konvention `\d\d-` IST die Definition der Testmenge, das Ausscheiden ist die
  beabsichtigte Semantik. Stattdessen in Finding 1 gebuendelt.
- Finding zum roten Format-Check: pre-existing auf main, PR-fremd → kein Finding, nur Kontext.

## Offen

- `verify` bleibt rot bis die 3 `docs/kosten-*.md` auf main formatiert sind — blockiert
  `ai:ready-to-merge`, unabhaengig vom Inhalts-Urteil.

- Gepostet: Datei-Kommentar `id=3862225536`, Review `id=5029790471` (COMMENTED),
  Sammelkommentar `issuecomment-5424570745` (`<!-- ai-review -->`, Runde 1).
  VERDICT: needs-fixup.

## Naechster Schritt

- Fixup: in `.github/workflows/issue-quality-check.yml:1` das `00 - `-Praefix aus `name:`
  entfernen (`name: 'Issue-Güte (Vorab-Check, ohne LLM)'`), sonst nichts.

## Fallstricke

- `node_modules` ist in dieser Sandbox LEER und `pnpm` nicht im PATH → Tests lassen sich hier
  nicht ausfuehren; Aussagen ueber Testausgang immer als hergeleitet kennzeichnen.
- `gh run view --log` liefert bei laufendem Run „still in progress"; Ausfall-Schritt stattdessen
  per `gh api repos/{o}/{r}/actions/jobs/<id> --jq '.steps[]|select(.conclusion=="failure")'`.
- Rename-only-PR = kein Diff-Hunk = keine `position` → `POST pulls/<pr>/reviews` mit
  `comments[]` scheitert 422; `subject_type` gibt es dort nicht. Stattdessen
  `POST pulls/<pr>/comments` mit `subject_type=file` + `commit_id`, Review-Body separat.
- Beim Bewerten der Phasen-Nummerierung nicht vergessen: Slot 0 ist von
  `00-set-llm-provider.yml` besetzt — das Rename reisst KEIN Loch in die 0..6-Kette.
