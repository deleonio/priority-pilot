# Plan: PR-Post-Merge-Documenter als LLM-Phase 6 (wie 01–05)

> **Gegen den lokalen Stand verifiziert (HEAD `bdc6ea3`, main).** Der Documenter-Workflow war falsch
> designed: 12-PR-Batch + deterministisches grep/Template statt LLM-Analyse. Er wird konsistent zu
> den Claude-Phasen 01–05 neu gebaut — **ein PR pro Lauf, LLM-Analyse der Codeänderung +
> PR-Beschreibung + Issue-Beschreibung, dann PR-Pflege via `gh`**. Dieses Dokument ist selbständig
> & vollständig formuliert, damit es ohne Session-Kontext wieder aufgreifbar ist.

## Hintergrund (was bisher schief lief)

Der Documenter `.github/workflows/pr-post-merge-documentation.yml` hatte drei aufeinanderfolgende
Fehlerklassen, die alle aus dem falschen Grunddesign (Batch + deterministisch) folgten:

1. **`accepts at most 1 arg(s), received 2`** — `gh pr edit --add-label "${labels_to_add[@]}"`
   expandierte das Array zu zwei positionalen Args. Behoben (Runde 1) per Komma-Join.
2. **Überschreiben gepflegter PR-Bodies** — das starre Template zerstörte mühsam geschriebene
   Beschreibungen. Behoben (Runde 2) per „nur überschreiben wenn Body < 50 Zeichen".
3. **`'release:fix' not found`** — Phase 0 legte nur `ai:documented` an, nie die fünf `release:*`-
   Labels; `gh pr edit --add-label` crasht hart auf fehlendem Label. Behoben (Runde 3) per
   `create_label()`-Helper + Entkopplung von `ai:documented` und `release:*`.

**Erkenntnis:** Symptombehebung am falschen Design. Der Architekturfehler war nie vom User
angefragt: die 12-PR-Batch kam ad-hoc aus dem ursprünglichen Commit `cd99bec`. Der User stellte
zurecht infrage, dass der Workflow **alle** PRs durchgeht statt des einen gemergten — und dass keine
LLM-Analyse stattfindet, obwohl AGENTS.md Phase 6 eigentlich deterministisch hält (was der User
jetzt ändert).

## Deliverable (dieser Schritt)

Vollständiger Neubau des Workflows + Anpassung der beiden statischen Tests + AGENTS.md-Doku.
Ergebnis: Phase 6 verhält sich strukturell wie die Claude-Phasen 01–05 (Setup-Action, Inline-Prompt,
`claude -p`, Memory-Load/Save, App-Token) — nur dass sie **nicht am Label-Trigger**, sondern am
`pull_request:[closed]`-Merge-Event hängt und **terminale** Pflegearbeit (Titel, Body, Release-Note,
Labels) statt Review/Verdict leistet.

## Dateien

| Datei                                                           | Aktion                                                          |
| --------------------------------------------------------------- | --------------------------------------------------------------- |
| `.github/workflows/pr-post-merge-documentation.yml`             | **kompletter Neubau** (Single-PR + Claude)                      |
| `.github/workflows/pr-post-merge-trigger.test.ts`               | Batch-/Query-/MAX_PRS-Tests löschen, Trigger-Tests anpassen     |
| `.github/workflows/pr-post-merge-documenter-robustness.test.ts` | Batch-Tests löschen, neue LLM-Setup-Tests                       |
| `AGENTS.md`                                                     | Phase-6-Zeilen (L43–46 Prosa + L66 Tabellenzelle) aktualisieren |

## 1. Trigger & Single-PR (kein Batch mehr)

- Trigger bleibt `pull_request: [closed]` + `workflow_dispatch`.
- `workflow_dispatch`-Input wird **`pr-number`** (für Single-PR-Catch-up), nicht mehr `max-prs`.
  Der manuelle Pfad löst den PR per `gh pr view <pr-number>` auf; der Merge-Guard greift nur im
  `pull_request`-Event (nicht bei Dispatch).
- `concurrency.group` wird pro-PR keyed:
  `pr-post-merge-documentation-${{ github.event.pull_request.number || github.event.inputs.pr-number }}`
  — kurz hintereinander gemergte PRs parallelisieren statt serialisieren.
- **Keine `/search/issues`-Such-Query, kein `MAX_PRS`, kein Loop.** PR-Daten aus
  `github.event.pull_request` (`.number`, `.title`, `.body`, `.labels[].name`, `.user.login`) bzw.
  via `gh pr view`/`gh pr diff` des EINEN PRs. Bei `workflow_dispatch` ausschließlich via `gh pr view`.

