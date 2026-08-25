# Review PR #1005 (Memory-Transport + Prompt-Platzhalter) — Phase 5

## Erledigt
- **Runde 1 (KREUZVERHÖR, 2026-08-25 02:34Z):** Diff 100% gelesen (Stand 7fda07bc). Verifiziert 🟢:
  Guard in allen 9 Prompt-Bau-Blöcken; assert-prompt-complete.sh in 3 Fällen live getestet
  (Token→1, sauber→0, fehlend→1); jedes {{TOKEN}} in .github/prompts/ hat seinen sed im nutzenden
  Workflow; keine funktionalen .claude/memory-Reste (nur 2 erklärende Verweise setup-claude:87,
  adr0006:50); .gitattributes/.gitignore/.prettierignore/AGENTS.md konsistent; git ls-files
  .ai-memory → nur MEMORY.md; notes-vs-staged-Zählung korrekt; Titel konform; KoliBri N/A.
  Ergebnis: EIN Finding #1 🟡 (.claude/commands/spec-ticket.md:32 Token-Drift). Sammelkommentar
  issuecomment-5404318556 gepostet, Verdict needs-fixup.
- **Runde 2 (FIXUP-NACHWEIS, läuft):** Modus bestimmt (Marker vorhanden). Fixup-Commits seit
  updatedAt 02:34:08Z: `d6f14b1e` (02:50:17, "feat(ci): Ticket-Memory über alle Phasen laden und
  speichern") + Merge `9e1413da` (02:53:35, main→branch). Head = 9e1413da.

## Relevante Stellen
- `.claude/commands/spec-ticket.md:32` — Ort von Finding #1 (alte Token-Namen `#ISSUE_NR`/`ISSUE_NR`);
  liegt AUSSERHALB des Diffs, daher kein Inline-Kommentar möglich.
- `.github/workflows/0*.yml` — die 9 Prompt-Bau-Blöcke mit sed-Substitution + Guard-Aufruf.
- `.github/scripts/assert-prompt-complete.sh` — der neue Guard (Runde 1 live verifiziert).
- `.github/prompts/*.md` — Quelle der `{{TOKEN}}`-Platzhalter.
- `.ai-memory/` + `.gitattributes`/`.gitignore`/`.prettierignore` — neuer Memory-Ort.

## Annahmen
- Runde-1-Verifikation der unveränderten Teile gilt weiter; im FIXUP-NACHWEIS wird NUR der
  Fixup-Diff (7fda07bc..9e1413da) adversarial geprüft.
- `updated_at` des Sammelkommentars (02:34:08Z) ist die korrekte Schnittmarke.

## Verworfen
- Erneutes Kreuzverhör des ganzen PR — Modus verbietet es (Marker vorhanden).

## Offen
- Finding #1 (spec-ticket.md:32): Behebungsstatus in Runde 2 noch zu verifizieren.
- Fixup-Diff d6f14b1e auf NEUE Bugs prüfen — es ist ein `feat`-Commit, kein reiner Finding-Fix,
  also potenziell breite neue Fläche.

## Nächster Schritt
- `git diff 7fda07bc..9e1413da` lesen; spec-ticket.md:32 auf Head-Stand prüfen; dann
  Sammelkommentar 5404318556 fortschreiben + Verdict.

## Fallstricke
- PR #1005, head fix/memory-transport-und-platzhalter, base main, jetzt 6 Commits, kein Ticket-AK-Block.
- Finding-Nummern über Runden STABIL: #1 = spec-ticket.md Token-Drift.
- Soft-Deadline 1787627061 ist eng (Runde 2 startete bei ~1787626485, ~9 min Rest).
- Dauergedächtnis-Kandidat (Review committet nicht, hier geparkt): PR-Inline-Review-Kommentare
  gehen NUR auf Diff-Zeilen; Findings in unveränderten Dateien als COMMENT-Review + Verweis
  Datei:Zeile im Sammelkommentar posten.
- Dauergedächtnis-Kandidat: Modus-Bestimmung braucht `updated_at` (nicht `created_at`) des
  `<!-- ai-review -->`-Kommentars als Schnittmarke für den Fixup-Diff;
  `gh api repos/{owner}/{repo}/issues/N/comments --jq 'select(.body|contains("<!-- ai-review -->"))'`.
