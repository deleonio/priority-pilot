# Issue 1136 — Review (Phase 5/7), Stand 2026-08-31T10:55Z (Runde 2 = Fixup-Verifikation)

**ERGEBNIS: VERDICT needs-human, 🟡.** MODE = Fixup-Verifikation (Marker `<!-- ai-review -->` gefunden → issuecomment-5473789034, updated 2026-08-31T04:37:28Z). Delta-Diff seit updatedAt = **leer im Produktionscode**: die beiden Fixup-Commits `82897621` und `1f4f884a` („memory: fixup") haben **0 Dateiänderungen** (`git diff-tree --name-status -r` = leer); nur `.ai-memory/issue-1136-review.md` kam dazu. F1–F3 sind dadurch NICHT behoben (Anker gegen Ist-Stand nachgeprüft: `google-signup.spec.ts:39`, `auth.test.ts:231`, `routes/auth.ts:259` vs. `requireAuth.ts:5-6` — alle noch gültig). Neu als **F4 (Entscheidungs-Finding)**: der Commit-Stop-Guard (`.github/workflows/04-implement.yml:867-876`, zählt ALLE PR-Commits > 10) hat den Fixup-Loop zweimal fail-closed gestoppt (05:02:46Z, 08:01:03Z); PR liegt bei **15 Commits** → jeder weitere Fixup-Commit erhöht den Zähler, needs-fixup wäre eine Endlosschleife. Optionen 4.1 (Historie squashen, Empfehlung) / 4.2 (Guard-Schwelle bzw. `memory:`-Commits aus der Zählung) / 4.3 (manuell fixen) in den Entscheidungs-Findings. Sammelkommentar IN PLACE aktualisiert (gleiche ID 5473789034, Review-Typ: Fixup-Nachweis). Keine neuen Inline-Kommentare (Diff unverändert, F1–F3-Threads aus Runde 1, Review-ID 5063140023, treffen weiter zu). Titel-Gate: bereits `fix(auth): end endless spinner after Google authentication (#1136)` (66 Zeichen, CC-konform) → kein Edit.

## Erledigt
- MODE-Bestimmung: `gh api .../issues/1149/comments` → Kommentar 5473789034 mit Body-Präfix `<!-- ai-review -->` → Fixup-Verifikation.
- Delta-Diff: `git diff c1127c05..1f4f884a --stat` = nur `.ai-memory/issue-1136-review.md` (+36); `git diff 3525db02..1f4f884a --name-only` = nur 2 `.ai-memory/`-Dateien → Produktion unverändert seit Runde 1.
- Guard-Nachweis: Stop-Guard-Kommentare 2× im PR; Guard-Code liest `commits | length` des gesamten PR (04-implement.yml:867-876).
- `issue-1136-fixup.md` existiert NICHT (ls: implement/review/spec/triage) — Fixup hat nicht mal eine Phasen-Notiz geschrieben.
- Sammelkommentar aktualisiert (PATCH, ID unverändert), Schreibfehler danach korrigiert.

## Relevante Stellen
- `.github/workflows/04-implement.yml:872` — Schwelle `> 10` über ALLE PR-Commits; Ursache der Blockade bei Multi-Phasen-PRs.
- `82897621` / `1f4f884a` — leere `memory: fixup`-Commits (jede gestoppte Runde erhöht den Zähler um 1 ohne Nutzen).
- F1–F3-Anker wie in Runde 1 (unverändert gültig), Details stehen im Sammelkommentar.

## Annahmen
- needs-human statt needs-fixup, weil der vorgesehene Fixup-Weg mechanisch blockiert ist und das Lösen (Squash der Historie bzw. Lockern der Guard-Schwelle) eine bewusste Ausfallsicherung des Workflows berührt — eine Menschenentscheidung, nicht fixbar im Code-PR.
- Pipeline-Verifikation testet auf `Entscheidungs-Findings` im Kommentar-Body → beide Sektionen (⏸️ + 📋) im Body lassen das zu.

## Verworfen
- needs-fixup — würde den Loop erneut triggern, der deterministisch am Stop-Guard scheitert (15 > 10).
- Erneute Inline-Kommentare zu F1–F3 — Duplikate; Threads existieren, Diff ist unverändert.
- 🟢 — F1 (E2E ohne Zähne) verletzt die Test-Substanz-Anforderung an AK4 weiterhin.

## Offen
- F4 wartet auf die Optionswahl des Menschen (`4.1`/`4.2`/`4.3`) + Label; danach F1–F3 über den gewählten Weg.
- Wegwerf-Artefakte in `/tmp` (`ai-review-comment.md`, `ai-review-new.md`) — kein Repo-Bezug.

## Nächster Schritt
- Nach Menschenentscheidung `4.1`: Squash der `memory:`-Commits auf < 11, `ai:needs-fixup` → Fixup setzt F1–F3 um → Runde-3-Verifikation wieder per Diff-Scoping ab diesem Kommentar-Stand (2026-08-31T10:55Z).

## Fallstricke
- Fixup-Runden KÖNNEN leer sein: kein `issue-1136-fixup.md` + 0-Byte-Diff ⇒ nicht „Findings behoben" annehmen, sondern per `git diff-tree --name-status -r <commit>` verifizieren.
- Der Commit-Stop-Guard zählt den GESAMTEN PR, nicht nur Fixup-Commits — bei Multi-Phasen-PRs (> 10 Commits durch Phasen-Notizen) ist jede weitere Automatik-Runde tot; das ist ein Harness-Problem, kein Code-Problem des PR.
- `gh api --jq '.id + " updated"'` schlägt fehl (number + string) — `.id` allein ausgeben.
