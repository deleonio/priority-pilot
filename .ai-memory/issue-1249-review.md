# Issue 1249 — Review (Phase 5, Kreuzverhör R1 + Fixup-Nachweis R2), Stand 2026-09-06

**ERGEBNIS R2: VERDICT reviewed (Ampel 🟢).** Fixup-Verifikation: `<!-- ai-review -->`-Marker
(issuecomment-5558699390) vorhanden → FIXUP VERIFICATION. Beide Claim-Zeilen des
`<!-- ai-fixup-decisions -->`-Kommentars (5558759592) gegen den Fixup-Diff `8ec90621` verifiziert,
Sammelkommentar per PATCH auf reviewed 🟢 aktualisiert (ID unverändert). Kein Code geändert, nichts
committet.

## Erledigt
- Runde 1 (Kreuzverhör): siehe Git-Historik dieser Datei — Kern: AK1–AK6 grün verifiziert
  (4/4 + 18/18 Tests, tsc clean), **Finding #1** (Blocker: AK7-SQL im PR-Body snake_case, Schema
  camelCase) + **Finding #2** (Nit: falsche NOT-NULL-Begründung für `pillars.userId`); PR-Titel auf
  Conventional Commits umgestellt. Inline-Review 5125085793.
- Runde 2 (Fixup-Nachweis):
  - Claim-Zeilen geprüft: Fixup-Commit `8ec90621` ändert genau `.ai-memory/issue-1249-fixup.md`
    (neu), `.ai-memory/issue-1249-implement.md` (Verifikations-Claim präzisiert),
    `server/src/logics/pillarContributions.ts` (nur Kommentarzeilen 64-72, kein Code).
  - **#1 behoben:** PR-Body-AK7-SQL (jetzt Zeilen 44-58) nutzt `tp.taskId`, `t.userId`, `tp.pillarId`,
    `p.userId`, `sp.seriesId`, `s.userId` — matches R1-PRAGMA-Befund; `grep` auf `task_id|user_id|
    pillar_id|series_id` im Body: 0 Treffer.
  - **#2 behoben:** Kommentar `pillarContributions.ts:66-70` präzisiert („matcht nur die historischen
    NULL-owned Säulen, `pillars.userId` ist nullable"), NOT-NULL-Satz aus PR-Body + implement.md raus.
  - Delta nach `8ec90621`: `c8e7b181` + `ca5973b8` nur `.ai-memory/issue-1249-fixup.md` — keine neuen
    Befunde.
  - CI auf Head `ca5973b8`: verify pass, precheck pass, e2e pending (Diff ist kommentar-/doku-only,
    kein Verhaltensrisiko; Gate-Merge-Job entscheidet finales ai:ready-to-merge).
  - Titel-Gate: „fix(server): check pillar contributions against owning account (#1249)" erfüllt
    Conventional Commits (63 Zeichen, lowercase, englisch) — kein Rename.
  - Sammelkommentar 5558699390 per `gh api --method PATCH …/issues/comments/5558699390
    -F body=@…review-update.md` aktualisiert (Behobene-Anmerkungen-Tabelle gefüllt, Review-Typ:
    Fixup-Nachweis).

## Relevante Stellen
- `server/src/logics/pillarContributions.ts:64-72` — korrigierter Doc-Kommentar (Finding #2).
- PR #1255 Body „AK7 — Bestandsnachweis" (SQL-Block) — korrigierte camelCase-Abfrage (Finding #1).
- Sammelkommentar issuecomment-5558699390 (PATCH, nie neu anlegen); Fixup-Checkliste
  issuecomment-5558759592.
- Issue #1249 (closingIssuesReferences) — AK1-AK7 aus Harness-Kommentar, R1 verifiziert.

## Annahmen
- e2e-pending auf Head ist unkritisch: Fixup-Diff berührt keinen ausführbaren Code (Kommentar +
  Markdown); R1 hatte CI grün auf `f0524c1d`.
- Fixup-Claim „274/274 lokal grün" nicht selbst nachgerechnet — Delta-seit-R1 ist nicht-testbar
  (Kommentar), R1-Testläufe decken den Code ab.

## Verworfen
- Erneutes Voll-Kreuzverhör des PR-Diffs — Modus FIXUP VERIFICATION, nur Claim-Check + Delta.
- Eigener Testlauf in der Sandbox — kein verhaltensrelevanter Code seit R1 (Kommentar-only-Diff).

## Offen
- Wegwerf-Artefakte, NICHT committen: `.ai-memory/issue-1249-prbody-now.md` (Body-Spiegel),
  `.ai-memory/issue-1249-review-update.md` (PATCH-Body). Nur diese Datei ist die Phasen-Notiz.

## Nächster Schritt
- Keiner für die Review-Phase — PR parkt beim Workflow (Gate-Merge entscheidet mit e2e-Ergebnis).

## Fallstricke
- Sammelkommentar = issuecomment-5558699390 — weitere Runden PATCHen, nicht neu anlegen.
- Finding-Nummern #1/#2 bleiben stabil; beide sind jetzt in „Behobene Anmerkungen" historisiert.
- gh-PATCH-Body mit Markdown/Klammern immer via `--body-file` (MEMORY 2026-08-24).
