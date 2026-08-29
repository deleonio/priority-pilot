# PR 1122 — Review (Kreuzverhör Runde 1), Stand 2026-08-29

**ERGEBNIS: VERDICT needs-fixup (🟡).** Kein `<!-- ai-review -->`-Marker vorhanden → CROSS-EXAMINATION; kein Closing-Issue (`closingIssuesReferences` = 0) → „Review ohne Issue - PR-Beschreibung ist massgebend", in Sammelkommentar Zeile 2 vermerkt. Review mit 2 Inline-Kommentaren gepostet (Review-ID 5057929801), Sammelkommentar 1× angelegt (Marker verifiziert). Titel konform (ci(pipeline): … lowercase, <72) — nicht geändert. Labels unangetastet.

## Erledigt
- Vollständigen Diff gelesen (1121 Zeilen, 23 Dateien; Kopie in `.ai-memory/issue-1122-diff.txt`, PR-Body in `issue-1122-pr-body.md`).
- MODE bestimmt (Marker-Suche leer), CI geprüft: alle Checks grün ausser review/verify (pending = dieser Lauf); Skipping-Jobs = nicht applicable.
- Neue Tests lokal ausgeführt: `npx tsx --test .github/scripts/resolve-phase-routing.test.ts` → 5/5 grün.
- Reader-Konsistenz-Recherche (Regression außerhalb des Diffs): `resolve-spec-skip.sh` nur von 01 mit `--block-file` gerufen (wird jetzt mit ANALYSIS=Kommentar gefüttert ✓), `02-claude-ux.yml` hat KEINE Body-Post-Assertion, `fixup.md`/`documenter.md` lesen keinen Issue-Body, `pr-image-strip.sh` liest PR-Body (unrelevant), `verify-issue-quality.sh` hat REPO/ISSUE-Variablen vor dem neuen `gh issue view --json labels`-Aufruf ✓. Kein unkonvertierter Body-Leser gefunden.
- Findings F1/F2 als gebündeltes Review (event=COMMENT) + Sammelkommentar gepostet.

## Relevante Stellen
- `.github/workflows/01-claude-triage.yml:339` — Migations-Bedingung `HAS_BLOCK != true`: Migration läuft NUR im Agent-Fehlerpfad → F1.
- `.github/workflows/01-claude-triage.yml:353` — blindes `gh issue comment` kann zweiten Marker-Kommentar anlegen, wenn schon ein blockloser existiert (Teil von F1).
- `.github/scripts/harness-comment.sh:33` — `--repo) REPO="$2"; shift 2` ohne `$#`-Guard → unbound-$2-Crash Exit 1 statt dokumentiertem Exit 2 (F2).
- `.github/scripts/resolve-phase-routing.sh:97-107` — Quellen-Kaskade Kommentar→Body, fail-open — durch neuen Test gesichert.
- `docs/adr/0009-issue-storage-harness-kommentar.md` — „migriert jeden Analyse-Block" (Begründung) = Claim, den der Code so nicht hält (F1).

## Annahmen
- `gh issue view --json comments` `.id` = GraphQL-Node-ID (für `updateIssueComment`) — gh-Konvention, nicht im Lauf verifiziert.
- Duplikat-Marker-Szenario (F1b) ist selten (benötigt vorab blocklosen Marker-Kommentar), aber realistisch über abgebrochene Läufe — als Randkante im Finding genannt, nicht als hartes 🔴.
- Doppel-Harness-Kommentar-Happy-Path: Re-Triage eines Legacy-Tickets schreibt Kommentar, Body-Block bleibt stehen (hlerisch kosmetisch, alle Maschinen-Leser bevorzugen Kommentar).

## Verworfen
- UI-Audit/Mobile-first/KoliBri-Check — reiner CI/Docs-PR, kein `frontend/`-Code.
- Prä-Existing Lücke (UI-Bezug/KLASSE/Spec-Skip werden im Migrationspfad NICHT neu geparst) als Finding — Verhalten identisch zum Zustand vor dem PR (alte Self-Heal-Logik ebenso), keine vom PR eingeführte Regression.
- `--id`-Modus von harness-comment.sh als Finding — Kopf dokumentiert explizit „REST-ID", aktuell kein Konsument.
- MEMORY.md-Eintrag — F2 deckt bereits den Memory-Eintrag 2026-08-24 (shift-2-Muster); kein neues Kriterium erfüllt.

## Offen
- Fixup-Runde: F1 (Happy-Case-Cleanup ODER Claim-Korrektur in PR-Body+ADR 0009; Upsert per HID statt blindem Anlegen) + F2 (`$#`-Guard in harness-comment.sh). Danach FIXUP-VERIFICATION (Sammelkommentar vorhanden, updatedAt als Diff-Grenze).
- Wegwerf-Artefakte, NICHT committen: `issue-1122-diff.txt`, `issue-1122-pr-body.md`, `issue-1122-review-body.md`, `issue-1122-f1.md`, `issue-1122-f2.md`, `issue-1122-collected.md`. Nur diese Datei hier ist die Phasen-Notiz.

## Nächster Schritt
- Fixup-Agent: F1+F2 umsetzen; danach Review-Neuaufruf → MODE FIXUP VERIFICATION (nur Delta seit Sammelkommentar-updatedAt + Findings abhaken).

## Fallstricke
- Sammelkommentar NICHT neu anlegen — Marker vorhanden, per PATCH (gh api issues/comments/<id>) updaten; Finding-Nummern F1/F2 stabil lassen.
- F1-Behebung „Body-Cleanup im Happy-Case" darf den Validator nicht rot machen: Cleanup feuert auf `issues: [edited]` — Skip greift via `ai:analysed`-Label (deshalb wurde der Label-Skip in diesem PR gebaut; Reihenfolge Cleanup-nach-Label-Check beachten).
- Review-Inline-Kommentare sind am Diff verankert und altern mit neuen Commits — bei Fixup ggf. neu verankern.
