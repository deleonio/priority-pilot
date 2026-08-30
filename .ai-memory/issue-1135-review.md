# Issue 1135 — Review (Kreuzverhör, Runde 1), Stand 2026-08-30

**ERGEBNIS: VERDICT needs-fixup, Ampel 🔴.** PR #1135 (Workflow-Rename, 31 Dateien) — KEIN Closing-Issue (closingIssuesReferences=0) → „Review ohne Issue", PR-Beschreibung massgebend; Autor verschiebt Referenz-Updates ausdrücklich auf „separaten PR oder nach Merge". Kein `<!-- ai-review -->`-Marker vorhanden → MODE=CROSS-EXAMINATION (Volldiff). Diff ist sauber schlank: 31 Dateien, +31/−31, nur je eine `name:`-Zeile + 1 Kommentar-Übersetzung (cron.update-dependencies.yml). Review-Inline-Kommentare gebündelt als EIN Review (event=COMMENT) gepostet, Sammelkommentar mit Marker angelegt.

## Erledigt
- Voll-Diff gelesen (`git diff origin/main...HEAD -M --name-status`): R097-R100-Renames + cron.cache-cleanup.yml als M; keine Content-Änderungen neben `name:`.
- Alte/neue `name:`-Mapping vollständig extrahiert (beide Seiten per Schleife über git ls-tree / Arbeitbaum).
- Blast-Radius an 2 Haiku-Recherche-Agenten delegiert (workflow_run/gh-CLI-Refs; Docs-Refs) — Ergebnisse selbst am Code verifiziert.
- Kontrakt-Test real laufen lassen: `node --import tsx --test .github/scripts/workflow-name-contract.test.ts` → **0 pass, 3 fail** (ENOENT auf alte Dateinamen + Phasen-Schema n/6 passt nicht mehr auf „00 Validate"). Root `pnpm test` enthält test:scripts (package.json:22-23) → CI verify auf dem PR ROT bestätigt (`gh pr checks 1135`: verify=fail).

## Relevante Stellen
- `merge-pr.yml:53` — `workflows: ['CI', '5/6 Review']` (workflow_run-Allowlist) veraltet; neu wären `['Verify', '05 Review']`. Kommentar :51-52 fordert exakte Übereinstimmung selbst.
- `merge-pr.yml:241-252` + `05-review.yml:441-443` — jq-Literale `.workflow == "CI"` / `"5/6 Review"` (Check-Buckets des Gates) ebenfalls veraltet → Gate zählt 0 Checks, merged nie.
- `.github/scripts/workflow-name-contract.test.ts:34-35` — REVIEW_FILE/GATE_FILE zeigen auf alte Dateinamen; :78+ Phasen-Schema-Test erwartet `<n>/<gesamt>`-Namen. Muss mit dem Rename mitwandern (Test-Pflege-Bedarf).
- `cron.resume-pipeline.yml:142-147` — PHASES-Tabelle mit 5 alten Dateinamen → `gh run list --workflow` leer → „Phase aktiv"-Skip + Soft-Abort-Fenster stumm falsch.
- `cancel-pr.yml:70` + `label-pr-review.yml:144` — `for wf in 05-claude-pr-review.yml 04-claude-implement.yml` → stale Runs werden nicht mehr abgebrochen.
- `cron.merge-prs.yml:110` — `gh workflow run claude-pr-gate-merge.yml` → Dispatch schlägt fehl.
- `cron.audit-prompts.yml:71`, `cron.sync-adr.yml:70`, `cron.sync-guide.yml:78`, `cron.sync-spec.yml:70` — Selbst-Referenzen auf eigene alte Dateinamen (last_sha/Dedup).
- Docs-Stale (vom Agent, nicht blockierend, Autor hat's deklariert): docs/pipeline-flow.md, docs/ci-architecture.md, .costs/SCHEMA.md:19,26, docs/kosten-baseline-912.md:3, docs/adr/0002,0004,0005,0007, .ai-knowledge/tdd-strategy.md:13, docs/spec/issue-734.md, docs/tailscale-exit-node.md, docs/kosten-optimierung-2026-08-26.md.

## Annahmen
- „gh run list --workflow <alter-Dateiname>" schlägt nach dem Rename fehl bzw. liefert nur Altdaten — nicht am Live-GitHub verifizert (keine Repos-Rechte für Experimente), aber konsistent mit gh-Auflösung über Workflow-Pfad und mit dem Kontrakt-Test-Kommentar („Umbenennen schaltet das Gate lautlos ab").
- Deferral „nach Merge" ist kein akzeptabler Schutz: der Follow-up-PR hinge selbst am kaputten Gate (merge-pr.yml feuert nicht mehr) → Referenz-Fixes gehören IN diesen PR.

## Verworfen
- needs-human — alle Findings sind konkret fixbar (Strings nachziehen), keine Produktfrage.
- Docs-Stale als blockierendes Finding — PR-Beschreibung deklariert den Aufschub explizit; nur als 🟡-Hinweis aufgenommen.
- Eigene Prüfung von renovate.json5 / session.test.ts-Altreferenzen (Agent nannte sie) — Kommentare/Docs, kein funktionaler Bruch, Zeitbudget.

## Offen
- Erwartete Fixups: F1 merge-pr.yml Allowlist+jq-Literale, F2 05-review.yml jq-Literale, F3 Kontrakt-Test migrieren (+ Phasen-Schema-Assertion an „00..06"-Namen anpassen), F4 resume-Pipeline PHASES, F5 cancel-pr+label-pr-review wf-Loops, F6 cron.merge-prs Dispatch, F7 sync/audit-Selbstrefs. Nummern in Sammelkommentar stabil.
- Review gepostet: id 5061632168 (event=COMMENT, 6 Inline-Kommentare F2/F4-F8 + F1&F3 im Review-Body). Sammelkommentar mit `<!-- ai-review -->`-Marker angelegt (normale PR-Comments-API).
- F1 konnte nicht inline verankert werden: merge-pr.yml ist im Diff R100 (reine Umbenennung, `name: Claude PR Gate & Auto-Merge` unverändert) → keine diffbaren Zeilen; F3-Datei liegt nicht im Diff → ebenfalls Body.
- Wegwerf-Artefakt `.ai-memory/issue-1135-collected.md` (Sammelkommentar-Quelle) NICHT committen.

## Nächster Schritt
- Fixup-Runde (MODE FIXUP VERIFICATION): `<!-- ai-review -->`-Sammelkommentar laden, nur Fixup-Diff + offene Findings F1-F7 abhaken, KEINE neue Kreuzverhör des Gesamtdiffs.

## Fallstricke
- Sammelkommentar existiert jetzt (Marker erste Zeile) → nächster Lauf ist FIXUP VERIFICATION, nicht Kreuzverhör.
- Review-Inline-Kommentare altern mit dem Diff; Findings-Zählung (F1-F7) weiterführen, nicht neu nummerieren.
- Beim Fixup: Kontrakt-Test nicht löschen/wässern, sondern auf neue Namen migrieren — er ist genau der Schutz, der diesen Bruch gefunden hat.
- Title-Gate: „chore: rename all workflows with descriptive names" ist CC-konform (kein Rename nötig); kein Label setzen (Workflow macht das).
