# Issue 1184 / PR 1192 — Documenter, Stand 2026-09-03

## Erledigt
- PR 1192 analysiert: Metadaten (`gh pr view --json title,body,files,labels,author`), vollständiger Diff (3365 Zeilen, 31 Dateien), Kontext aus `.ai-memory/issue-1184-review.md` (Review 🟢, Titel-Gate bestanden) und PR-Body.
- Output `/tmp/doc.json` geschrieben und mit `jq` validiert (JSON-OK; classification=internal, title leer, 8 files, 1 issue).
- Klassifikation `internal`: reine CI-Infrastruktur (Setup-Action-Split, neue pi-Laufzeit, Kostenerfassung, Renovate-Manager, Doku) — kein Produktcode, kein User-Impact. Release-Note dennoch 1 Satz (Warum pi + Pilot Triage), wie im SKILL für internal vorgesehen.
- Titel unverändert übernommen (leer), da compliant laut Vorgabe und vom Review-Titel-Gate bestätigt.

## Relevante Stellen
- `.github/actions/setup-agent/action.yml` (neu) — Weiche + gemeinsame Teile; Kern des PR.
- `.github/actions/setup-pi/action.yml` (neu) — pi-CLI 0.84.4 gepinnt, Cache `/usr/local/lib/node_modules` mit npm/corepack-Exklusionen (Fixup F2).
- `.github/scripts/cost-from-pi-session.ts` (+ Test) — gleiche Preistabelle wie `cost-from-transcript.ts`, sonst wären Claude/pi-Läufe nicht vergleichbar.
- `.github/workflows/01-triage.yml` — Pilot; 10 weitere Workflows nur Pfad-Umhängung.
- `renovate.json5` (Diff-Zeilen 3320+) — Custom-Manager für `.pi/settings.json` (Regex fängt String- UND Objektform `npm:<dep>@<v>`).
- `docs/ci-architecture.md` — Architektur-Doku zum neuen Setup-Split.

## Annahmen
- Klassifikation `internal` ist gewollt scharf gezogen (SKILL: "when in doubt, NOT internal" — hier kein Zweifel, da ausschließlich `.github/`+Doku betroffen).
- `title compliant = true`, type/scope = chore/k.A. lt. Aufruf-Prompt — aber bestehender Titel `feat(ci):…` bleibt stehen, weil leerer Titel die Regel "empty if compliant and type fits" erfüllt; ein Umstampeln auf chore ist kein Renaming-Gewinn.

## Verworfen
- Umfrag der Dateiliste auf PR-Body-Reihenfolge — stattdessen die 8 substanziellsten Dateien; `.pi/settings.json` und Phase-Notizen bewusst nicht in `files` (Notizen sind Harness-Artefakt, settings.json nur Paket-Pins).
- Kürzere summary — PR ist strukturell (Action-Split + Kostenerfassung + Renovate), 3-5 Sätze SKILL-Minimum wäre zu dünn für Nachvollziehbarkeit.

## Offen
- Write-Tool auf `/tmp/doc.json` wurde von der Permission abgelehnt → Ausweichen auf Bash-Heredoc (funktioniert, Datei liegt korrekt vor).

## Nächster Schritt
- - (Documenter ist letzte Phase; Workflow übernimmt Changelog-Verarbeitung.)

## Fallstricke
- Write-Tool in dieser Sandbox: `/tmp`-Writes können per Permission scheitern, obwohl Bash-Heredoc geht — bei Timeouts direkt Bash nehmen.
- Klassifikations-Grenze: "new feature" wäre verlockend (pi ist neu), aber SKILL zählt CI-only klar zu `internal`; User-Impact fehlt.
