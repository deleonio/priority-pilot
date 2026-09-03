# Issue 1202 — Review PR #1208 (Kreuzverhör, Runde 1), Stand 2026-09-03

## Erledigt
- MODE bestimmt: kein `<!-- ai-review -->`-Kommentar auf PR #1208 → Kreuzverhör (Erstreview).
- PR geladen: 1 Commit d1545b45, 1 Datei `frontend/e2e/issue-1186-popover-focus-outline.spec.ts` (+20/-4), Closing Issue = #1202 (auto-generierter Test-Optimierung-Report).
- AK-Quelle: KEIN `<!-- ai-harness -->`-Kommentar auf #1202 (jq lieferte 0 Bytes), einziger Issue-Kommentar = `<!-- ai-quality -->`-Bot. → Legacy-Fallback Issue-Body: Sektion 5/6 = ein kritisches Finding, AK = „AK3 ergänzen: Tab → expect(button).toBeFocused()" in genau dieser Spec-Datei.
- Kompletten Diff + vollständige Spec-Datei (211 Zeilen) gelesen; AK3-Block Zeilen 181-199 ist die Änderung (Tab-Schleife max. 15, toBeFocused timeout 150ms pro Versuch, klare Fehlermeldung).
- CI geprüft: e2e (4 Shards) + verify = pass, review = pending (dieser Lauf).
- Titel-Gate geprüft: `fix(e2e): AK3 in issue-1186 per echter Tab-Navigation prüfen` — Conventional-Commits-Format ✓, deutsches Subject = repo-etablierte Praxis (git log: „Ticket #1206 versiegelt" etc., gemergter Schwestern-Commit d1545b45 ebenfalls deutsch) → NICHT umbenannt; Umbenennung würde vom Commit-Titel des PR abweichen.

## Relevante Stellen
- `frontend/e2e/issue-1186-popover-focus-outline.spec.ts:181-199` — neue Tab-Schleife in AK3 (375px); ersetzt `button.focus()` (alt Zeile 184).
- `frontend/e2e/issue-1186-popover-focus-outline.spec.ts:19-21,25` — Doc-Kommentar aktualisiert: AK3 = echte Tab-Navigation, AK1/AK2 bleiben programmatisch (stimmt mit Code überein: :148/:184 alte AK2-Tests unverändert).
- `frontend/e2e/issue-1186-popover-focus-outline.spec.ts:62-67` — openActionsPopover klickt Trigger (Fokus steht danach auf dem Trigger, nicht auf dem Toolbar-Button — wichtig für Frage, ob Erst-Tab wegbewegt).
- PR-Body behauptet Muster-Analogie zu `issue-930-transparent-backgrounds.spec.ts` (AK1) — Verifikation lief als Haiku-Subagent (Ergebnis: s. Unten).

## Annahmen
- CI-e2e-Shards liefen diese Spec-Datei mit (volle Suite, 4 Shards) und waren grün → Tab-Schleife erreicht den Button in ≤15 Tabs im Ist-Zustand reproduzierbar.
- Fokus-Startpunkt vor der Schleife = geklickter „Weitere Aktionen"-Trigger (Chromium click-focus), KoliBri-Popover autofokusiert beim Öffnen nicht (CI-grün stützt das).

## Verworfen
- Umbenennung des PR-Titels ins Englische — deutsches Subject ist etablierte Repo-Praxis, siehe Erledigt.
- Initial-Fokus-Guard (toBeFocused-Check vor erstem Tab) als Finding — Vorbild issue-930:341-353 hat ebenfalls keinen Guard; Guard-Muster der Modal-Specs (quick-capture:151, delete-dialog-focus:330) setzt einen erwarteten Initialfokus-Vertrag voraus, den es hier nicht gibt. Fehlerbild nur bei künftigem KoliBri-Autofocus (spekulativ). Im Sammelkommentar als geprüft-und-nicht-erhoben dokumentiert.
- „issue-930, AK1"-Zitat als falsche Referenz — 930s eigener Kommentar nennt „Spec issue-1004, AK1" als Ursprung; Zitat ist korrekt weitergereicht.
- MEMORY.md-Eintrag — kein neuer Fehler, Kriterium nicht erfüllt.

## Erledigt (Zusatz nach Befund)
- Subagent-Ergebnis: Retry-Loop-Präzedenz BESTÄTIGT (issue-930:341-353, identisch inkl. Kommentare; Varianten: issue-1118:300-307 40x-Loop, delete-dialog-focus:333-339 toPass(4000)). Guard-vor-Tab-Muster in 8 Modal-Specs, aber nicht im 930-Loop.
- Sammelkommentar erstellt + gepostet (`.ai-memory/issue-1202-review-comment.md` → issuecomment-5532044875), Einzigartigkeit per API-Filter verifiziert (count=1).
- VERDICT: reviewed 🟢 — AK erfüllt, mustergleich, CI grün, kein Test-Pflege-Bedarf.

## Offen
- -

## Nächster Schritt
- Keiner — Review abgeschlossen (🟢 reviewed). Sammelkommentar: issuecomment-5532044875 (genau 1 `<!-- ai-review -->` auf PR #1208 verifiziert). Verdict `reviewed` nach /tmp/claude-verdict geschrieben. Fällt der PR später durch CI/gate-merge auf ai:needs-changes zurück: Fixup-Verifikations-Runde lädt den Sammelkommentar per Marker und prüft nur das Fixup-Delta.

## Fallstricke
- Kein `<!-- ai-harness -->` auf #1202 — AK steht im Issue-Body (Report-Tabelle), nicht in einem Analyse-Block.
- Memory-Datei heißt issue-1202-review.md (Issue #1202), PR-Titel nennt issue-1186 — das ist die SPEZ-DATEI-Referenz (#1186 = ursprüngliches Feature), kein Verweisfehler.
- PR #1208 headRefName `claude/issue-1202-fix-158ojw`, base main, OPEN.
