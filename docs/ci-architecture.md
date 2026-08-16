# CI-Architektur: Provider, Modelle, Pipeline, Soft-Abort

> Diese Datei dokumentiert die CI/Provider/Modell-Architektur für **Menschen**, die die Pipeline
> warten. Sie wird **nicht** in den Agent-Kontext injiziert — der Agent bekommt seine Aufgabenbeschreibung
> vom Workflow-Prompt, nicht von hier.
>
> **Weiterführend:** [pipeline-flow.md](./pipeline-flow.md) (Trigger-Fluss) ·
> [ci-legacy-comparison.md](./ci-legacy-comparison.md) (Struktur- & Stabilitäts-Vergleich Legacy
> 08.07.2026 vs. aktuell, inkl. Härte-Empfehlungen).

## Aktuelle Konfiguration: Claude Code, Provider umschaltbar (Z.AI / Anthropic)

**Implementierung:** [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) als
einziger Coding-Agent in CI. Das **Backend** ist über die Repo-Variable **`vars.LLM_PROVIDER`**
umschaltbar; aufgelöst wird sie zentral in
[`.github/actions/setup-claude`](../.github/actions/setup-claude/action.yml).

| `vars.LLM_PROVIDER` | Endpoint                                            | Secret           | Auth-Variable                                   | Modell (`"model": "opus"`) |
| ------------------- | --------------------------------------------------- | ---------------- | ----------------------------------------------- | -------------------------- |
| `claude` (Default)  | Anthropic-Default (kein `ANTHROPIC_BASE_URL`)       | `CLAUDE_API_KEY` | `ANTHROPIC_API_KEY` / `CLAUDE_CODE_OAUTH_TOKEN` | Claude Opus (nativ)        |
| `zai`               | `ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic` | `ZAI_API_KEY`    | `ANTHROPIC_AUTH_TOKEN` (Bearer)                 | `glm-5.1`                  |

**Warum unterschiedliche Auth-Variablen?** `ANTHROPIC_API_KEY` sendet den Token als
`x-api-key`-Header, `ANTHROPIC_AUTH_TOKEN` als `Authorization: Bearer`. z.ai akzeptiert nur
die Bearer-Form. Die Action setzt pro Provider **genau eine** davon — beide gleichzeitig
ergäben konkurrierende Auth-Header.

Ist die Variable **nicht gesetzt oder leer**, gilt `claude`. Ein **unbekannter Wert bricht den
Lauf ab** (kein stiller Fallback). Fehlt das Secret des gewählten Providers, schlägt der
Setup-Step mit klarer Fehlermeldung fehl.

| Komponente | Wert / Quelle                                                          |
| ---------- | ---------------------------------------------------------------------- |
| Agent      | Claude Code CLI (`npm install -g @anthropic-ai/claude-code`, pro Lauf) |
| Provider   | `vars.LLM_PROVIDER` → Setup-Action setzt Endpoint via `GITHUB_ENV`     |
| Auth       | provider-abhängige Auth-Variable + Secret (Setup-Action, s. o.)        |
| Modell     | `"model": "opus"` (settings.json) → pro Provider via Alias aufgelöst   |
| Invoke     | `claude -p '<prompt>'` (single-query, non-interactive)                 |