## 2. Claude-Setup (wie 01–05)

- `actions/checkout@v4` (`fetch-depth: 0`, `persist-credentials: false`).
- `uses: ./.github/actions/setup-claude` mit:
  - **`tools-tier: review`** — Claude hat Bash für `gh pr edit`/`gh pr comment`/`gh label`, aber
    **kein `Write`/`Edit`**. PR-Pflege läuft via gh-Befehle, Claude braucht keine direkte
    Dateimutationsmacht. Minimal-Privileg (AGENTS.md).
  - `model: ${{ vars.CLAUDE_MODEL_DOCUMENTATION }}` (neue Phasen-Variable, Default `sonnet` —
    Pflegearbeit, kein tiefes Reasoning; Namensschema wie `CLAUDE_MODEL_TRIAGE` etc.).
  - `event-type: ${{ github.event_name }}`, `ticket-ref: ${{ github.event.pull_request.number }}`,
    App-Secrets (`APP_ID`, `APP_PRIVATE_KEY`), Provider-Inputs (`LLM_PROVIDER`, `ZAI_API_KEY`,
    `CLAUDE_API_KEY`, `OPENROUTER_API_KEY`, Settings-JSONs) — identisch zu `04-claude-pr-review.yml`.
  - `memory-load: 'true'` (liest Ticket-Memory der vorigen Phasen, die in
    `.claude/ticket-memory/phase-*.md` liegen).
- Permissions: `contents: read` (kein Commit mehr — Claude ändert PR-Metadaten via gh, nicht den
  Repo-Inhalt), `pull-requests: write`, `issues: write`, `actions: write` (Cache-Drain),
  `id-token: write` (App-Token).

## 3. Phase-0-Label-Sicherung (Runde-3-Fix, bleibt deterministisch)

Ein Vorbereitungs-Step **vor** dem Claude-Aufruf legt alle benötigten Labels idempotent an:
`ai:documented` + die fünf `release:*` (`release:breaking-change`, `release:feature`,
`release:improvement`, `release:fix`, `release:engineering`) + `release:ignore`. Übernommen aus dem
Runde-3-Fix — LLM oder nicht, `gh pr edit --add-label` crasht sonst hart. Bleibt als
`create_label()`-Helper in Bash, **nicht** im LLM-Prompt.

## 4. LLM-Prompt (inline Heredoc, wie 01–05)

Inline-Heredoc nach `/tmp/claude-prompt.txt`, `sed`-Ersetzung von `#PR_NR` und `SOFT_DEADLINE`.
Aufruf:

```bash
${{ steps.setup.outputs.invoke-cmd }} "$(cat /tmp/claude-prompt.txt)" \
  ${{ steps.setup.outputs.invoke-args }} \
  2>&1 | tee /tmp/claude-output.log
test "${PIPESTATUS[0]}" -eq 0 || exit "${PIPESTATUS[0]}"
```

**Prompt-Inhalt:**

- **Rolle:** „Du bist der PR-Documenter. Pflege Titel + Beschreibung des soeben gemergten PR #N."
- **Inputs (liest Claude selbst, nicht im Prompt):** `gh pr diff`, `gh pr view --json files`,
  aktuelle PR-Beschreibung, verlinkte Issue-Beschreibung (`gh issue view`).
- **Aufgaben:**
  1. PR-Titel prüfen/optimieren — Conventional Commits, Scope aus Hauptdatei, Klassifikation
     `breaking|new|improved|fixed|internal`.
  2. PR-Beschreibung erstellen/verbessern — **nur wenn dünn** (weniger als ~50 Zeichen). Gepflegte
     Bodies bleiben unangetastet (Runde-2-Schutz).
  3. Release-Note-Kommentar posten.
  4. `ai:documented` + passendes `release:*`-Label setzen.
- **Output-Format:** `VERDICT:` wie die anderen Phasen.
- **Constraints:** Mobile-First, Conventional Commits, deutsche + englische Sektion, keine
  Spekulation, KEINE Dateiänderungen (nur via gh).
- **Ticketspezifisches Gedächtnis:** Lies `.claude/ticket-memory/`, schreibe am Ende Erkenntnisse
  nach `phase-documentation.md`.

## 5. Ticket-Memory-Abbau (bleibt deterministisch)

Cache-Drain (`gh cache delete` auf `ticket-<ref>-`) als deterministischer Step **nach** dem
Claude-Aufruf — terminal, braucht kein LLM. Issue-Auflösung wie `setup-claude`: Closing-Issue,
sonst PR-Nummer als Fallback (passt zum Cache-Key). Best-Effort (`|| true`).

