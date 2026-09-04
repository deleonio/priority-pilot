# Issue 1212 / PR #1215 — Review (Fixup-Nachweis Runde 4, FINAL), Stand 2026-09-04T12:40Z

**ERGEBNIS: VERDICT reviewed 🟢.** Der nach der menschlichen Übergabe (Fixup-Runden-Deckel, Bot-Kommentar 11:31:06Z) gepushte Commit 10b0d0ba „fix(groups): Gruppenkarte per Klick aufklappen" behebt Finding #2 vollständig und einzeln (sonst nur `.ai-memory/issue-1212-fixup.md`). Beide Blocker damit behoben (#1 → 33be8aec Runde 2, #2 → 10b0d0ba diese Runde), Rest-Nit bewusst offen. Sammelkommentar 5536676640 per PATCH aktualisiert (12:39:54Z): Status reviewed 🟢, #2 in ✅-Tabelle, Dialog-Test-Nit durchgestrichen, Review-Typ: Fixup-Nachweis. Titel CC-konform („feat(server): add group invitations and membership management", passt zu Type/Scope-Hint), kein Rename.

## Erledigt
- MODE: `<!-- ai-review -->` vorhanden → Fixup-Verifikation Runde 4.
- Claim-Checkliste (`<!-- ai-fixup-decisions -->` 5539372480, stand 10:52Z) hat KEINE Zeile für #2 (Fixup-Lauf hatte vor Nachweis-Pflege abgedauft/Deckel erreicht) → stattdessen Delta-Review: einziger Code-Commit seit updatedAt 11:25Z ist 10b0d0ba; direkt gegen Finding #2 verifiziert.
- 10b0d0ba geprüft (frontend/src/components/GroupsSection.tsx, app.css, groups-invitations.spec.ts, GroupDetail.test.tsx): Fix folgt exakt dem in Runde 3 vorgegebenen Pfad — onClick am li mit Guard `.group-detail, kol-button, kol-input-text, kol-dialog, button, a, input`; `cursor: pointer` nur auf neuer Klasse `.groups-item--expandable` (Einladungskarten teilen `.groups-item`, bleiben außen vor); Spec-Locators auf `.group-members`/`.group-received-invitations` gescopet, Klick-Zeilen unverändert (Vertrag nicht geschwächt).
- Bonus: 3 neue GroupDetail-Unit-Tests decken den Bestätigungsdialog (öffnen statt entfernen, bestätigen, abbrechen) → Nit aus Runde 1 erledigt.
- CI: alle Checks SUCCESS (e2e-Shards 1–4, verify, precheck); nur der laufende Review-Check pending. Keine neuen Probleme im Fix (Guard schließt Zuklappen-Falle und Shadow-DOM-Retargeting ein, Tastaturpfad bleibt der Namens-Button).

## Relevante Stellen
- `frontend/src/components/GroupsSection.tsx` (~Z. 152–177) — li-onClick + Guard, Kern des Fixes.
- `frontend/src/app.css` (~Z. 1261–1266) — `.groups-item--expandable { cursor: pointer; }`.
- `frontend/e2e/groups-invitations.spec.ts:86-137` — gescopete Locators (Strict-Mode-Doppel-Treffer durch aufgeklappte Karte/Dialog).
- `frontend/src/components/GroupDetail.test.tsx:99-156` — neue Dialog-Tests (Modal gemockt, `removeGroupMember` Spy).

## Annahmen
- CI-Grün auf Head (Merge-Commit) gilt für den Fix-Commit 10b0d0ba (alle Inhalts-Commits sind Vorfahren).
- Runde-1-Grundbefund („Server-Logik solide") unverändert übernommen — MODE verbietet Neu-Kreuzverhör.

## Verworfen
- Neue Inline-Kommentare — keine neuen Findings; #2-Thread discussion_r3933346873 bleibt historisch stehen.
- MEMORY.md-Eintrag — kein neues Fehlermuster (Crash-Abbrüche des Fixup-Loops sind bereits in früheren Einträgen/Fallstricken verankert).

## Offen
- -

## Nächster Schritt
- Workflow übernimmt (Labels/CI-Gate); PR #1215 ist inhaltlich fertig für `ai:ready-to-merge` sobald der Review-Check durchläuft.

## Fallstricke
- Falls der Mensch doch noch einen Fixup ordert: Nit „Selbst-Austritt für Nicht-Admins" ist bewusst NICHT beauftragt (kein AK).
- Die `<!-- ai-fixup-decisions -->`-Checkliste (5539372480) bleibt für #2 ohne Zeile — Beleg lebt im ai-review-Kommentar; nicht als Widerspruch werten.
