# CI-Architektur: Provider, Modelle, Pipeline, Soft-Abort

> Diese Datei dokumentiert die CI/Provider/Modell-Architektur für **Menschen**, die die Pipeline
> warten. Sie wird **nicht** in den Agent-Kontext injiziert — der Agent bekommt seine Aufgabenbeschreibung
> vom Workflow-Prompt, nicht von hier.

## Aktuelle Konfiguration: Coding-Agent (Hermes oder Claude Code) + Z.AI (GLM)

**Implementierung:** Hermes Agent (Nous Research) **oder** Claude Code CLI — wählbar per
`vars.AGENT` (default: `hermes`). Beide über den **Z.AI**-Provider mit GLM-Modellen.
Fallback (durch Entfernen der GitHub-Variable): Nous Portal mit DeepSeek (nur Hermes-Pfad).

| Provider                       | Auth                                      | Modell(e)            | Kontext |
| ------------------------------ | ----------------------------------------- | -------------------- | ------- |
| **Z.AI** (aktiv)               | `ZAI_API_KEY` (in `$HERMES_HOME/.env`)    | `glm-5.1`            | 200K    |
| Nous Portal (Fallback, Custom) | `NOUS_PORTAL_TOKEN` (via `model.api_key`) | DeepSeek Pro / Flash | 1.048K  |

