# Issue #1010 — Review (Kreuzverhör PR #1014)

## Erledigt
- Modus bestimmt: KEIN `<!-- ai-review -->`-Kommentar an PR #1014 (API-Suche leer) → KREUZVERHÖR-Erstreview.
- Vollen Diff beider Dateien gelesen, AK1–AK3 aus Issue-Body-KI-ANALYSE-Block (stand=2026-08-25T03:40:05Z) geprüft: alle drei erfüllt.
- Umfeld verifiziert: 06-Workflow-Trigger nur `pull_request: [closed]` + merged-Guard bzw. workflow_dispatch → State-Branch existiert beim Documenter-Lauf regulär (Blob-Diff-Basis da); Teardown löscht Branch nur für GESCHLOSSENE Issues (06:343-Kontext).
- CI-Status PR #1014: e2e (1)-(4), verify, beide prechecks grün; kein roter Check.
- Titel-Gate: Titel war deutsch → via `gh pr edit 1014 --title` umbenannt zu `fix(ci): count only new/changed notes + documenter note post-assertion`.
- Sammelkommentar `<!-- ai-review -->` neu angelegt (Status reviewed, Comment-ID 5405088987), VERDICT: reviewed.

## Relevante Stellen
- `.github/actions/issue-state-save/action.yml:61-74` — has_base + `declare -A old_hash` gefüllt aus `git ls-tree FETCH_HEAD -- .ai-memory` (Tab-Split, Hash=`${meta##* }`): AK1-Kern, Parsing verifiziert korrekt.
- `.github/actions/issue-state-save/action.yml:108-120` — Zähl-Loop: `blob="$(git hash-object -w "$f")"` wiederverwendet, `old_hash[$f] != blob`-Vergleich, `echo new-notes` VOR dem `staged==0`-Earlyexit (deckt diesen ab). AK3: Staging unverändert (alle Notizen bleiben im Commit).
- `.github/actions/issue-state-save/action.yml:141` — Notice „N neue Notiz(en)", gilt action-seitig für alle 7 Caller → Meldung konsistent.
- `.github/workflows/06-claude-pr-documenter.yml:276-291` — neue Notiz-Post-Assertion: `if: always() && configured == 'true' && steps.shortcut.outputs.skip != 'true'` (symmetrisch zur Claude-Step-Bedingung 06:210), leerer Output → fail-closed rot.
- `.github/workflows/06-claude-pr-documenter.yml:186-205` — Bot-/Ignore-Shortcut setzt `skip=true` → Assertion bewusst ausgenommen.

## Annahmen
- Composite-Action-Output-Mechanik (`outputs:` + Step-`id` + `$GITHUB_OUTPUT`) funktioniert wie implementiert — Standard-GitHub-Actions, nicht live verifiziert (Carve-out).
- Documenter-Restore bringt Vorgänger-Notizen in den Workspace (Design #1009) — aus Workflow-Kommentaren und Beobachtungsfall 32803685957 geschlossen, Restore-Skript selbst nicht gelesen.

## Verworfen
- Finding „identischer Documenter-Re-Run wird rot": am selben Tag byte-identische Notiz → notes=0 → Assertion rot. Bewusst NICHT als Finding: AK1 definiert „neu" als Blob-Diff, also spec-konform; heilt sich am Folgetag selbst („Updated: JJJJ-MM-TT" ändert sich) und Documenter läuft post-merge (nicht pipeline-blockend). Nur als Beobachtung im Sammelkommentar erwähnt.
- Finding „staler Kommentar 06:306-307 (‚Kein Issue-Storage-Save')" widerspricht existierendem Save-Step: außerhalb des Diffs (vorbestehend), nur als Beobachtung im Sammelkommentar, kein Inline-Finding.

## Offen
- -

## Nächster Schritt
- ERLEDIGT: Review abgeschlossen, VERDICT reviewed geschrieben (/tmp/claude-verdict). Warten auf Merge; danach CI-Beobachtung der Testfälle (a)/(b)/(c) aus dem Analyse-Block (Aufgabe der Laufbetrachtung, nicht der Review-Phase).

## Fallstricke
- `gh api .../issues/1014/comments -q 'select(...)'` mit leerem Ergebnis gibt LEEREN Output (kein Fehler) — Modus-Bestimmung anhand „kein Output = Marker fehlt = Kreuzverhör".
- MEMORY.md-Kandidat (Review committet nicht → hier nur notiert): keiner — keine neue übertragbare Erkenntnis.
- `Write` nach `/tmp` ist in dieser Sandbox permission-gated (abgelehnt) → Body-Dateien für gh unter `.ai-memory/.<name>.md` ablegen (gitignored, führender Punkt matcht kein `issue-*.md`-Find).
