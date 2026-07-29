# Plan: Claude Code als alternativer Coding-Agent (togglebar via `vars.AGENT`)

> **Gegen den lokalen Stand verifiziert (HEAD `dcdaaa9`, post-Merge).** Architektur hatte sich
> während der Planung gedreht (Workflows wurden in eine `setup-hermes`-Composite-Action refactored);
> dieser Plan basiert auf dem **aktuellen** Stand, nicht auf den anfänglichen Reads.

## Deliverable (dieser Schritt — NUR Dokumentation, keine Code-Änderung)

Schreibe das untenstehende, verifizierte Konzept als **`plans/agent-toggle-plan.md`** ins Repo (neues Top-Level-Verzeichnis
`plans/`, neben `docs/`, Deutsch). **Keine** Workflow- oder
Code-Änderung in diesem Schritt — die Umsetzung (Erweiterung von `setup-hermes` + 5 Invoke-Schritten +
Doku-Updates) wird **später** separat auf Basis dieses Doks aufgenommen. Das Dokument wird
selbständig & vollständig formuliert (Architektur-Stand `dcdaaa9`, Entscheidung, Design, Scope,
Verification, Risiken), damit es ohne diesen Session-Kontext wieder aufgreifbar ist.

## Context

Die label-getriebene KI-Pipeline in GitHub Actions läuft über einen Coding-Agent auf dem **z.ai/GLM**-
Backend. Aktuell ausschließlich **Hermes**. Der User möchte **alternativ Claude Code** nutzen — gleiche
Prompts, gleiche Pipeline, nur die Agent-Runtime getauscht, gesteuert über eine GitHub-Variable.

Konsolidierte Setupschritte (Preflight, App-Token, Install, Provider-Config, MCP, Session-Restore,
Auth) wurden bereits in **`.github/actions/setup-hermes/action.yml`** zentralisiert; die 5 Workflows
rufen diese auf und konsumieren ihre Outputs (`provider-flag`, `model`, `resume-flag`). **Das ist die
Naht** für den Toggle — nicht ein Inline-Branch pro Workflow.

## Vom User geklärt

- **Mechanismus:** Toggle über GitHub-Variable `vars.AGENT` (`hermes` | `claude`), default `hermes`.
- **Backend:** z.ai/GLM weiter wie Hermes (`ZAI_API_KEY`, Endpoint `https://api.z.ai/api/anthropic`).
  **Kein neues Secret.** Claude-Code-CLI redet gegen denselben Anthropic-kompatiblen z.ai-Endpoint.

## Verifizierte Fakten (live + per Lese)

- **Claude-CLI 2.1.220** (lokal installiert): `-p/--print` ✅, `--dangerously-skip-permissions` ✅,
  `--model` ✅, `--allowedTools "Bash,Read,Write,Edit,Grep,Glob"` (komma-separiert, ohne eingebettete
  Quotes → output-tauglich) ✅, `claude mcp add --transport http kolibri <url>` ✅, `--resume`
  funktioniert mit `--print` ✅.
- **Alle 5 Workflows** (`hermes-triage/-spec/-implement/-pr-review/-pr-fixup.yml`) haben **byte-identische**
  Invoke-Schritte: `hermes chat -q "$(cat /tmp/hermes-prompt.txt)" ${{resume-flag}} -Q --yolo
${{provider-flag}} -m ${{model}} -t "terminal,file" --accept-hooks | tee /tmp/hermes-output.log`.
- **4 Logik-Workflows** (`-issue-unblock/-pr-cancel/-pr-conflict-scan/-pr-gate-merge`) haben keinen
  Agent → unangetastet.
- **`save-session`** grept `session_id:` aus dem Output + packt `$HERMES_HOME` → hermes-spezifisch; für
  Claude liefert es keine ID → graceful No-Op (keine Änderung nötig).
- **VERDICT-Vertrag executor-agnostisch:** Assertion grept `VERDICT:` aus `/tmp/hermes-output.log`;
  `claude -p` schreibt die finale Antwort (mit `VERDICT:`-Zeile) nach stdout → `tee` → grep greift.
- **Tempfilenamen** `/tmp/hermes-*.log|txt` bleiben (intern, kein Leak) → **kein Rename** (Churn im
  instabilen Tree minimieren).

## Design — Executor-Wissen zentral in `setup-hermes`

### 1. `setup-hermes/action.yml` erweitern (einzige Stelle mit Executor-Wissen)

Neuer Input `agent` (default `hermes`, im Workflow mit `${{ vars.AGENT }}` gefüllt). Die Install-/
Config-/MCP-/Resolve-Schritte verzweigen intern:

- **`agent=hermes` (default):** exakt heutiges Verhalten (Byte-Äquivalent).
- **`agent=claude`:**
  - `npm install -g @anthropic-ai/claude-code` (ubuntu-latest hat Node/npm vorinstalliert; optional
    `actions/setup-node` für Determinismus).
  - z.ai-Env ans Runner-Environment: `ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic` +
    `ANTHROPIC_API_KEY=$ZAI_API_KEY` → `$GITHUB_ENV`.
  - MCP (nur triage + implement): `claude mcp add --transport http kolibri https://public-ui-kolibri-mcp.vercel.app/mcp`.
  - **Auth-Check:** `ZAI_API_KEY` verlangen (selbes Secret wie hermes-zai — bestehende Logik reused).
  - **Session-Restore:** `resume-flag=` leer (Claude läuft frisch; s. Scope).

Neue/zusammengesetzte Outputs (statt der hartcodierten Invoke-Flags):

