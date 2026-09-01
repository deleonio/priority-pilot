# Issue 1153 — Review (Fixup-Nachweis Runde 2, PR #1156), Stand 2026-09-01

**ERGEBNIS: VERDICT reviewed, Ampel 🟢.** Mode FIXUP VERIFICATION (Sammelkommentar-Marker `<!-- ai-review -->` vorhanden, id 5488613575). Nur Fixup-Commit 6f3f5095 (04:04:09Z, nach Review 03:49:03Z) geprüft, beide Runde-1-Findings abgehakt, keine neuen Probleme. Sammelkommentar in Place aktualisiert (reviewed, Behobene-Anmerkungen-Tabelle gefüllt, Review-Typ: Fixup-Nachweis), kurze 🟢-Bestätigungs-Review (id 5073942505, COMMENT) gepostet. Keine Labels angefasst.

## Erledigt
- Finding #1 (🔴 fixup.md:10): GraphQL-`reviewThreads`-Query unverändert aus dem Inline-Vorschlag übernommen; Query live gegen PR #1156 ausgeführt → liefert beide Thread-IDs mit `isResolved=true` + path (Threads wurden vom Fixup-Agent korrekt aufgelöst). Fix verifiziert.
- Finding #2 (🟡 ux.md:1): „(sources: SKILL.md step 4)" → „(sources: step 4)" im Diff bestätigt; PR-Body Rang-3-Zeile korrigiert („KERN ist in keiner UX-Phasen-Quelle verankert … nur frontend/DESIGN.md") — Body-Zeile 9 verifiziert. Fix verifiziert.
- Titel-Gate: „ci(prompts): add thread-resolve command, label ban, and trim ux sources" erfüllt Conventional Commits (Typ/Scope/engl./lowercase/≤72) → kein Rename.
- CI: precheck/verify/e2e (4 Shards) pass, nur der eigene review-Job pending → kein 🟢-Ausschluss.
- Sammelkommentar-Update per Write auf `.ai-memory/issue-1153-review-body.md` + `gh api --method PATCH issues/comments/5488613575 -F body=@<file>` (id unverändert, Landing verifiziert).

## Relevante Stellen
- `.github/prompts/fixup.md:10` — Thread-Lookup jetzt GraphQL-only (Query + isResolved-Skip + Hinweis „REST pulls/{pr}/threads does NOT exist").
- `.github/prompts/ux.md:1` — Quellen-Referenz „(sources: step 4)" = ux.md PROCEDURE-Schritt 4.
- `.ai-memory/issue-1153-fixup.md` — Fixup-Notiz (im Commit 6f3f5095): Gates grün (prettier, test:scripts 251, frontend 491), Knip-Rot pre-existing per Stash-Gegenprobe.

## Annahmen
- Fixup-Notiz-Angaben zu Gates (grün/pre-existing) nicht selbst rekonstruiert — Diff berührt nur Markdown-Prompts, Risiko minimal; Pattern entspricht MEMORY (Knip-Hints pre-existing, 2026-08-24).
- `closingIssuesReferences` liefert jetzt 1153 (zuletzt 0 bei Runde 1), obwohl der Body kein Closing-Keyword enthält — vermutlich aus Branch-Namen `ci/prompts-audit-1153-option-1`/Linking abgeleitet; Bewertung blieb wie in Runde 1 bei „PR-Beschreibung massgebend" (keine AK-Verifikation gegen Issue-Body durchgeführt).

## Verworfen
- Neue Kreuzverhör des Gesamtdiffs — MODE FIXUP VERIFICATION, nur Delta + offene Findings.
- Issue-1153-AK-Nachverifikation nach neuem Closing-Link — Runde 1 war „ohne Issue"; Kontinuität der Spezifikationsbasis (PR-Beschreibung) beibehalten.

## Offen
- `.ai-memory/issue-1153-review-body.md` ist Wegwerf-Artefakt (Sammelkommentar-Body) — NICHT committen; nur diese Datei hier ist die Phasen-Notiz.

## Nächster Schritt
- Workflow übernimmt (Labels/merge-Gate); kein Review-Follow-up nötig, keine offenen Findings.

## Fallstricke
- `-F body=@<datei>` bei `gh api PATCH` funktioniert (Dateiinhalt als Wert) — Rezept für künftige Sammelkommentar-Updates.
- GraphQL-Thread-Lookup braucht `-F n=` (Int), sonst Typfehler; Threads NIE per REST listen (Route existiert nicht).