## 6. Memory-Save (wie 01–05)

`actions/cache/save@v4` mit `steps.setup.outputs.memory-path`/`memory-save-key`,
`if: always() && steps.claude.outcome == 'success'`.

## 7. Label-Post-Assertion (wie 04, vereinfacht)

Erfolgs-Kriterium des Documenter ist nicht ein Review-Verdict, sondern dass **`ai:documented` am PR
hängt**. Nach dem Claude-Aufruf: PR-Labels prüfen, wenn `ai:documented` fehlt → harter Fehler
(Claude hat nicht gearbeitet). `release:*` bleibt best-effort (`|| true`), da das LLM es im
Grenzfall nicht sicher zuordnet.

## 8. Tests

**Löschen (Batch-spezifisch):**

- `pr-post-merge-trigger.test.ts`: Such-Query-Invariante, MAX_PRS-Default (Z.102–107), Search-API-
  GET-only (Z.117–127).
- `pr-post-merge-documenter-robustness.test.ts`: Phase-0-Search-Guarding (Z.80–88),
  pr_count-Guarding (Z.132–139), pr_count==0-Pfad (Z.143–150).

**Beibehalten (Regession-Guards):**

- Trigger an echten Merge gekoppelt (`workflow_run` weg, `pull_request:[closed]` + `merged == true`).
- `workflow_dispatch`-Catch-up-Pfad existiert.
- `set -euo pipefail` bleibt (AK2-Regression-Guard aus Issue #519).
- `grep -vE`-Fail-Tolerance (Issue #532).
- `--add-label`-Komma-String, kein Array / keine Mehrfach-Args.
- Ticket-Memory-Drain (`gh cache delete`, `actions: write`).
- Phase-0-Label-Sicherung (Runde-3-Fix): alle `release:*` werden angelegt.

**Neu (LLM-spezifisch):**

- Workflow ruft `uses: ./.github/actions/setup-claude` auf.
- Workflow enthält `claude -p`-Aufruf (via `invoke-cmd`).
- `concurrency.group` ist pro-PR keyed (`.number`).
- `workflow_dispatch`-Input ist `pr-number`, nicht `max-prs`.
- Workflow referenziert `vars.CLAUDE_MODEL_DOCUMENTATION`.

## 9. AGENTS.md-Anpassung

- **Zeile 43–46 (Prosa):** „Die 6. Phase **PR-Documenter** läuft NACH dem Merge rein deterministisch
  per Skript (kein LLM)" → „läuft NACH dem Merge als LLM-gesteuerte Phase (wie 01–05)".
- **Zeile 66 (Tabelle):** „— (deterministisch, kein Agent-Prompt)" → Verweis auf
  [ticket-implementation.md](.ai-knowledge/ticket-implementation.md) bzw. eigene Wissensbasis (falls
  angelegt). Spalte „Wissensbasis" wird konsistent gefüllt.

## 10. Validierung

```bash
pnpm dlx tsx@4.22.4 --test ".github/workflows/pr-post-merge-"*.test.ts ".github/workflows/workflow-"*.test.ts
pnpm format
pnpm lint
```

Alle drei in der PR-Beschreibung dokumentieren (AGENTS.md-Kernregel).

## Was UNVERÄNDERT bleibt

- Der `pull_request:[closed]`-Trigger + Merge-Guard (Issue #496) — nur die **Verarbeitung** wird
  von Batch auf Single-PR umgebaut.
- Die `ai:documented`-Idempotenz-Invariante (bereits dokumentierte PRs werden nicht erneut
  bearbeitet — jetzt konstruktiv, weil der Trigger ohnehin pro-PR feuert).
- Ticket-Memory-Drain, App-only-Token, Provider-Toggle (`vars.LLM_PROVIDER`).

## Scope-Grenze (ehrlich)

- **Keine eigene Wissensbasis-Datei für Phase 6** in `.ai-knowledge/` in diesem Schritt — der Prompt
  ist inline im Workflow, wie bei 01–05. Eine `ticket-documentation.md` wäre nur nötig, wenn die
  Phase von anderen Agent-Workflows wiederverwendet würde; sie ist terminal.
- **Keine automatische Issue-Beschreibungs-Pflege** — Claude _liest_ die Issue-Beschreibung als
  Kontext, ändert sie aber nicht (Issue-Ownership liegt bei Triage/Spec).
- **`release:ignore`-Labeling für Bot-PRs** bleibt als expliziter Pfad im Prompt (Claude erkennt
  Dependabot/Renovate am Autor + Diff-Muster), nicht als eigener deterministischer Step.
