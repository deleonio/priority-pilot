# Issue 1225 — Review (PR #1245), Stand 2026-09-06, 2. Fixup-Nachweis-Lauf → needs-fixup

**ERGEBNIS: needs-fixup (Fixup-Nachweis, Runde 2 ohne Fortschritt).** Marker `<!-- ai-review -->`
vorhanden (Sammelkommentar 5555806946, Stand 09:02:12Z, Status needs-fixup) → MODE Fixup-Verifikation.
Wieder KEIN `ai-fixup-decisions`-Kommentar (Fixup-Läufe crashten weiterhin / Runden-Deckel Runde 9 von 3,
Kommentar 5558231312), Code-Delta seit 09:02Z = **leer** (nur Memory-Commits `51be4798` Review-Notiz +
`3515c78e` leerer Fixup-Memory-Commit). Gegen Head `3515c78e` verifiziert: #1 hält, CI grün, Nits offen.
Sammelkommentar per PATCH aktualisiert (09:23:59Z). Verdict: needs-fixup.

## Erledigt
- MODE-Bestimmung: Marker-Suche korrekt auf `issues/1245/comments` (NICHT `pulls/1245/comments` —
  das sind Inline-Review-Kommentare, liefern 0 und hätten fälschlich Kreuzverhör ausgelöst).
- Delta-Scoping: Commits seit updatedAt 09:02:12Z = `51be4798` + `3515c78e`; `git diff --stat` dazwischen
  leer, kein Code-File. PR weiterhin OPEN (nicht gemergt; `b8c4bfe8` ist nur ein lokaler Merge im Runner).
- #1 gegen Head verifiziert: `git grep` auf `origin/ai/harness/1225` — `GroupDetail.test.tsx` 0 Treffer
  für imageUrl/groups-avatar/group=; `frontend/e2e/` 0 Treffer für `group-detail-head`;
  `GroupsSection.tsx:215` rendert GroupDetail mit `group`-Prop (produktiv da, ungetestet).
- CI Head `3515c78e`: check-runs 6 success / 5 skipped / 0 fail.
- Nits verifiziert: `unknown as`-Cast in migrate.test.ts noch da; openapi imageUrl weiterhin ohne
  maxLength; TestGroup in GroupsSection.test.tsx unverändert (Diff-Stand).
- Titel-Gate: `feat(groups): add group image via https url (#1225)` — CC-konform (typ(scope), englisch,
  lowercase, 52 ≤ 72), kein Rename.
- Sammelkommentar 5555806946 aktualisiert (Struktur inkl. Behobene-Anmerkungen-Historie #2 erhalten,
  Findings-Nummern stabil: #1 Blocker, #2-Rest, 3 Nits).

## Relevante Stellen
- `frontend/src/components/GroupDetail.test.tsx` — ohne `group`-Prop; hier oder in
  `frontend/e2e/groups.spec.ts` (Aufklappen + `.group-detail-head kol-avatar`) gehört der #1-Fix hin.
- `frontend/src/components/GroupsSection.tsx:215` — `<GroupDetail … group={group} />` (Implementierung
  selbst korrekt, nur Absicherung fehlt).
- `docs/spec/issue-1225.md` AK4-Vertrag „Liste UND Detailkopf" — Grundlage des Blockers.
- Sammelkommentar 5555806946 — der eine `<!-- ai-review -->`-Kommentar, per PATCH pflegen.

## Annahmen
- Grüne Check-Runs auf `3515c78e` sind repräsentativ (Delta seit grünem Run 34021557125 nur Memory).
- `3515c78e` ist ein leerer Commit (kein --stat-Output) — Absicht des gecrashten Fixup-Laufs, kein
  verlorenes Code-Delta (PR-Diff = letzter Review-Stand + bekannte menschliche Commits).

## Verworfen
- Neue Inline-Kommentare — #1/#2-Rest sind bereits in Threads verankert (3943490014, 3943490334);
  ohne Code-Delta wäre ein dritter Duplikat-Thread nur Spam (SKILL-Konsolidierungsprinzip).
- needs-human — #1 bleibt mechanisch fixbar, kein Produktentscheid (wie letzte Runde begründet).
- Erneute Voll-Kreuzverhör des PR-Diffs — MODE Fixup-Verifikation, kein neuer Cross-Examination-Pass.

## Offen
- #1 (Blocker) + #2-Rest (nicht blockierend) + 3 Nits — siehe Sammelkommentar 5555806946.
- Runden-Deckel erreicht (Runde 9 von 3): ein weiterer Fixup-Lauf wird erneut geblockt — der Mensch
  muss #1 selbst fixen oder den Deckel/Label-Weg freigeben.
- Wegwerf-Artefakte dieses Laufs, NICHT committen: `issue-1225-pr-diff.txt`, `issue-1225-body-now.md`,
  `issue-1225-analyse.md`, `issue-1225-review-comment.md`, `issue-1225-review-comment-new.md`.

## Nächster Schritt
- Fixup/Mensch: #1 fixen (AK4-e2e erweitern um Aufklappen + `.group-detail-head kol-avatar`-Assertion
  ODER GroupDetail-Vitest-Render mit `group`-Prop); #2-Rest-Härtungen (409-Pfad → `load()`, neutrale
  Klick-Zone) + Nits günstig mitnehmen.

## Fallstricke
- Marker-Suche für den Sammelkommentar NUR über `issues/{pr}/comments` — `pulls/{pr}/comments`
  (Inline-Reviews) liefert 0 und verführt zum falschen MODE.
- `gh api -F body=@file` überschreibt den Kommentar VOR jeder Verifikation — nie einen „Test-PATCH"
  mit Platzhalter-Body absetzen (passiert hier, sofort mit echtem Body wiederhergestellt).
- Karten-Mittelklick-Tests bleiben layoutfragil (s. #2-Rest b) — Detail-Höhenänderungen verschieben
  die Klickzone.
- Keine Labels anfassen — Workflow macht das selbst.
