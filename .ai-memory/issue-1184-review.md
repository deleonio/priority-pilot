# Issue 1184 / PR 1192 — Review (Runde 1: Kreuzverhör, Runde 2: Fixup-Nachweis), Stand 2026-09-03

## Erledigt
- Runde 1 (Kreuzverhör): kompletter Diff-Review, 2 fixable Findings, Sammelkommentar angelegt, Titel normiert — Details im Git-Stand dieser Datei vor Runde 2 (Commit 28b24ead enthält die Runde-1-Fassung).
- Runde 2 (Fixup-Nachweis): MODE über `<!-- ai-review -->`-Marker (Kommentar 5520662229, updatedAt 2026-09-03T04:55:41Z) erkannt → KEIN neuer Voll-Review.
- Fixup-Delta sauber abgegrenzt: `git diff a84fb7d4..8a5f5410` war ZU BREIT (enthält den Main-Merge mit #1199 prompt-audit/costs-summary-Änderungen, die im PR-vs-main-Diff wegfallen). Echtes Delta = Commit 28b24ead allein: nur `.github/actions/setup-pi/action.yml` (12 Zeilen) + Phase-Notizen.
- F1 verifiziert behoben: PR-Body „Bewusst offen“ Nr. 3 (falsche „kein LSP-Paket“-Behauptung) gestrichen, neuer Nr. 3 = Rollout-Grenze; `.pi/settings.json`/pi-lsp-Änderung jetzt unter „Geänderte Dateien“ dokumentiert.
- F2 verifiziert behoben: `setup-pi/action.yml` Cache `path:` → `/usr/local/lib/node_modules` mit `!/…​/npm` + `!/…​/corepack`-Exklusionen (Include-vor-Exclusion = dokumentierte actions-cache-Semantik), Key `pi-cli-…-v2`. Keine neuen Probleme im Delta.
- CI gegenprobe: `gh pr checks 1192` — precheck/e2e ×4/verify pass, review pending (dieser Lauf).
- Sammelkommentar 5520662229 per PATCH aktualisiert (genau EIN ai-review-Kommentar, F1/F2 in „Behobene Anmerkungen“-Tabelle, Ampel 🟢, Footer „Review-Typ: Fixup-Nachweis“). Body-Datei: `.ai-memory/issue-1184-round2-body.md`.
- Titel-Gate: `feat(ci): add pi as switchable agent runtime (pilot: triage) (#1184)` erfüllt Conventional Commits — keine Änderung.
- VERDICT: reviewed (`/tmp/claude-verdict`).

## Relevante Stellen
- `.github/actions/setup-pi/action.yml` Z. 78-93 — Cache-Step nach Fixup; Kommentar begründet Ganzverzeichnis + npm/corepack-Exklusion.
- PR-Body-Abschnitte „Geänderte Dateien“ + „Bewusst offen“ — F1-Lösungsort (Body-Edit, kein Commit).
- `.ai-memory/issue-1184-fixup.md` — Fixup-Phase-Notiz (vom Fixup-Lauf geschrieben, Commit 28b24ead).

## Annahmen
- Der empirische Cache-Hit-Beweis (2. Lauf) ist wie AK 1/2/4 erst im Pilotlauf nach Merge möglich — als dokumentierte Offenheit akzeptiert, kein Finding (gleiche Einstufung wie Runde 1).
- Main-Merge 8a5f5410 bringt nur bereits auf main befindliche #1199-Änderungen in den Branch — für den PR-Diff gegen main neutral, deshalb nicht re-reviewt.

## Verworfen
- Erneute Voll-Findung-Suche über den 150-KB-Gesamtdiff — Fixup-Verifikation prüft nur Delta + Abgleich offener Findings (SKILL step 5).
- MEMORY.md-Eintrag — kein neuer Fehler/keine neue Erfahrung (Kriterium nicht erfüllt).

## Offen
- Wegwerf-Artefakte, NICHT committen: `.ai-memory/issue-1184-body.md`, `.ai-memory/issue-1184-harness.md` (0 Byte), `.ai-memory/pr1192.diff` (Runde 1) + `.ai-memory/issue-1184-round2-body.md` (Runde 2, PATCH-Body).

## Nächster Schritt
- - (Review abgeschlossen; Workflow übernimmt Merge-Entscheidung/Labels.)

## Fallstricke
- PR-Branch enthält Main-Merges: Diff-Range für Fixup-Runden MUSS über die PR-Commits (gh pr view --json commits) abgrenzt werden, nicht über `main..HEAD`-Blickpunkte — sonst re-reviewt man fremde Main-Commits.