- [Hermes Agent Docs](https://hermes-agent.nousresearch.com/docs/)
- [Z.AI API Docs](https://docs.z.ai/guides/llm/glm-5.1)
- CLI: `hermes chat -q '<prompt>'` (single-query, non-interactive)

### Modellwahl — Z.AI (GLM Coding Plan-Subscription)

Alle fünf Workflows laufen bewusst auf **demselben Modell** (`glm-5.1`), nicht differenziert
nach Aufgaben-Strenge. Grund: die GLM Coding Plan-Subscription arbeitet mit einem
**Nutzungskontingent** (nicht Pay-per-Token), und hier gilt:

| Faktor               | `glm-5.1`           | `glm-4.7-flash`      | `glm-5.2` / `glm-5-turbo`              |
| -------------------- | ------------------- | -------------------- | -------------------------------------- |
| Kontingent-Verbrauch | **1×**              | 1×                   | **2×** normal / **3×** Spitzenzeit     |
| Parallelitätsgrenze  | **10** (Höchstwert) | **1** → Flaschenhals | 10 / 1                                 |
| Sperrzeiten          | keine (immer 1×)    | keine                | 14:00–18:00 UTC+8 (= 08:00–12:00 CEST) |

- **Kontingent:** Alle Modelle außer `glm-5.2`/`glm-5-turbo` kosten **denselben** Anteil (1×) —
  ein leichteres Modell spart also nichts, kostet aber Qualität.
- **Parallelität:** `glm-5.1` erlaubt **10 parallele Läufe**. Die label-getriebene Pipeline kann
  mehrere Workflows gleichzeitig feuern (Triage + Implement + Review + Fixup + Spec).
  `glm-4.7-flash` erlaubt nur **1 gleichzeitigen Aufruf** → Läufe würden sich gegenseitig
  blockieren.
- **Sperrzeiten:** Nur `glm-5.2` und `glm-5-turbo` verbrauchen in Spitzenzeiten (14:00–18:00
  UTC+8 = dt. Vormittag) 3× bzw. außerhalb 2×. `glm-5.1` ist davon **nicht betroffen**.

**Fazit:** `glm-5.1` für alle Workflows ist die optimale Wahl unter den drei Constraints
Kontingent, Parallelität und Sperrzeiten.

### Modellwahl — Nous Portal Fallback (DeepSeek, Pay-per-Token)

Hier greift die klassische Differenzierung nach Aufgaben-Strenge: **Pro-Modell** für
Analyse/Spec/Review (präzises Reasoning), **Flash/Coding-Modell** für Implementierung/Fixup
(schnell, günstig). Details siehe [Modell-Zuordnung pro Workflow](#modell-zuordnung-pro-workflow).

### Agent-Installation im CI-Lauf

Der Coding-Agent wird im CI-Lauf frisch installiert (keine dedizierte GitHub Action nötig):

```bash
# Hermes (vars.AGENT = "hermes", default):
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash -s -- --skip-browser --skip-setup
echo "$HOME/.local/bin" >> $GITHUB_PATH

# Claude Code (vars.AGENT = "claude"):
npm install -g @anthropic-ai/claude-code
```

Beide Pfade werden zentral in [`.github/actions/setup-hermes/action.yml`](../.github/actions/setup-hermes/action.yml)
geregelt — die Workflows übergeben `agent: ${{ vars.AGENT }}` und konsumieren die Outputs
`invoke-cmd` / `invoke-args`.

### CI-Konfiguration — Provider wählbar per GitHub-Variable `vars.LLM_PROVIDER`

```bash
# Z.AI + GLM-5.1 (aktiv, wenn vars.LLM_PROVIDER = "zai")
# z.ai ist ein built-in Provider: Key muss in $HERMES_HOME/.env (nicht model.api_key)
hermes config set model.provider zai
printf 'ZAI_API_KEY=%s\n' "$ZAI_API_KEY" > "$HERMES_HOME/.env"

# Nous Portal + DeepSeek (Fallback, wenn Variable nicht gesetzt oder ≠ "zai")
hermes config set model.provider custom
hermes config set model.base_url https://inference-api.nousresearch.com/v1
hermes config set model.api_key "${{ secrets.NOUS_PORTAL_TOKEN }}"
```

Umschalten: Repo → Settings → Secrets and variables → Actions → Variables → `LLM_PROVIDER`.
**Aktuell aktiv:** `zai` (Z.AI + GLM-5.1).

| Variable            | Werte               | Secret(s) benötigt                  |
| ------------------- | ------------------- | ----------------------------------- |
| `vars.LLM_PROVIDER` | `zai` / (leer)      | `ZAI_API_KEY` / `NOUS_PORTAL_TOKEN` |
| `vars.AGENT`        | `hermes` / `claude` | (keine neuen)                       |

### Executor-Toggle: Hermes ↔ Claude Code

Die 5 Agent-Workflows (Triage, Spec, Implement, Review, Fixup) nutzen einen **Coding-Agent**,
der wählbar ist per GitHub-Variable `vars.AGENT`:

| `vars.AGENT`       | Agent           | Install                                                               | Invoke           |
| ------------------ | --------------- | --------------------------------------------------------------------- | ---------------- |
| `hermes` (default) | Hermes Agent    | `curl -fsSL https://hermes-agent.nousresearch.com/install.sh \| bash` | `hermes chat -q` |
| `claude`           | Claude Code CLI | `npm install -g @anthropic-ai/claude-code`                            | `claude -p`      |

**Beide** nutzen `vars.LLM_PROVIDER` zur Provider-Auswahl:

- **`zai`** (default): z.ai/GLM-5.1 (`ZAI_API_KEY`, Endpoint `https://api.z.ai/api/anthropic` für Claude)
- **`openrouter`**: OpenRouter (`OPENROUTER_API_KEY`, Endpoint `https://openrouter.ai/api` für Claude)

Die Prompts, die Label-Post-Assertion (VERDICT-Muster) und die Label-Kette sind **identisch** —
nur die Agent-Runtime und der Provider wechseln. Der Hermes-Pfad bleibt byte-äquivalent
(`vars.AGENT` ungesetzt).

**Claude-Code-Install im CI-Lauf:**

```bash
npm install -g @anthropic-ai/claude-code
```

**Claude-Code-Env (provider-abhängig):**

```bash
# vars.LLM_PROVIDER == 'openrouter'
echo "ANTHROPIC_BASE_URL=https://openrouter.ai/api" >> "$GITHUB_ENV"
echo "ANTHROPIC_API_KEY=$OPENROUTER_API_KEY" >> "$GITHUB_ENV"

# vars.LLM_PROVIDER == 'zai' (default)
echo "ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic" >> "$GITHUB_ENV"
echo "ANTHROPIC_API_KEY=$ZAI_API_KEY" >> "$GITHUB_ENV"
```

**Claude-Code-Flags (entsprechen den Hermes-Flags 1:1):**

| Hermes-Flag          | Claude-Code-Entsprechung                                                   |
| -------------------- | -------------------------------------------------------------------------- |
| `-q '<prompt>'`      | `-p '<prompt>'`                                                            |
| `-Q` (quiet)         | (implizit — `--output-format text`)                                        |
| `--yolo`             | `--dangerously-skip-permissions`                                           |
| `--provider zai`     | (über `ANTHROPIC_BASE_URL` + `ANTHROPIC_API_KEY`)                          |
| `-m glm-5.1`         | `--model glm-5.1` (zai) / `--model anthropic/claude-sonnet-4` (openrouter) |
| `-t "terminal,file"` | `--allowedTools Bash,Read,Write,Edit,Grep,Glob`                            |
| `--accept-hooks`     | (implizit — `--dangerously-skip-permissions`)                              |
| `--resume <id>`      | (nicht aktiv — Claude läuft frisch pro Lauf)                               |

**VERDICT-Hinweis:** `claude -p` schreibt die finale Antwort (inkl. `VERDICT:`-Zeile) auf
stdout → `tee /tmp/hermes-output.log` → `grep -oP 'VERDICT:\s*\K.*'` in der
Label-Post-Assertion. Der Vertrag ist executor-agnostisch.

### CI-Flags

| Flag                 | Zweck                                 |
| -------------------- | ------------------------------------- |
| `-q '<prompt>'`      | Single-query, non-interactive         |
| `-Q`                 | Quiet — keine Banner/Spinner          |
| `--yolo`             | Keine Gefahren-Bestätigung (headless) |
| `--provider <name>`  | `custom` (Nous Portal) oder `zai`     |
| `-m <modell>`        | Modell-Festlegung (Pro/Flash/GLM)     |
| `-t "terminal,file"` | Nur Terminal und Datei-Tools          |
| `--accept-hooks`     | Shell-Hooks automatisch freigeben     |

**Prompt:** Per Heredoc in eine Datei geschrieben, dann via `-q "$(cat /tmp/hermes-prompt.txt)"` übergeben — vermeidet Shell-Quoting-Probleme.

### Modell-Zuordnung pro Workflow

| Workflow  | Z.AI (GLM, aktiv) | Nous Portal (DeepSeek, Fallback) | Warum (zai)                                                 |
| --------- | ----------------- | -------------------------------- | ----------------------------------------------------------- |
| Triage    | `glm-5.1`         | `deepseek/deepseek-v4-pro`       | Flagship-Reasoning für Analyse + AK + Ampel                 |
| Spec      | `glm-5.1`         | `deepseek/deepseek-v4-pro`       | Präzise Test-Spezifikation                                  |
| Review    | `glm-5.1`         | `deepseek/deepseek-v4-pro`       | Kritische Diff-Analyse, Findings                            |
| Implement | `glm-5.1`         | `deepseek/deepseek-v4-flash`     | Bewusst nicht auf `glm-4.7-flash` — Kontingent/Parallelität |
| Fixup     | `glm-5.1`         | `deepseek/deepseek-v4-flash`     | Bewusst nicht auf `glm-4.7-flash` — Kontingent/Parallelität |

**Warum im zai-Pfad kein leichteres Modell für Implement/Fixup:** Bei Pay-per-Token (DeepSeek)
spart das Flash-Modell Geld. Bei der GLM Coding Plan-Subscription verbrauchen aber alle Modelle
außer `glm-5.2`/`glm-5-turbo` **dasselbe Kontingent (1×)** — ein Wechsel auf `glm-4.7-flash`
spart also nichts, reduziert aber die **Parallelität von 10 auf 1** und verschlechtert die
Qualität.

## KoliBri MCP-Server für Frontend-Implementierung

Der KoliBri MCP-Server steht dem Agenten in **Triage** und **Implement** zur Verfügung (nicht in
Review/Fixup/Spec, die keine Frontend-Komponenten schreiben).

**Einrichtung im CI-Lauf** (nur in Triage + Implement):

```bash
# Hermes:
pip install mcp -q
hermes mcp add kolibri --url https://public-ui-kolibri-mcp.vercel.app/mcp

# Claude Code:
claude mcp add --transport http kolibri https://public-ui-kolibri-mcp.vercel.app/mcp
```

**Verfügbare Tools:** `mcp_kolibri_search` (Komponenten-Suche), `mcp_kolibri_fetch` (Beispiel/Dokument holen).

Die Workflows nutzen **nicht** `--ignore-user-config`, damit die `mcp_servers`-Konfiguration wirkt.
Für Claude Code werden die MCP-Tools in `--allowedTools` ergänzt (`mcp__kolibri__search,mcp__kolibri__fetch`).

## Weiches Zeitlimit (Soft-Abort)

Statt harten `timeout-minutes` nutzt Hermes ein **weiches Timeout**, das der Agent selbst kontrolliert:

- **Phase 1 (Triage/Review/Fixup)**: Soft-Deadline 10 Minuten (`now+600`)
- **Phase 2 (Spec/Implement)**: Soft-Deadline 14 Minuten (`now+840`)

Der `starttime`-Step setzt die Soft-Deadline. Der Prompt instruiert den Agenten, VOR jedem
Teilschritt `date +%s` gegen die Deadline zu prüfen. Bei Erreichen:

1. **Arbeit sichern** — Zwischenstand in Body-Block/Dokumentation schreiben
2. **Kein Abschluss-Label** setzen — verhindert automatische Weiterleitung
3. **Trigger-Label entfernen** + **sofort neu setzen** (z.B. `ai:ready` entfernen + wieder setzen)
4. **Turn beenden** — automatische Neu-Anmeldung durch Label-Änderung

Dadurch bricht **nur der aktuelle Teil** ab, nicht der ganze Job, und die Arbeit ist dokumentiert.

**Obergrenze (Marker-Label `ai:continued`):** Um Endlosschleifen zu verhindern, startet der
Workflow nach einem Soft-Abort genau einen Selbst-Retrigger durch (Auslöser-Label entfernen +
sofort wieder setzen → neuer Workflow-Lauf). Maximal eine Wiederholung, dann muss der Agent
manuell eingreifen.

### Timeout-Backstop

`timeout-minutes: 30` als harter Backstop (weit über der Soft-Deadline) — fängt einen hängenden
Agent ab (Prompt-Deadline ignoriert, API-Call hängt), ohne das graceful Save bei der Soft-Deadline
zu stören.

Läuft ein Issue-Job dennoch in den Timeout — oder ist die Obergrenze von einer automatischen
Fortsetzung bereits ausgeschöpft —, ist das Issue zu groß für einen Lauf: Der Job setzt am Issue
das Label **`ai:to-big-issue`** (und die Umsetzung entfernt zusätzlich `ai:ready`, die Spec
`ai:spec-ready`, damit es nicht erneut aufgegriffen wird) — als Kandidat zum **Aufteilen** in
Sub-Issues. Die PR-Workflows (Review/Fixup) vergeben bei Erschöpfung bewusst **kein** Issue-Label
— nur einen Alarm-Kommentar.

## Label-getriebene Pipeline

Den **vollständigen Label-getriebenen Ticket-Flow** (Issue → Spec → Implement → Review ↔ Fixup →
Gate/Auto-Merge) als Diagramm samt Label-Referenz: [docs/pipeline-flow.md](pipeline-flow.md).

### Label-Post-Assertion (VERDICT-Muster)

Der Agent setzt **keine Labels selbst**. Stattdessen gibt er am Ende einen `VERDICT:`-Marker aus.
Ein deterministischer Workflow-Step parst diesen, verifiziert die **Artefakte** (Body-Block, PR,
Tests, Review-Kommentar) und setzt die Labels via **App-Token** (Secrets `APP_ID` +
`APP_PRIVATE_KEY`), damit die Folge-Workflows zuverlässig getriggert werden.

**Vertrauensloses Design:** Die Assertion prüft immer die Artefakte hinter dem VERDICT — ein
`VERDICT: spec-ready` ohne Body-Block failt laut (`exit 1`), ein `VERDICT: needs-review` ohne
fertigen PR ebenfalls.

### Sub-Issue-Entblockung (`blocked-by`)

Sind Sub-Issues über native GitHub-Issue-Dependencies (`blocked-by`) sequenziell verkettet
(A1 → A2 → A3, gesetzt bei der Zerlegung in der Triage), gibt
[`hermes-issue-unblock.yml`](../.github/workflows/hermes-issue-unblock.yml) den nächsten Nachfolger
frei, sobald **alle** seine Blocker gemergt/geschlossen sind (Fan-in-Gate) — indem es dessen
`ai:analyzed` **per App-Token** entfernt und so die Re-Triage gegen den nun gemergten Code-Stand
anstößt.

### Named Session Resume (aktuell nicht aktiv)

Die Session-Resume-Funktionalität (MIG-002) ist noch nicht migriert. Derzeit startet jeder Lauf
frisch ohne Kontext aus vorherigen Läufen derselben Phase.

## Aufrufpfade der Kreuzverhör-Workflows

1. **Chat/REPL (interaktiv):** Trigger-Phrasen aktivieren den Agenten direkt: „Kreuzverhör",
   „nimm das auseinander", „stress-teste das", „challenge mich".
2. **Slash-Command:** `/kreuzverhoer-review [PR-Nummer]`.
3. **GitHub Actions (automatisch):** `hermes-pr-review.yml` feuert, wenn ein PR das Label
   `ai:needs-review` trägt.

In **GitHub Actions** läuft das über **Labels**: Der Umsetzungs-Workflow macht den PR
review-bereit und labelt ihn **selbst** mit `ai:needs-review`. Der separate
[`pr-needs-review-label.yml`](../.github/workflows/pr-needs-review-label.yml) reagiert bewusst
**NICHT** auf bot-erzeugte Draft→ready-Übergänge (nur auf menschliche Aktoren).