- `invoke-cmd`: `hermes chat -q` | `claude -p`
- `invoke-args`: hermes → `-Q --yolo ${{provider-flag}} -m ${{model}} -t terminal,file --accept-hooks`;
  claude → `--dangerously-skip-permissions --model glm-5.1 --allowedTools Bash,Read,Write,Edit,Grep,Glob[,mcp__kolibri__search,mcp__kolibri__fetch]`

(Die bestehenden Outputs `configured`, `gh-token`, `issue-number`, `session-artifact-name`,
`resume-flag` bleiben unverändert; `provider-flag`/`model` werden im hermes-Pfad weiter belegt.)

### 2. Pro Workflow (×5, identische kleine Änderung)

- `agent: ${{ vars.AGENT }}` als zusätzlicher Input ans `uses: ./.github/actions/setup-hermes`.
- Invoke-Schritt generalisieren (Hartcodiertes → Outputs), **ohne** if/else-Branch:
  ```bash
  cat > /tmp/hermes-prompt.txt << 'HERMES_EOF'      # Prompt IDENTISCH, unverändert
    …
  HERMES_EOF
  sed -i "s/#ISSUE_NR|PR_NR/…/g; s/SOFT_DEADLINE/…/g" /tmp/hermes-prompt.txt

  ${{ steps.setup.outputs.invoke-cmd }} "$(cat /tmp/hermes-prompt.txt)" \
    ${{ steps.setup.outputs.resume-flag }} \
    ${{ steps.setup.outputs.invoke-args }} \
    2>&1 | tee /tmp/hermes-output.log
  test "${PIPESTATUS[0]}" -eq 0 || exit "${PIPESTATUS[0]}"
  ```
- Prompt-Heredoc, sed, Label-Post-Assertion (VERDICT-grep), Save-Session, Zusammenfassung:
  **unverändert.**

### 3. Dokumentation (Spiegel-Stellen, Strahlungs-Awareness)

- `docs/ci-architecture.md`: neuer Abschnitt „Executor wählbar per `vars.AGENT` (Hermes ↔ Claude
  Code, beide z.ai/GLM)"; `vars.AGENT` in die Konfig-Tabelle; Claude-Install/Flags/VERDICT-Hinweis.
- `AGENTS.md` (L39 „agent-agnostisch"): nun faktisch wahr — optional ein Verdeutlichungs-Satz.
- Workflow-Header-Kommentare (×5): „Setzt Hermes **oder Claude Code** — wählbar per `vars.AGENT`."

## Was UNVERÄNDERT bleibt

Trigger, `concurrency`, `if`-Bedingungen, App-Token/Checkout/Cache, **Prompts** (inkl. VERDICT- &
Soft-Abort-Anweisung), **Label-Post-Assertion**, Label-Kette, Folge-Workflow-Trigger. **Hermes-Pfad
bleibt Byte-Äquivalent** (`vars.AGENT` ungesetzt) → null Regression.

## Scope-Grenze (ehrlich)

- **Claude ohne Session-Resume im First Cut:** `save-session`/`session-restore` sind hermes-spezifisch;
  Claude läuft frisch (analog ci-architecture „Named Session Resume aktuell nicht aktiv"). Wiedervernutzung
  für Claude = Folge-Task.

## Verification

- **Syntax:** Workflows per `actionlint` prüfen (lokal nicht installiert → in CI/dev oder `brew install
actionlint`; YAML/Expression-Validierung). Alternativ `yamllint`/GitHub-Workflow-Editor.
- **Hermes-Regression (Diff):** `vars.AGENT` ungesetzt → alle 5 Workflows + `setup-hermes` verhalten
  sich identisch; expandierter `invoke-cmd`/`invoke-args` im hermes-Pfad == heute.
- **Negativ-Kontrolle (Pflicht):** `vars.AGENT=claude` + `ZAI_API_KEY` fehlt → Auth-Schritt `exit 1`,
  nicht still skippen.
- **Claude-Flag-Smoke (lokal möglich, mit User-ZAI-Key):** `ANTHROPIC_BASE_URL=…/anthropic
ANTHROPIC_API_KEY=$ZAI claude -p "antworte mit VERDICT: ok" --model glm-5.1 --dangerously-skip-permissions`
  → bestätigt Endpoint + dass `VERDICT:` auf stdout erscheint (die Single-Point-of-Failure).
- **E2E (nur CI, ehrlich offen):** Test-Branch `vars.AGENT=claude`, Triage auf Test-Issue → Claude
  läuft auf glm-5.1, `VERDICT:`-Zeile erscheint, Assertion setzt Label korrekt.

## team7-Orchestrierung & Risiken

- **Feature-Size: Medium** → Developer + Reviewer + Documenter; **Pipeline-/Topologie-Änderung →
  separater Reviewer non-umgehbar**.
- **⚠️ Nebenlaeufig-Umgebung (nachgewiesen):** Repo wurde mid-Session gemerget/refactored; Content
  flippte zwischen Befehlen. **Pflicht: read-before-edit (jede Datei frisch lesen), keine
  Zeilen-Härtung, HEAD-Check vor jedem Edit.** Kein Commit durch das Team.
- **Single Point of Failure:** `claude -p`-VERDICT-Capture — per lokalem Smoke vorab bestätigen.
- **Output-Quoting:** `invoke-args` ohne eingebettete Quotes halten (Komma-Form bei `--allowedTools`),
  sonst bricht die Shell-Expansion.
- **Nicht den historischen Claude-Pfad kopieren** (vor-VERDICT-Ära, direktes Labeln) — hier gelten die
  **aktuellen VERDICT-basierten** Prompts.
- Abschluss: Pädagoge-Report (Pflicht).
