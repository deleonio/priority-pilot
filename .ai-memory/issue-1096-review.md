# Issue/PR 1096 — Review (Fixup-Nachweis, Runde 2), Stand 2026-08-28

**ERGEBNIS: VERDICT reviewed (🟢, F1 verifiziert behoben, keine neuen Funde).**

## Erledigt
- MODE bestimmt: `<!-- ai-review -->`-Marker vorhanden (issuecomment-5454934979, Stand der Erstrunde 2026-08-28T16:17:52Z) → Fixup-Nachweis, kein neues Kreuzverhör.
- F1 verifiziert: `.github/prompts/prompt-audit.md:1` liest jetzt „net token efficiency (NET cost over the whole phase chain)“ — exakt der Vorschlag der Erstrunde, konsistent zur FRAME-NET-Metrik (Zeile 3), F-Scope (Konkretisierung darf Initial-Tokens erhöhen) jetzt gedeckt. `git diff 1763c61f..HEAD --stat`: nur 1 Zeile in prompt-audit.md geändert.
- Delta geprüft: Rest = `.ai-memory/issue-{1091,1096}-*.md`, `.costs/1091.json`, `frontend/src/lib/useAddressSearch.test.ts`, `package.json` — alles über Merge 06490511 von main hereingekommen (nicht PR-eigene Änderung, kein Fund). Workflow-Assertionen (VERDICT-/EMPFOHLEN-Grep, Platzhalter, assert-prompt-complete.sh) unberührt.
- CI zum Review-Zeitpunkt: pending (neuer Lauf nach Merge); e2e (2) war im Vorlauf (fa388991, run 33189831836) einmal rot — Markdown-only-Änderung, pipeline-eigenes Gate degradiert bei Rot auf ai:needs-changes; im Sammelkommentar so vermerkt.
- Sammelkommentar 5454934979 per PATCH in-place aktualisiert: Status reviewed, #1 in „Behobene Anmerkungen“-Tabelle (fa388991), Footer „Review-Typ: Fixup-Nachweis / Updated: 2026-08-28“; Zeile-2-Hinweis „Review ohne Issue“ erhalten.
- Titel-Gate: Titel unverändert belassen (Struktur konform ci(prompts): …, ≤72; deutsches Subjekt = Repo-Konvention laut Git-Log — gleiche Entscheidung wie Erstrunde, nicht re-litigiert).

## Relevante Stellen
- `.github/prompts/prompt-audit.md:1` — F1-Fix (fa388991), verifiziert.
- `.github/prompts/prompt-audit.md:3` — FRAME/NET-Metrik, Referenz für den Fix.
- GitHub-Kommentar 5454934979 — der eine Sammelkommentar (ID stabil).

## Annahmen
- CI wird vom deterministischen Gate bewertet; e2e(2)-Rot ist flaky/pre-existing (Markdown-only-Delta), kein Review-Blocker.
- Merge-von-main-Dateien sind auf main bereits reviewt/gemerged — kein PR-Fund.

## Verworfen
- Neues Kreuzverhör des Gesamtdiffs — MODE Fixup-Nachweis, Delta-Scoping greift.
- Titel-Rename auf Englisch — Repo-Konvention deutsche Subjekte (Erstrunden-Entscheidung).

## Offen
- `.ai-memory/issue-1096-review-comment.md` = Wegwerf-Payload (Sammelkommentar-Body), gehört NICHT in einen Commit.

## Nächster Schritt
- Phase abgeschlossen (verdict reviewed geschrieben); Weiterverarbeitung läuft über den Workflow (Gate → ai:ready-to-merge bei grünem CI).

## Fallstricke
- Falls ein weiterer Fixup nötig wird: Marker-Kommentar 5454934979 weiter in-place patchen, Finding-Nummern stabil halten; „Behoben via“-Tabelle nicht abschneiden.
