# PR 1019 Review (CI-Phase 5) — VERDICT-Parser-Härtung

## Erledigt
- Runde 1 (Kreuzverhör, 2026-08-25 11:54): needs-fixup, F1–F3, Sammelkommentar issuecomment-5409993735
- Runde 2 (Fixup-Nachweis, 2026-08-25): Fixup = Force-Push/Squash cd3f9fba4e (12:05:52Z), alter reviewed SHA 62bfc9a4da via Review-5018555723.commit_id rekonstruiert
- F1 BEHOBEN: alle 4 Prompts auf Vollversion restauriert, Delta vs main jetzt NUR die VERDICT-Abschnitte (Token nackt, Bedeutungen in Folgezeile) — per tarball-Diff verifiziert
- F2 BEHOBEN: 04-claude-implement.yml:800 jetzt `grep -oE 'needs-human|already-done'` (+2 Kommentarzeilen), fixup-verdict.sh (unverändert) hat bereits already-done-Decision-Table
- F3 BEHOBEN: review.md:73–75 Tokens je eigene Zeile
- CI am neuen Head: verify/e2e ×4/label/precheck pass; review=pending (eigener Lauf); gate-merge skipping normal
- VERDICT: reviewed (Sammelkommentar gepatcht, /tmp/claude-verdict geschrieben)

## Relevante Stellen
- `.github/workflows/04-claude-implement.yml:797–804` — Fixup-Fallback-Grep mit beiden Tokens
- `.github/prompts/{ux,spec,implement,review}.md` — VERDICT-Abschnitte je Datei (ux:28, spec:38, implement:44, review:70–77)
- `/tmp/fixup.diff`, `/tmp/fx{old,new}/` — rekonstruierter Runde-1↔Runde-2-Diff (flüchtig)

## Annahmen
- Dangling-Commit 62bfc9a4da ist via `curl -L -H "Authorization: Bearer $(gh auth token)" https://api.github.com/repos/deleonio/priority-pilot/tarball/<sha>` holbar (gh api folgt Redirects NICHT — 0-Byte-Datei)
- Titel-Gate: `fix(ci): make VERDICT parser ignore prose after token` erfüllt Conventional Commits → kein Rename nötig

## Verworfen
- „Neue Probleme im Fixup-Diff" — keine gefunden: Token-Paare disjunkt (needs-human/already-done), YAML/Quoting intakt (verify grün), restaurierte Prompts verlieren Token-Fix nicht
- „fixup.md:75–76 Zweizeiler-Beispiel als Echo-Risiko" — fixup.md unverändert am PR (nicht in Dateiliste), kein PR-Gegenstand

## Offen
- Issue #1017 bleibt vom Menschen zu entblocken (im PR-Body deklariert, kein Scope dieses PR)
- Memory-Kandidat „PRs mit Prompt-Rewrite-Nebenscope müssen Side-Scope im Body deklarieren" — Runde 2 hat per Restore gelöst; Konvention wäre noch worthochzustufen (keine Review-Aktion mehr)

## Nächster Schritt
- Keine — PR ist review-abgeschlossen (reviewed); Weiterverarbeitung läuft über den Workflow

## Fallstricke
- Force-Push-Squash zerstört `gh pr view --json commits`-Historie: reviewed SHA stattdessen aus `pulls/N/reviews[].commit_id` holen; `compare/A..B` 404t bei Dangling-Commits → beide Trees als tarball/`git archive` extrahieren und lokal diffen
- Repo ist `deleonio/priority-pilot`; remote URL enthält Token-Userinfo → REPO-Parsing per sed scheitert, hardcoden
- gh api tarball-Endpoint: Redirect wird nicht gefolgt → curl -L nehmen (siehe Annahmen)
