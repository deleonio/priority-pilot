# Review-Notizen PR #1065 (Phase 5, Kreuzverhör Runde 1, 2026-08-27)

## Erledigt
- MODE bestimmt: kein `<!-- ai-review -->` Kommentar vorhanden → Kreuzverhör (Erstrunde).
- Volle Diff gelesen (+2/−2, 2 Dateien): `.github/prompts/spec.md:25`, `.claude/skills/ticket-spec/SKILL.md:54` — Spec-Draft-PR-Titel = Issue-Titel 1:1 + `(#<nr>)`.
- Closing-Issue-Check: `closingIssuesReferences | length` = 0 → „Review ohne Issue", PR-Beschreibung ist massgebend.
- PR-Body-Behauptungen verifiziert:
  - „Gate/Labeler matchen den Titel nicht": `claude-pr-gate-merge.yml` kennt keinen Titel-Match (nur `::error title=`-Annotationen); `claude-pr-gate-sweep.yml:83-115` liest `.title` nur für die Summary-Tabelle.
  - TITLE GATE ist beratend: `05-claude-pr-review.yml:260` („Titel-Fakten") + `.github/scripts/pr-doc-facts.sh --mode title-only` füttern `{{TITLE_OK}}`/`{{SUGGESTED_TYPE}}` in den Review-Prompt; bewusst kein eigener roter CI-Check (Kommentar in der Workflow nennt die Fixup-Sackgasse).
  - ADR 0001 (`docs/adr/0001-github-workflows-bleiben-ungetestet.md`): nur Anwendungscode wird getestet → testlose Änderung gerechtfertigt.
  - `03-claude-spec.yml:221-224` lädt spec.md per `sed` als Datei → keine YAML-Einbettungs-/Zeilenumbruchrisiken.
- Titel-Gate THIS PR: `chore(ci): spec draft PR titles follow the issue title` = konform (typ(scope), englisch, lower-case, ≤72) → kein Rename.
- Sammelkommentar (🟢 reviewed) als `<!-- ai-review -->`-Kommentar posted.

## Relevante Stellen
- `.github/prompts/spec.md:25` — geänderte Zeile: Draft-PR-Titel-Regel (CI-Phase 3).
- `.claude/skills/ticket-spec/SKILL.md:54` — Pendant für lokale Läufe.
- `.github/prompts/review.md:25` — TITLE GATE (benennt Nicht-CC-Titel vor dem Merge um; dadurch ist der deutsche Issue-Titel im Draft nur ein Übergangszustand).
- `.claude/skills/ticket-implementation/SKILL.md:59` — Direct-Mode-Fallback nutzt weiterhin freies `<title>` (bewusst nicht Teil dieses PR; Review-Gate korrigiert).

## Annahmen
- `pnpm format/lint` grün laut PR-Body; lokal nicht verifizierbar (Sandbox ohne pnpm/node_modules) — CI-verify obliegt dem Gate.
- CI war zum Review-Zeitpunkt neutral/pending (verify, e2e, review liefen), nichts rot.

## Verworfen
- Finding gegen `ticket-implementation/SKILL.md:59` (freier `<title>` im Direct Mode): ausserhalb des bewusst engen Scopes; TITLE GATE korrigiert vor dem Merge; kein Blocker, bloss Beobachtung im Review-Body erwähnt.
- Finding gegen Sprachregel `docs/ci-architecture.md:415` (PR-Titel englisch/CC) vs. deutscher Issue-Titel: Übergangszustand bis zum Review-Rename, im PR-Body dokumentiert und kohärent (Merge-Commit-Subject entsteht erst nach Umbenennung).

## Offen
- -

## Nächster Schritt
- Falls Fixup gepusht wird: MODE Fixup-Nachweis — nur Delta seit Kommentar-`updated_at` prüfen, Sachverhalte hier nicht neu verhandeln.

## Fallstricke
- Keine Labels setzen (Workflow macht das selbst).
- Verdict-Kanal-Reihenfolge: erst Sammelkommentar, dann `/tmp/claude-verdict` + letzte Output-Zeile.
