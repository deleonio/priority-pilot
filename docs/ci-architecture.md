# CI-Architektur: Provider, Modelle, Pipeline, Soft-Abort

> Diese Datei dokumentiert die CI/Provider/Modell-Architektur für **Menschen**, die die Pipeline
> warten. Sie wird **nicht** in den Agent-Kontext injiziert — der Agent bekommt seine Aufgabenbeschreibung
> vom Workflow-Prompt, nicht von hier.

## Aktuelle Konfiguration: Claude Code + Z.AI (GLM)

**Implementierung:** [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) als
einziger Coding-Agent in CI. Das Backend (Provider + Modell) liegt vollständig in der
eingecheckten [`.claude/settings.json`](../.claude/settings.json); pro Lauf wird nur der
`ANTHROPIC_API_KEY` aus dem Secret `ZAI_API_KEY` injiziert.

Es gibt **keine Provider-Variable** (`vars.LLM_PROVIDER`) und **keinen Agent-Toggle**
(`vars.AGENT`) mehr — beides ist entfallen. Die fünf Workflows laufen alle identisch konfiguriert.

| Komponente | Wert / Quelle                                                                              |
| ---------- | ------------------------------------------------------------------------------------------ |
| Agent      | Claude Code CLI (`npm install -g @anthropic-ai/claude-code`, pro Lauf)                     |
| Provider   | Z.AI — `ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic` (settings.json)                 |
| Auth       | `ANTHROPIC_API_KEY` ← Secret `ZAI_API_KEY` (in Setup-Action gesetzt)                       |
| Modell     | `glm-5.1[1m]` via Alias `"model": "opus"` → `ANTHROPIC_DEFAULT_OPUS_MODEL` (settings.json) |
| Invoke     | `claude -p '<prompt>'` (single-query, non-interactive)                                     |

- [Z.AI API Docs](https://docs.z.ai/guides/llm/glm-5.1)
- [Claude Code Docs](https://docs.anthropic.com/en/docs/claude-code)

### Konfigurationstrennung

Provider und Modell werden **nicht** im Workflow pro Lauf gewählt, sondern zentral über die
eingecheckte `settings.json`:

- **`.claude/settings.json`** (eingecheckt, versioniert) → `ANTHROPIC_BASE_URL`,
  Modell-Aliase (`ANTHROPIC_DEFAULT_*_MODEL`), aktives Modell (`"model"`), KoliBri-MCP.
- **`.github/actions/setup-claude/action.yml`** → installiert Claude Code, akzeptiert den
  Trust-Dialog und injiziert **nur** `ANTHROPIC_API_KEY=ZAI_API_KEY` via `GITHUB_ENV`
  (ein Secret kann nicht in der `settings.json` stehen).

Wechsel des Providers oder Modells = Datei-Änderung in `settings.json` + Commit. In CI wird
daraus der Endpoint und das Modell für jeden Lauf automatisch übernommen.

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

### Claude-Code-Installation im CI-Lauf

Die Setup-Action installiert Claude Code frisch pro Lauf und übernimmt Trust-Dialog + Auth:

```bash
npm install -g @anthropic-ai/claude-code          # install
# Trust-Dialog für den CI-Workspace setzen ($HOME/.claude.json)
echo "ANTHROPIC_API_KEY=$ZAI_API_KEY" >> "$GITHUB_ENV"   # Provider/Modell aus settings.json
```

### CI-Flags

| Flag                                                        | Zweck                                 |
| ----------------------------------------------------------- | ------------------------------------- |
| `-p '<prompt>'`                                             | Single-query, non-interactive         |
| `--dangerously-skip-permissions`                            | Keine Gefahren-Bestätigung (headless) |
| `--allowedTools Bash,Read,Write,Edit,Grep,Glob`             | Nur Terminal- und Datei-Tools         |
| `--allowedTools …,mcp__kolibri__search,mcp__kolibri__fetch` | ergänzt in Triage + Implement         |

Kein `--model`: das Modell wird über `"model": "opus"` in der `settings.json` gewählt und dort
per `ANTHROPIC_DEFAULT_OPUS_MODEL` auf `glm-5.1[1m]` abgebildet.

**Prompt:** Per Heredoc in eine Datei geschrieben, dann via `-p "$(cat /tmp/claude-prompt.txt)"`
übergeben — vermeidet Shell-Quoting-Probleme.

**VERDICT-Hinweis:** `claude -p` schreibt die finale Antwort (inkl. `VERDICT:`-Zeile) auf
stdout → `tee /tmp/claude-output.log` → `grep -oP 'VERDICT:\s*\K.*'` in der
Label-Post-Assertion.

### Benötigte Secrets

| Secret            | Zweck                                                        |
| ----------------- | ------------------------------------------------------------ |
| `ZAI_API_KEY`     | LLM-Zugang (z.ai) — einziger Provider-/Modell-relevanter Key |
| `APP_ID`          | GitHub App (Token für Label-/PR-Operationen)                 |
| `APP_PRIVATE_KEY` | GitHub App (Token für Label-/PR-Operationen)                 |

Die früher genutzten Secrets `NOUS_PORTAL_TOKEN`, `OPENROUTER_API_KEY` und `CLAUDE_API_KEY`
werden von der Pipeline **nicht mehr referenziert** und können im Repo gelöscht werden.

## KoliBri MCP-Server für Frontend-Implementierung

Der KoliBri MCP-Server steht dem Agenten in **Triage** und **Implement** zur Verfügung (nicht in
Review/Fixup/Spec, die keine Frontend-Komponenten schreiben).

**Einrichtung:** Der Server ist fest in der `.claude/settings.json` unter `mcpServers.kolibri`
eingetragen (kein pro-Lauf-`claude mcp add` mehr nötig). Die Setup-Action ergänzt für Triage +
Implement lediglich die Tools in `--allowedTools`.

**Verfügbare Tools:** `mcp__kolibri__search` (Komponenten-Suche), `mcp__kolibri__fetch`
(Beispiel/Dokument holen).

## Weiches Zeitlimit (Soft-Abort)

Statt harten `timeout-minutes` nutzt jeder Workflow ein **weiches Timeout**, das der Agent über
die instruierte Deadline selbst kontrolliert:

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
[`claude-issue-unblock.yml`](../.github/workflows/claude-issue-unblock.yml) den nächsten Nachfolger
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
3. **GitHub Actions (automatisch):** `claude-pr-review.yml` feuert, wenn ein PR das Label
   `ai:needs-review` trägt.

In **GitHub Actions** läuft das über **Labels**: Der Umsetzungs-Workflow macht den PR
review-bereit und labelt ihn **selbst** mit `ai:needs-review`. Der separate
[`pr-needs-review-label.yml`](../.github/workflows/pr-needs-review-label.yml) reagiert bewusst
**NICHT** auf bot-erzeugte Draft→ready-Übergänge (nur auf menschliche Aktoren).