- [Z.AI API Docs](https://docs.z.ai/guides/llm/glm-5.1)
- [Claude Code Docs](https://docs.anthropic.com/en/docs/claude-code)

### LLM-Egress über Tailscale-Exit-Node

Optional wird der gesamte LLM-Traffic eines Laufs über einen Nürnberger Tailscale-Exit-Node
geleitet, sodass z.ai/OpenRouter alle Requests von **einer konsistenten IP** sehen — das verhindert
das „Account geteilt"-Flagging durch wechselnde Azure-Runner-IPs. Eingehängt zentral im
[`setup-claude`](../.github/actions/setup-claude/action.yml)-Composite (Connect + DNS-Fix) **vor**
dem `claude -p`-Aufruf. Kill-Switch und Fail-closed-Verhalten: siehe
[`tailscale-exit-node.md`](tailscale-exit-node.md).

### Konfigurationstrennung

Der Provider gehört **nicht** in die `.claude/settings.json`: die Datei ist eingecheckt und gilt
damit auch für **lokale Entwickler-Sessions** — ein dort gesetztes `ANTHROPIC_BASE_URL` würde
jede lokale Claude-Session zwangsweise nach z.ai umrouten. Deshalb:

- **`.claude/settings.json`** (eingecheckt) → **providerneutral**: aktives Modell als _Alias_
  (`"model": "opus"`), KoliBri-MCP, Permissions, Timeouts. Kein `ANTHROPIC_BASE_URL`, keine
  `ANTHROPIC_DEFAULT_*_MODEL`-Overrides.
- **`.github/actions/setup-claude/action.yml`** → installiert Claude Code, akzeptiert den
  Trust-Dialog und setzt pro Lauf via `GITHUB_ENV`: Endpoint, die passende Auth-Variable und
  (nur bei `zai`) die Modell-Aliase `ANTHROPIC_DEFAULT_{OPUS,SONNET,HAIKU,FABLE}_MODEL` +
  `CLAUDE_CODE_SUBAGENT_MODEL`.

Der Alias-Trick hält `settings.json` providerneutral: `"model": "opus"` bedeutet bei `zai`
`glm-5.1` und bei `claude` echtes Opus — dieselbe Datei, beide Backends.

**Provider wechseln** (kein Commit nötig):

```bash
gh variable set LLM_PROVIDER --body claude   # Anthropic nativ (Default)
gh variable set LLM_PROVIDER --body zai      # z.ai/GLM (Subscription-Kontingent)
```

Abgesichert ist davon nur, was ein Review nicht sieht: dass alle `setup-claude`-Aufrufer den
Provider-Input durchreichen und `.claude/settings.json` providerneutral bleibt. Dieses
Spiegel-Verhältnis war früher via `workflow-consistency`-Test gesichert; mit
[ADR 0001](./adr/0001-github-workflows-bleiben-ungetestet.md) entfällt der Test — wie die Auflösungslogik selbst (Endpoint,
Modell-Aliase, Key-Typ) macht ein falscher Wert den nächsten Lauf sofort und laut rot, ist
also bewusst nicht zusätzlich abgesichert.

#### Token-Typen bei `LLM_PROVIDER=claude`

Anthropic hat **zwei nicht austauschbare** Token-Formate. Die Setup-Action erkennt sie am
Präfix und setzt die jeweils passende Variable:

| Secret-Wert   | Herkunft                     | gesetzte Variable                 |
| ------------- | ---------------------------- | --------------------------------- |
| `sk-ant-api…` | Anthropic Console (API-Key)  | `ANTHROPIC_API_KEY`               |
| `sk-ant-oat…` | `claude setup-token` (OAuth) | `CLAUDE_CODE_OAUTH_TOKEN`         |
| alles andere  | vermutlich falsches Secret   | `ANTHROPIC_API_KEY` + `::warning` |

Der Fallback bricht bewusst **nicht** ab: ein zu strenger Guard würde ein gültiges Token
blockieren, falls Anthropic neue Präfixe einführt — die Antwort der API ist aussagekräftiger.

Ein OAuth-Token in `ANTHROPIC_API_KEY` scheitert mit **`Invalid API key · Fix external API key`** —
deshalb die Präfix-Weiche. Secrets werden zusätzlich von Whitespace befreit (ein beim Einfügen
mitkopierter Zeilenumbruch macht den Key sonst ungültig).

**Diagnose bei `Invalid API key`:** Der Setup-Step loggt den erkannten Token-Typ (nie den Wert).
Steht dort `API-Key erkannt` und die API lehnt trotzdem ab, ist der Key abgelaufen/widerrufen
oder hat kein Guthaben — dann in der Anthropic Console prüfen und
`gh secret set CLAUDE_API_KEY` neu setzen.

### Modellwahl bei `LLM_PROVIDER=zai` (GLM Coding Plan-Subscription)

> Gilt nur für den `zai`-Zweig. Bei `LLM_PROVIDER=claude` löst `"model": "opus"` auf echtes
> Claude Opus auf und die folgenden Kontingent-/Parallelitäts-Überlegungen entfallen.

Die sechs LLM-Workflows (fünf Ticket-Phasen 01–05 plus Post-Merge-Documenter) nutzen **phasenspezifische Modell-Defaults**:
Jede Phase reicht ihre eigene `CLAUDE_MODEL_*`-Variable an `setup-claude` durch; GitHub-Vars dienen als Override/Experimente.

| Phase          | Variable                     | Default (`LLM_PROVIDER=claude`) | Default (`LLM_PROVIDER=zai`) | Begründung                                      |
| -------------- | ---------------------------- | ------------------------------- | ---------------------------- | ----------------------------------------------- |
| Triage (01)    | `CLAUDE_MODEL_TRIAGE`        | `fable`                         | `glm-5.2`                    | Höchste Qualität für Analyse/Sub-Task-Schneiden |
| Spec (02)      | `CLAUDE_MODEL_SPEC`          | `sonnet`                        | `glm-4.7`                    | Balanciert für Design-Dokumente                 |
| Implement (03) | `CLAUDE_MODEL_IMPLEMENT`     | `opus`                          | `glm-5.1`                    | Maximale Qualität für Code-Generierung          |
| Review (04)    | `CLAUDE_MODEL_PR_REVIEW`     | `opus`                          | `glm-5.1`                    | Tiefes Verständnis für Code-Review              |
| Fixup (05)     | `CLAUDE_MODEL_FIXUP`         | `sonnet`                        | `glm-4.7`                    | Großer Context (CI-Logs), kosteneffizient       |
| Documenter     | `CLAUDE_MODEL_DOCUMENTATION` | `haiku`                         | `glm-4.5-air`                | Schnelle Documentation-Generierung              |

**Override-Syntax:** Jeder Workflow nutzt `model: ${{ vars.CLAUDE_MODEL_<PHASE> || '<default>' }}` — ist die GitHub-Variable nicht gesetzt, greift der Default-Wert. Default-Änderungen erfolgen in den Workflow-Dateien, nicht via Repo-Vars.

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
  Seit der globalen Phasen-Serialisierung (statische `concurrency`-Gruppe je Phase, s.
  [pipeline-flow.md](./pipeline-flow.md)) ist die Obergrenze strukturell **6 gleichzeitige
  Agent-Läufe** — einer je Phase; weitere Läufe derselben Phase stapeln sich, statt parallel
  Kontingent zu ziehen. Die Wahl bleibt damit komfortabel innerhalb der 10er-Grenze.
- **Sperrzeiten:** Nur `glm-5.2` und `glm-5-turbo` verbrauchen in Spitzenzeiten (14:00–18:00
  UTC+8 = dt. Vormittag) 3× bzw. außerhalb 2×. `glm-5.1` ist davon **nicht betroffen**.

**Fazit:** `glm-5.1` für alle Workflows ist die optimale Wahl unter den drei Constraints
Kontingent, Parallelität und Sperrzeiten.

### Claude-Code-Installation im CI-Lauf

Die Setup-Action installiert Claude Code frisch pro Lauf und übernimmt Trust-Dialog + Auth:

```bash
npm install -g @anthropic-ai/claude-code          # install
# Trust-Dialog für den CI-Workspace setzen ($HOME/.claude.json)

# Provider-Switch (vars.LLM_PROVIDER) — claude (Default), Variable je nach Token-Präfix:
echo "ANTHROPIC_API_KEY=$CLAUDE_API_KEY" >> "$GITHUB_ENV"        # sk-ant-api…
echo "CLAUDE_CODE_OAUTH_TOKEN=$CLAUDE_API_KEY" >> "$GITHUB_ENV"  # sk-ant-oat…

# ...oder zai (Bearer-Auth + Endpoint + Modell-Aliase):
echo "ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic" >> "$GITHUB_ENV"
echo "ANTHROPIC_AUTH_TOKEN=$ZAI_API_KEY"                 >> "$GITHUB_ENV"
echo "ANTHROPIC_DEFAULT_OPUS_MODEL=glm-5.1"          >> "$GITHUB_ENV"
```

### CI-Flags

| Flag                                                        | Zweck                                 |
| ----------------------------------------------------------- | ------------------------------------- |
| `-p '<prompt>'`                                             | Single-query, non-interactive         |
| `--dangerously-skip-permissions`                            | Keine Gefahren-Bestätigung (headless) |
| `--allowedTools Bash,Read,Write,Edit,Grep,Glob`             | Nur Terminal- und Datei-Tools         |
| `--allowedTools …,mcp__kolibri__search,mcp__kolibri__fetch` | ergänzt in Triage + Implement         |

Kein `--model`: das Modell wird über `"model": "opus"` in der `settings.json` gewählt — bei
`LLM_PROVIDER=claude` ist das echtes Opus, bei `zai` bildet die Setup-Action es per
`ANTHROPIC_DEFAULT_OPUS_MODEL` auf `glm-5.1` ab.

**Prompt:** Per Heredoc in eine Datei geschrieben, dann via `-p "$(cat /tmp/claude-prompt.txt)"`
übergeben — vermeidet Shell-Quoting-Probleme.

**VERDICT-Hinweis:** `claude -p` schreibt die finale Antwort (inkl. `VERDICT:`-Zeile) auf
stdout → `tee /tmp/claude-output.log` → `grep -oP 'VERDICT:\s*\K.*'` in der
Label-Post-Assertion.

### Benötigte Secrets

| Secret               | Zweck                                                       |
| -------------------- | ----------------------------------------------------------- |
| `CLAUDE_API_KEY`     | LLM-Zugang Anthropic — nötig bei `LLM_PROVIDER=claude`      |
| `ZAI_API_KEY`        | LLM-Zugang z.ai/GLM — nötig bei `LLM_PROVIDER=zai`          |
| `OPENROUTER_API_KEY` | LLM-Zugang OpenRouter — nötig bei `LLM_PROVIDER=openrouter` |
| `APP_ID`             | GitHub App (Token für Label-/PR-Operationen)                |
| `APP_PRIVATE_KEY`    | GitHub App (Token für Label-/PR-Operationen)                |

Alle drei LLM-Secrets werden von allen sechs LLM-Workflows durchgereicht; welches davon greift, entscheidet
`vars.LLM_PROVIDER`. Nur das Secret des **aktiven** Providers muss gesetzt sein — die anderen dürfen
leer bleiben, ohne den Lauf zu brechen.

Das frühere Secret `NOUS_PORTAL_TOKEN` wird von der Pipeline **nicht mehr referenziert** und kann
im Repo gelöscht werden. `OPENROUTER_API_KEY` hingegen ist **aktiv**: `openrouter` ist ein
vollständig verdrahteter dritter Provider (alle Phasen-Workflows reichen den Key an `setup-claude`
durch, `00-set-llm-provider.yml` akzeptiert ihn, `ci-multi-provider.yml` führt die Matrix) — nur
ist er nicht der Default-Pfad (`claude`).

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
3. **GitHub Actions (automatisch):** `04-claude-pr-review.yml` feuert, wenn ein PR das Label
   `ai:needs-review` trägt.

In **GitHub Actions** läuft das über **Labels**: Der Umsetzungs-Workflow macht den PR
review-bereit und labelt ihn **selbst** mit `ai:needs-review`. Der separate
[`pr-needs-review-label.yml`](../.github/workflows/pr-needs-review-label.yml) reagiert bewusst
**NICHT** auf bot-erzeugte Draft→ready-Übergänge (nur auf menschliche Aktoren).

## Nightly Guide-Sync (`claude-guide-sync.yml`)

Keine Pipeline-Phase, sondern ein nächtlicher Helper-Workflow (täglich 04:27 UTC +
`workflow_dispatch`): Ein LLM-Lauf hält das **In-App-Handbuch** `docs/user-guide.md` auf
**Ist-Stand**. Diese Datei _ist_ die Hilfe-Seite der App (`frontend/vite.config.ts` liefert sie
unter `/user-guide.md` aus, `HelpPage.tsx` rendert sie als Markdown) — jede Zeile darin liest ein
Endnutzer. Verifiziert wird gegen `frontend/src/` (UI, Dialoge, Meldungstexte, Tastaturkürzel),
`server/src/` (Push, LLM-Einstellungen, Allowlist-Meldungen) und `openapi.yml`;
`frontend/e2e/*.spec.ts` und `docs/spec/user-journeys.md` dienen als Querbeleg. Die Implementation
ist die Wahrheit, das Handbuch beschreibt sie nur aus Endnutzer-Sicht. Drei Operationen:
**korrigieren** (Verhalten hat sich geändert), **entsorgen** (beschriebene Funktion existiert nicht
mehr), **ergänzen** (implementiertes, undokumentiertes Nutzer-Feature).

**Mechanik:**

- **Skip-Guard:** Hat `main` denselben SHA wie der letzte erfolgreiche Lauf, wird der Lauf
  übersprungen (deterministisch dasselbe Ergebnis, spart LLM-Budget). Fail-open bei API-Fehlern;
  `workflow_dispatch` mit `force: true` umgeht den Guard.
- **In-Flight-Guard:** Trägt der offene Sync-PR gerade `ai:needs-review`, `ai:needs-changes`,
  `ai:ready-to-merge` oder (terminal) `ai:needs-human`, wird der Lauf ausgesetzt. Sonst zieht der
  nächtliche Force-Push einem laufenden Review-/Fixup-/Merge-Lauf den Branch unter den Füßen weg.
  `force: true` umgeht diesen Guard bewusst **nicht** — er schützt fremde Läufe, nicht das Budget.
- **Branch/PR:** Der Agent committed nur lokal auf `chore/user-guide-sync`, der Branch wird jede
  Nacht auf `origin/main` zurückgesetzt und per Force-Push ersetzt — der offene Sync-PR zeigt damit
  immer exakt die **aktuelle** Drift statt Commits zu akkumulieren. Push und PR-Anlage/-Update sind
  deterministische Workflow-Steps, keine Agent-Aufgabe. Fehlt der Agent-Report
  (`/tmp/guide-sync-report.md`), ersetzt ein `git log`-Fallback den PR-Body (mit Warning).
- **Post-Assertion (VERDICT-Muster):** `VERDICT: synced` ↔ null Commits, `VERDICT: updated` ↔
  Commits vorhanden, geänderte Dateien ⊆ `docs/user-guide.md`, **plus Sektions-Guard**: die
  Pflicht-Abschnitte aus [`server/src/logics/user-guide.test.ts`](../server/src/logics/user-guide.test.ts)
  (AK 2.1–2.9) und die H1 müssen vorhanden sein, sonst kein Push. Der Guard ist nur der schnelle
  Vorab-Check (kein `pnpm install` im Workflow) — autoritativ bleibt der Node-Test in der CI des PRs.
- **Pipeline-Anbindung AKTIV:** Der Workflow setzt `ai:needs-review` selbst per **App-Token** →
  `04 Review` → Gate → Auto-Merge; das Handbuch aktualisiert sich ohne Menschen. Das Label wird
  dabei **erst entfernt, dann gesetzt** (Re-Arm-Muster #536): klebt es noch vom Vorlauf, wäre ein
  reines `--add-label` ein No-op ohne `labeled`-Event und der Review startete nie.
  `pr-needs-review-label.yml` springt nicht ein (labelt nur menschliche Akteure).
- **Bewusst stateless:** Kein pro-Issue-Memory — der offene Sync-PR ist der einzige Zustand.
- **Modell:** `vars.CLAUDE_MODEL_GUIDE_SYNC` (Default `opus` — Handbuch-Prosa und Drift-Erkennung),
  Provider wie alle LLM-Phasen via `vars.LLM_PROVIDER` (setup-claude, `tools-tier: full`, inkl.
  Tailscale-Egress und Fair-Usage-Check).
