# Issue 1137 — Review PR #1138 (Phase 5), Stand 2026-08-31

**ERGEBNIS: VERDICT needs-fixup, 🔴.** MODE = Kreuzverhör (kein `<!-- ai-review -->`-Kommentar auf PR 1138 vorhanden). Closing-Issue #1137 vorhanden → AKs aus dem Harness-Kommentar (issuecomment mit `<!-- ai-harness -->`, AK1–AK8) gelesen. Review mit 3 Inline-Findings (F1–F3) gepostet, Sammelkommentar neu erstellt, Titel-Gate PASS (kein Rename).

## Erledigt
- Marker-Suche: `gh api repos/{owner}/{repo}/issues/1138/comments` → 0 Treffer auf `startswith("<!-- ai-review -->")` → MODE Kreuzverhör.
- PR gelesen: 1 Datei `.github/prompts/fixup.md` (+4/-1), 1 Commit d88823ca (2026-08-31T02:57:37Z), Titel `chore(fixup): close fixup loop gap for ambiguous findings (#1137)` (Conventional Commits ✅, 65 Zeichen).
- Harness-Kommentar von #1137 komplett gelesen: 8 AKs, bindende Menschen-Entscheidung "Setze alle drei Optionen um" (deleonio 2026-08-31T02:24:40Z), keine Tests (reine CI-Prompt-Änderung) vorgesehen.
- AK-Abgleich am Branch-Stand (Checkout = Merge 47c770fc): AK1 ✅ (Pauschalzeile "Ambiguous/decision findings → don't fix" entfernt, 3 getrennte Pfade), AK2 ✅ (beide Abrufbefehle, `gh api repos/{owner}/{repo}/...` = gültige gh-Platzhalter-Expansion, `{{PR_NR}}` konsistent mit fixup.md:1,9). **AK3–AK8 ✗** verifiziert: SKILL.md ohne ambig/Decision-Klassifikation (grep 0 Treffer), review.md:50-51 nur Verdict-Legende, ux.md:10-19 dupliziert KI-ANALYSE-Feldliste + read-modify-write weiterhin, triage.md:19-21 Body-Edit-Verbot weiterhin 3-zeilig, adr-sync.md:50 / spec-sync.md:34 / guide-sync.md:40 VERDICT-Langform, guide-sync.md:27 LOGIN-TB-Verweis vorhanden, spec-sync.md ohne recherche-Delegationszeile.
- CI des PRs: precheck/verify/e2e(1,2,4) grün, e2e(3) pending, review-Job = dieser Lauf; kein rotes Gate.
- Review (event COMMENT) mit 3 Inline-Kommentaren gepostet; Sammelkommentar `<!-- ai-review -->` neu erstellt.

## Relevante Stellen
- `.github/prompts/fixup.md:10-11` — neue ambig/Decision-Pfade; Z.11 ist der Konflikt-Finding-Anker (Options-ID aus Review ≠ vom Menschen gewählt).
- `.github/prompts/fixup.md:19-22` — WRAP-UP kennt nur needs-human/already-done/kein Verdict → Klärungs-Runde hat keinen definierten Endzustand (F3).
- `.github/prompts/ux.md:10-19`, `triage.md:19-21`, `guide-sync.md:27,40`, `spec-sync.md:34`, `adr-sync.md:50` — Beleg-Stellen für AK4-AK7-Unerledigt-Sein (F1).
- `.claude/skills/review-kreuzverhoer/SKILL.md` — AK3-Ziel (Finding-Klassen fixbar/ambig/Entscheidungs-Finding anschlussfähig), aktuell ohne "ambiguous".

## Annahmen
- Der PR soll das ganze Issue #1137 abdecken (`Closes #1137` im Body); dass nur Option 1 drin ist, ist Scope-Lücke, nicht bewusster Split — der Body nennt keinen Split-Plan und es gibt keinen zweiten PR (gh pr list = nur 1138).
- Verdict needs-fixup (nicht needs-human), weil die AKs eindeutig vorgeben, WAS zu tun ist; ein Fixup kann AK3–AK8 direkt nachziehen (Analyse-Block: "Änderungen in einem PR machbar, Präzedenz #1090").

## Verworfen
- needs-human für F1 — Spezifikation (AKs + bindende Entscheidung) ist eindeutig, keine echte Produktfrage.
- KoliBri-/Mobile-/Design-Audit — keine UI-Änderung im Diff.
- Test-Finding — Issue AK-Block sagt explizit "Keine" (kein Anwendungscode); kein tautologischer Test im Diff.
- Titel-Edit — Conventional Commits erfüllt.

## Offen
- e2e (3) und der review-Workflow-Job waren beim Review-Abschluss noch pending — kein rotes Gate, aber endgueltiges CI-Gruen ist nicht von mir verifiziert.

## Nächster Schritt
- Fixup-Runde: AK3–AK8 in PR #1138 nachziehen (ux.md, triage.md, VERDICT-Kurzform in 8 Prompts, guide-sync, spec-sync, SKILL/review.md-Klassifikationsabgleich) + F2 (fixup.md:11 auf menschliche Options-Wahl einschränken) + F3 (Endzustand der Klärungs-Runde definieren).

## Fallstricke
- F1-Nummerierung stabil halten: F1=Scope/AK3-AK8, F2=fixup.md:11 Bypass-Risiko, F3=fixup.md:10 Klärungs-Endzustand.
- `gh api repos/{owner}/{repo}/...` in Prompts ist KEIN Template-Fehler — gh expandiert `{owner}`/`{repo}` nativ; nicht als Finding melden.
- Sammelkommentar line 2 muss `needs-fixup` + PR-/Issue-Referenz tragen; Footer `Review-Typ: Kreuzverhör`.

## Nachtrag (Abschluss)
- Review gepostet: pullrequestreview-5062817145 (event COMMENT, commit d88823ca) mit 3 Inline-Kommentaren (fixup.md Z.12=F1, Z.11=F2, Z.10=F3; Z.1 ist Diff-Kontext → Anchor nicht auflösbar, F1 deshalb auf Z.12 verankert).
- Sammelkommentar erstellt: issuecomment-5473182245 (Marker `<!-- ai-review -->`, line 2 = needs-fixup + PR/Issue, Footer Review-Typ: Kreuzverhör). Tippfehler "Rende" per PATCH korrigiert.
- TITLE GATE: PASS — kein `gh pr edit` nötig.
