# Issue 1162 — Review (Kreuzverhör, Runde 1), Stand 2026-09-02

**ERGEBNIS: VERDICT reviewed, Ampel 🟢.** MODE = CROSS-EXAMINATION (kein `<!-- ai-review -->`-Marker vorhanden), 0 closing issues → „Review ohne Issue — PR-Beschreibung massgebend" (in Sammelkommentar Zeile 2 + Review-Body vermerkt). Renovate-Pin-PR: 6+/6− in 3 Cron-Workflows, kein Code.

## Erledigt
- Vollständigen Diff gelesen: `.github/workflows/cron.arc42.yml` (checkout@v4→SHA v4.4.0, setup-node@v4→SHA v4.4.0, node-version '26'→'26.8.1'), `cron.security-scan.yml` (codeql-action init+analyze v4.37.8→v4.37.9), `cron.update-dependencies.yml` (renovatebot/github-action v46.2.3→v46.2.5).
- Alle 4 Action-SHAs per `gh api repos/<repo>/git/ref/tags/<tag>` (annotated Tags dereferenziert) gegen Upstream-Tags verifiziert — alle MATCH.
- CI-Rollup geprüft: precheck/label SUCCESS, verify/e2e IN_PROGRESS, nichts rot → 🟢 zulässig (Gate degradiert ohnehin bei Rot).
- Titel-Gate: „chore(deps): pin dependencies" erfüllt Conventional Commits → kein Rename.
- Review als COMMENT (id 5085940587) gepostet; Sammelkommentar neu angelegt (`<!-- ai-review -->`, issuecomment-5504919198), Footer „Review-Typ: Kreuzverhör", Updated: 2026-09-02.
- Keine Labels gesetzt (Workflow-Verantwortung).

## Relevante Stellen
- `.github/workflows/cron.arc42.yml:28-31` — die neuen Pins (checkout 11d5960…, setup-node 49933ea…, node 26.8.1).
- `.github/workflows/cron.security-scan.yml:66,95` — codeql-action cdf488f… (v4.37.9) an init+analyze (beide Stellen konsistent).
- `.github/workflows/cron.update-dependencies.yml:112` — renovatebot/github-action 39b9141… (v46.2.5); Pin-Kommentar darüber („keine gleitenden Major-Tags") bleibt gültig.
- `.github/workflows/00-validate.yml:36` u. a. — Rest des Repos auf checkout v7.0.1 (SHA 3d3c42e…, gesetzt via #1135) gepinnt; Ursache der Drift, nicht des PRs.

## Annahmen
- Renovate pinnt bewusst innerhalb des bisherigen `v4`-Ranges (floating @v4 → v4.4.0), Major-Anhebung v4→v7 kommt als separater Renovate-PR (Tag-Kommentar `# v4.4.0` gibt Renovate die Version zum Aktualisieren) — Drift selbstheilend, deshalb Hinweis statt Finding.
- node 26.8.1 existiert (Renovate-Quelle actions/node-versions); cron.arc42 läuft nur schedule-basiert, CI prüft ihn nicht direkt — akzeptiert.

## Verworfen
- Drift checkout/setup-node v4.4.0 (Cron) vs. v7.0.1/ESM (Rest) als Fixup-Finding — kein Defekt dieses Diff, selbstheilend, würde eine Fixup-Runde für Renovate-Design verschwenden; nur als Hinweis im Review-Body dokumentiert.
- Einschränkung/Prüfung der Release-Notes-Inhalte (v46.2.5 ist Docker-Chores) — für Pin-Korrektheit irrelevant.

## Offen
- Wegwerf-Artefakte in `.ai-memory/`, NICHT committen: `issue-1162-review-body.md`, `issue-1162-sammel.md`. Nur diese Datei hier ist die Phasen-Notiz.

## Nächster Schritt
- Keiner seitens Review (verdict abgesetzt). Merge-Lauf: Gate prüft CI; danach üblicher Ablauf.

## Fallstricke
- Bei künftiger Fixup-Runde (falls doch): Sammelkommentar 5504919198 per PATCH updaten, nicht neu anlegen; Finding-Nummerierung startet leer.
- Der Drift-Hinweis ist bewusst KEIN offenes Finding — in einer Runde 2 nicht als vergessenes Finding werten.
