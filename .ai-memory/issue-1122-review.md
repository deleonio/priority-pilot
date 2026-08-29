# PR 1122 — Review (Kreuzverhör Runde 1 + Fixup-Nachweis Runde 2), Stand 2026-08-29

**ERGEBNIS Runde 2: VERDICT reviewed (🟢).** Marker vorhanden → FIXUP VERIFICATION. Delta = Commit `21ddfc6f` (Fixup) + `5dbbef42` (nur Phase-Note) + Merge `37b0f6b5`; F1+F2 im Delta verifiziert, keine neuen Probleme. Sammelkommentar 5462044979 per PATCH auf reviewed gesetzt (Review-Typ: Fixup-Nachweis). **Titel-Gate: 73 Zeichen > 72 (Runde-1-Notiz „<72" war falsch gezählt) → umbenannt in `ci(pipeline): phase outputs live in the harness marker comment` (62).** Labels unangetastet.

## Erledigt (Runde 2)
- MODE per Marker-Suche bestimmt (PATCH-Ziel verifiziert: updatedAt stimmte mit Fixup-Notiz überein).
- Delta-Diff `git show 21ddfc6f` vollständig gelesen (5 Dateien, +172/−5).
- F2 verifiziert: `$#`-Guards `.github/scripts/harness-comment.sh:33-38`, Pflicht-Meldung („--repo und --issue sind Pflicht") deckt die Test-Regexes /--repo/ + /Pflicht/, 7 Tests in `harness-comment.test.ts` konsistent.
- F1 verifiziert: Upsert per HID `01-claude-triage.yml:355-365` (PATCH via REST-ID, sonst Anlegen — genau ein Marker); Happy-Case-Cleanup `:532-548` NACH `ai:analysed`-Ensure, nur bei `HAS_BLOCK=true` + `grep KI-ANALYSE:START` (idempotent, feuert `issues:[edited]` → Validator skippt per Label); Migrationspfad und Cleanup via HAS_BLOCK exklusiv; ADR 0009 um Upsert- + Happy-Case-Fall ergänzt.
- Keine neuen Probleme: Cleanup-awk identisch zum Legacy-Pfad (Range-bis-EOF bei malformedem Block = prä-existing), `BODY` wird nach dem Edit neu gelesen.
- PR-Titel gekürzt (73 → 62), Sammelkommentar ge-PATCH-t (F1/F2 in Behobene-Anmerkungen-Tabelle, Zeile 2 trägt „Review ohne Issue"-Hinweis).

## Relevante Stellen
- `01-claude-triage.yml:355-365` — F1-Upsert (HID → PATCH, else create).
- `01-claude-triage.yml:532-548` — Happy-Case-Cleanup (ADR-0009-Claim jetzt wahr).
- `harness-comment.sh:33-38` — F2-Guards; `:44` — Pflicht-Check (Meldung enthält Flag-Namen).
- `harness-comment.test.ts` — 7 Fälle, läuft über `pnpm test:scripts` (laut Fixup-Notiz grün, 251 script tests).

## Annahmen
- CI grün auf Fixup-Commit laut Fixup-Notiz (Runs 33250489645/33250489667); `gh pr checks` zeigte zum Review-Zeitpunkt nur noch den Trigger-Validierer (pass) — keine Fails gesehen.
- Beide Inline-Threads sind resolved (Fixup-Notiz nennt Thread-IDs PRRT_kwDONloM186dZgt5/gt9) — nicht erneut verifiziert.

## Verworfen (Runde 2)
- Neue Findings im Delta — keine gefunden (Commit-Titel-Typo „review-fundings" ist kosmetisch im bereits gepushten Commit, kein Fixup wert).
- MEMORY.md-Eintrag — Titel-Fehlzählung aus Runde 1 ist ein Einzelfehler, Kriterium (wiederholbarer Fehler/Transfer) nicht erfüllt.

## Offen
- Wegwarf-Artefakte NICHT committen: `issue-1122-diff.txt`, `issue-1122-pr-body.md`, `issue-1122-review-body.md`, `issue-1122-f1.md`, `issue-1122-f2.md`, `issue-1122-collected.md` (aktualisierter Sammelkommentar-Stand). Echte Notizen: diese Datei + `issue-1122-fixup.md`.

## Nächster Schritt
- keiner — Review abgeschlossen (reviewed); PR kann gemergt werden.

## Fallstricke
- Falls ein weiterer Fixup nötig wird: Sammelkommentar weiterhin per PATCH auf 5462044979, F-Nummern stabil, Review-Typ bleibt Fixup-Nachweis-Kette.
