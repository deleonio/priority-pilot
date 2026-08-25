# Issue #1010 — Implementierung (Direkt-Modus, kein Spec)

## Erledigt
- Branch `feat/issue-1010-notes-diff-count` angelegt (DIREKT-MODUS: Analyse „Spec nötig: nein", kein Draft-PR vorhanden — via gh pr list + Closing-Keyword-Grep verifiziert, leer).
- AK1 in `.github/actions/issue-state-save/action.yml`:
  - `outputs:`-Sektion + `id: save` am Step; Output `new-notes` (value: `steps.save.outputs.new-notes`).
  - `has_base`-Flag + `declare -A old_hash` im Branch-Fall; gefüllt aus `git ls-tree FETCH_HEAD -- .ai-memory` (Format `<mode> <typ> <hash>\t<pfad>`, Hash = `${meta##* }`).
  - Zähl-Loop: `blob="$(git hash-object -w "$f")"` wiederverwendet für update-index; `notes++` nur wenn `has_base=0` ODER Blob-Hash weicht ab. `echo "new-notes=${notes}" >> "$GITHUB_OUTPUT"` direkt nach Loop (deckt staged==0-Frühexit mit ab).
  - Notice geändert: „(${notes} neue Notiz(en) + state.json)".
- AK2 in `.github/workflows/06-claude-pr-documenter.yml`: Save-Step (id: save) + neuer Step „🔍 Notiz-Post-Assertion" direkt danach: `if: always() && configured == 'true' && steps.shortcut.outputs.skip != 'true'`, `[ "$new_notes" -ge 1 ] 2>/dev/null` sonst `::error` + `exit 1` (Vorbild Label-Post-Assertion 06:291–314; leerer Output bei gescheitertem Save zählt als Verstoß).
- AK3: Staging-Loop stage nach wie vor ALLE issue-*.md (restaurierte bleiben im Commit); nur Zählung geändert.
- Validierung: `yaml.safe_load` beider Dateien + `bash -n` auf die geänderten Run-Blöcke → OK.

## Relevante Stellen
- `.github/actions/issue-state-save/action.yml` — Fetch/if-Zweig (has_base/old_hash), Zähl-Loop (~Z. 95–120 nach Edit), Notice (Push-Retry-Block).
- `.github/workflows/06-claude-pr-documenter.yml` — Save-Step + neue Notiz-Post-Assertion (~Z. 263–290 nach Edit); Claude-Step-Bedingung (skip != 'true') ist die Assertion-Bedingung.

## Annahmen
- Composite-Action-Outputs funktionieren wie erwartet (`outputs:` + `$GITHUB_OUTPUT` im Step mit `id`) — Standard-Mechanik, nicht live verifiziert.
- Bei fehlgeschlagenem Save-Step ist `new-notes` leer → `[ "" -ge 1 ] 2>/dev/null` → false → Assertion rot. Gewollt (Job ist ohnehin rot).
- Nur der Documenter bekommt die Assertion (AK2); die 6 anderen Caller (01–05, 2× in 04) nutzen den Output nicht, Verhalten unverändert bis auf Notice-Text.

## Verworfen
- Stub-Ansatz vor dem Claude-Step — siehe Triage-Notiz; Post-Assertion ist das Repo-Muster.
- Harte Prüfung in der Action für alle Phasen — würde Bot-Shortcut-Läufe rot machen.

## Offen
- CI-Beobachtung der 3 Testfälle (a/b/c) aus dem Analyse-Block — erst nach Merge prüfbar, kein automatisierter Test (Carve-out).

## Nächster Schritt
- ERLEDIGT: Commit f417489c gepusht, PR #1014 erstellt (nicht Draft, Closes #1010): https://github.com/deleonio/priority-pilot/pull/1014 — Pre-Commit-Hook lief format/actions-validator/knip/lint komplett grün. Phase abgeschlossen (VERDICT: needs-review).

## Fallstricke
- `$(...)`-Command-Substitution im Bash-Tool vermeiden (Sandbox) — Checks aufsplitten.
- gh pr create mit Klammern im Body → syntax error: --body-file nutzen.
- MEMORY.md-Kandidat (nur falls hier committet wird): keiner — Erkenntnisse sind ticket-spezifisch bzw. schon in MEMORY.md.
