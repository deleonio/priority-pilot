# Issue 1134 — Review (Kreuzverhör, Runde 1), Stand 2026-08-30

**ERGEBNIS: VERDICT needs-fixup, Ampel 🟡.** Review ohne Issue (closingIssuesReferences = 0) → PR-Beschreibung ist massgebend. Marker `<!-- ai-review -->` fehlte → Kreuzverhör des kompletten Diffs (12 Workflow-Renames, 100% similarity, +16/-16 Doku/Config-Referenzen). Titel-Gate bestanden (kein Rename nötig).

## Erledigt
- Kompletten Diff gelesen (reine Umbenennung `cron.*`, keine Inhaltsänderungen in den Workflows).
- Repo-weites Grep nach alten Dateinamen (mit `(?<!cron\.)`-Lookbehind, weil `cron.cache-cleanup.yml` sonst `cache-cleanup.yml` false-positive matcht) → 13 echte Treffer ausserhalb `.ai-memory/`.
- Funktionalität jedes Treffers geprüft (Kommando vs. Kommentar): 4 funktionale `gh run list --workflow <alter-name>`-Skip-Guards + 9 kosmetische Kommentar/Report-Referenzen.
- Entscheidender API-Beweis: `gh run list --workflow cron.sync.guide.yml` → HTTP 404 (neue Datei noch nicht auf main), `--workflow claude-guide-sync.yml` → liefert Runs (alte Datei noch auf main). Nach Merge kehrt sich das um → Guards failen still.
- Review als Einzel-Review (event=COMMENT, Body-only — Inline-Anker unmöglich bei 100%-Similarity-Renames ohne Hunks) + Sammelkommentar erstellt (Marker Zeile 1).

## Relevante Stellen
- `.github/workflows/cron.sync.guide.yml:78` — `gh run list --workflow claude-guide-sync.yml` (Finding F1, funktional).
- `.github/workflows/cron.sync.spec.yml:70` — `gh run list --workflow claude-spec-sync.yml` (F1).
- `.github/workflows/cron.sync.adr.yml:70` — `gh run list --workflow claude-adr-sync.yml` (F1).
- `.github/workflows/cron.audit.prompt.yml:71` — `gh run list --workflow claude-prompt-audit.yml` (F1).
- Kosmetisch (F2): `cron.continue-sweep.yml:11,23,73`, `claude-pr-gate-merge.yml:60`, `06-claude-pr-documenter.yml:371`, `cron.cache-cleanup.yml:28`, `cron.architecture-optimization.yml:14,18`, `.github/scripts/analyze-test-suite.ts:719`, `cron.sync.guide.yml:17`.
- `.ai-memory/issue-*.md`-Treffer = historische Phasen-Notizen, bewusst NICHT angefasst (kein Finding).

## Annahmen
- Guard-Folge-Schadensbild: 404 → gh exit != 0 → `2>/dev/null || true` → `last_sha` leer → skip=false → Lauf auch bei unverändertem main. Kein Crash, nur stiller Wegfall der Dedup + nächtliche LLM-Kosten.
- `workflow_run`-Trigger referenzieren Display-`name:`-Felder (unverändert, da Dateiinhalte gleich) → keine Bruchstelle dort; Grep fand keine weiteren Kommando-Referenzen.
- CI-Checks nicht im Detail geprüft (needs-fixup unabhängig davon).

## Verworfen
- Inline-Kommentare im Review — GitHub braucht diff-Anker; reine Renames ohne Hunks haben keine positionierbaren Zeilen. Findings stattdessen mit file:line im Review-Body.
- `.ai-memory/`-Altreferenzen als Finding — historisches Protokoll, Umschreiben wäre Geschichtsfälschung.
- MEMORY.md-Eintrag — `(?<!cron\.)`-Grep-Falle ist generisch nützlich, aber noch kein wiederholter Fehler; Kriterium (strikt) nicht erfüllt.

## Offen
- -

## Nächster Schritt
- Fixup-Runde: F1 (4× `--workflow`-Argument auf neuen `cron.*`-Dateinamen) + F2 (9 kosmetische Referenzen); danach Fixup-Verifikation (Modus: alter-name-Grep muss leer sein außer `.ai-memory/`).

## Fallstricke
- Grep nach alten Workflow-Namen OHNE Lookbehind produziert false positives (`cron.X.yml` enthält `X.yml`).
- Fixup-Verifikation: `gh run list --workflow <neuer-name>` bleibt bis zum Merge 404 — das ist erwartbar, kein Gegenbeweis; Beweisführung läuft über den Code-Stand, nicht die Live-API.
- Sammelkommentar-Update in Runde 2 per Marker-Suche + PATCH (nicht neu erstellen); Finding-Nummern F1/F2 stabil lassen.
