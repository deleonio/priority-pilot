# Issue 1135 — Review (Kreuzverhör R1 + Fixup-Nachweis R2), Stand 2026-08-30T19:5xZ

**ERGEBNIS R2: VERDICT reviewed, Ampel 🟢.** MODE=FIXUP VERIFICATION (`<!-- ai-review -->`-Marker vorhanden, Kommentar-Id 5470612385, Update per PATCH gepostet). F1–F7 alle in eb4c4747 behoben und am HEAD verifiziert; F8 (Docs-Stale) bleibt als nicht blockierender Autor-Deferral offen. Titel weiterhin CC-konform (kein Rename).

## Erledigt
- Fixup-Diff gelesen: eb4c4747 (`.github/`, 15 Dateien) + e5596629/65165c21 (nur `.ai-memory/`-Docs) + menschlicher Commit 3913dd3b (00-validate-issue.yml → 00-validate.yml, `name: 00 Validate` — GitHub-UI-Commit von deleonio, richtet sich selbst nach, passt zum NN-Schema).
- F1 merge-pr.yml:53 Allowlist `['Verify', '05 Review']` + :241-252 jq-Literale ✓; F2 05-review.yml:441-443 ✓; F3 Kontrakt-Test (REVIEW_FILE/GATE_FILE, Regex `^(\d\d)\s`, deepEqual-Sequenz :99 bleibt) ✓; F4 PHASES-Tabelle ✓; F5 cancel-pr:70 + label-pr-review:144 ✓; F6 cron.merge-prs:110 → `merge-pr.yml` ✓; F7 4 Selbstrefs ✓. Gate-Kollateral fixup-rounds.test.ts:24 → `04-implement.yml` mitgewandert.
- Kreuzcheck neue Literale gegen echte `name:`-Felder: verify.yml=`Verify`, 05-review.yml=`05 Review`, 00-06 alle `NN Titel` ✓.
- Stale-Ref-Grep am HEAD: nur noch Kommentare/Docs (F8-Klasse) — label-pr-review-Kommentare, actions/claude-workbench, unblock-issue, cron.sync-guide:314 etc., keine funktionalen Treffer.
- CI: `gh run list --workflow verify.yml` auf dem Branch → eb4c4747 **success**; Head 65165c21 (nur `.ai-memory/`-Docs) pending, e5596629 cancelled (Superseded) — kein funktionales Risiko.
- Sammelkommentar 5470612385 auf reviewed 🟢 aktualisiert (F1–F7 in Behobene-Anmerkungen-Tabelle abgehakt, F8 offen belassen, Footer „Review-Typ: Fixup-Nachweis").

## Relevante Stellen
- `.github/workflows/merge-pr.yml:53,241-252` — Gate-Allowlist + Check-Buckets (F1, behoben).
- `.github/workflows/05-review.yml:441-443` — Gate-Spiegel (F2, behoben).
- `.github/scripts/workflow-name-contract.test.ts:34-35,94-99` — Kontrakt-Test, migriert ohne Verwässerung (F3).
- `.github/scripts/fixup-rounds.test.ts:24` — Gate-Kollateral, mitgewandert (nicht als Finding gemeldet gewesen).
- `gh run list --workflow verify.yml` — CI-Beweisführung, wenn Sandbox kein tsx/pnpm hat.

## Annahmen
- Lokaler Kontrakt-Test-Lauf in dieser Sandbox nicht möglich (`ERR_MODULE_NOT_FOUND: tsx`, kein pnpm im PATH) — CI verify auf eb4c4747 ist der verlässliche Beleg; docs-only Commits danach ändern keinen Code.
- 3913dd3b (menschlich) braucht keine eigene Verifikation jenseits des Schemas — Name passt, kein Ref-Bruch entstanden (Grep `00-validate-issue` = 0 funktionale Treffer).

## Verworfen
- Neue Kreuzverhör des Gesamtdiffs — MODE FIXUP VERIFICATION, nur Fixup-Delta + offene Findings.
- F8 doch blockieren — Autor-Deferral steht in der PR-Beschreibung, R1 hat es ausdrücklich nicht blockierend eingestuft; reste nur Kommentare/Docs.
- MEMORY.md-Eintrag — kein neuer Fehler/eine Lösung (tsx-fehlende Sandbox ist bekannte Klasse).

## Offen
- F8 Docs-Stale beim Autor/Afolge-PR (nicht blockierend, im Sammelkommentar vermerkt).
- Wegwerf-Artefakte NICHT committen: `.ai-memory/issue-1135-collected-r2.md` (Quelle des Kommentar-Updates; das R1-Artefakt `issue-1135-collected.md` besteht ggf. fort).

## Nächster Schritt
- Phase abgeschlossen (verdict `reviewed` nach /tmp/claude-verdict geschrieben) — Workflow übernimmt Merge-Handling; F8 im Folge-PR abarbeiten.

## Fallstricke
- `gh pr view --json comments --jq '.databaseId'` lieferte leer — Kommentar-Id via `gh api repos/{owner}/{repo}/issues/1135/comments` holen.
- Review-Inline-Threads aus R1 sind laut Fixup-Notiz resolvt; F-Nummern bleiben stabil (F8 weitergeführt, nichts neu nummeriert).
