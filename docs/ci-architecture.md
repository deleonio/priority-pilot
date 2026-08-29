# CI-Architektur: Provider, Modelle, Pipeline, Soft-Abort

> Diese Datei dokumentiert die CI/Provider/Modell-Architektur für **Menschen**, die die Pipeline
> warten. Sie wird **nicht** in den Agent-Kontext injiziert — der Agent bekommt seine Aufgabenbeschreibung
> vom Workflow-Prompt, nicht von hier.
>
> **Weiterführend:** [pipeline-flow.md](./pipeline-flow.md) (Trigger-Fluss).

## Aktuelle Konfiguration: Claude Code, Provider umschaltbar (Z.AI / Anthropic)

**Implementierung:** [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) als
einziger Coding-Agent in CI. Das **Backend** ist über die Repo-Variable **`vars.LLM_PROVIDER`**
umschaltbar; aufgelöst wird sie zentral in
[`.github/actions/setup-claude`](../.github/actions/setup-claude/action.yml).

| `vars.LLM_PROVIDER` | Endpoint                                            | Secret           | Auth-Variable                                   | Modell (`"model": "opus"`) |
| ------------------- | --------------------------------------------------- | ---------------- | ----------------------------------------------- | -------------------------- |
| `claude` (Default)  | Anthropic-Default (kein `ANTHROPIC_BASE_URL`)       | `CLAUDE_API_KEY` | `ANTHROPIC_API_KEY` / `CLAUDE_CODE_OAUTH_TOKEN` | Claude Opus (nativ)        |
| `zai`               | `ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic` | `ZAI_API_KEY`    | `ANTHROPIC_AUTH_TOKEN` (Bearer)                 | `glm-5.3[1m]`              |

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
`glm-5.3[1m]` und bei `claude` echtes Opus — dieselbe Datei, beide Backends.

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

Die sechs LLM-Workflows (Ticket-Phasen 01–06 inkl. Post-Merge-Documenter) nutzen **phasenspezifische Modell-Defaults**:
Jede Phase reicht ihre eigene `CLAUDE_MODEL_*`-Variable an `setup-claude` durch; GitHub-Vars dienen als Override/Experimente.

Seit [ADR 0005](adr/0005-fixup-und-umsetzung-sind-eine-phase.md) ist die Nacharbeit an Review-Findings kein eigener Workflow mehr, sondern der PR-Eingang der Umsetzungsphase — `CLAUDE_MODEL_FIXUP` gilt weiterhin, nur eben für den zweiten Eingang von 04.

Was diese Wahl an einem realen Ticket gekostet hat, steht in der [Kosten-Baseline zu #912](kosten-baseline-912.md).

| Phase                       | Variable                     | Default (`LLM_PROVIDER=claude`) | Default (`LLM_PROVIDER=zai`) | Begründung                                      |
| --------------------------- | ---------------------------- | ------------------------------- | ---------------------------- | ----------------------------------------------- |
| Triage (01)                 | `CLAUDE_MODEL_TRIAGE`        | `opus`                          | `glm-5.3[1m]`                | Höchste Qualität für Analyse/Sub-Task-Schneiden |
| Spec (03)                   | `CLAUDE_MODEL_SPEC`          | `sonnet`                        | `glm-5.3[1m]`                | Balanciert für Design-Dokumente                 |
| UX (02)                     | `CLAUDE_MODEL_UX`            | `sonnet`                        | `glm-5.3[1m]`                | Balanciert für UX-Review                        |
| Implement (04)              | `CLAUDE_MODEL_IMPLEMENT`     | `opus`                          | `glm-5.3[1m]`                | Maximale Qualität für Code-Generierung          |
| Review (05)                 | `CLAUDE_MODEL_PR_REVIEW`     | `opus`                          | `glm-5.3[1m]`                | Tiefes Verständnis für Code-Review              |
| Nacharbeit (04, PR-Eingang) | `CLAUDE_MODEL_FIXUP`         | `sonnet`                        | `glm-5.3[1m]`                | Großer Context (CI-Logs), kosteneffizient       |
| Documenter (06)             | `CLAUDE_MODEL_DOCUMENTATION` | `haiku`                         | `glm-4.7`                    | Schnelle Documentation-Generierung              |

**Override-Syntax:** Jeder Workflow nutzt `model: ${{ vars.CLAUDE_MODEL_<PHASE> || '<default>' }}` — ist die GitHub-Variable nicht gesetzt, greift der Default-Wert. Default-Änderungen erfolgen in den Workflow-Dateien, nicht via Repo-Vars.

Das Abo (GLM Coding Plan) umfasst nur **`glm-4.7`, `glm-5-turbo` und `glm-5.3`** — die Modelle aus dem
ursprünglichen #893-Vergleich (`glm-5.1`, `glm-5.2`, `glm-4.7-flash`, `glm-4.5-air`) sind nicht gebucht.
Die z.ai-Spalte oben zeigt die aktuelle Auflösung aus `vars.CLAUDE_CODE_SETTINGS_LOCAL_ZAI`.

| Faktor               | `glm-5.3[1m]` — Hauptmodell (sonnet/opus/fable) | `glm-4.7` — haiku-Aliase | `glm-5-turbo` — nur `CLAUDE_CODE_SUBAGENT_MODEL`                                              |
| -------------------- | ----------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------- |
| Kontingent-Verbrauch | **1×**                                          | 1×                       | **2×** normal / **3×** Spitzenzeit                                                            |
| Sperrzeiten          | keine (immer 1×)                                | keine                    | Mo–Fr 14:00–18:00 UTC+8 (= 08:00–12:00 MESZ / 07:00–11:00 MEZ); Wochenende ganztägig Off-Peak |
| Parallelität         | —                                               | —                        | 1 → Flaschenhals für parallele Subagent-Calls                                                 |

- **Kontingent:** Alle gebuchten Modelle außer `glm-5-turbo` kosten denselben Anteil (1×) — ein
  leichteres Modell spart also nichts, kostet aber Qualität.
- **Parallelität:** `glm-5-turbo` erlaubt nur **1 gleichzeitigen Call** und ist nur als Subagent-Modell
  im Spiel; die Phasenmodelle `glm-5.3[1m]`/`glm-4.7` sind davon nicht betroffen.
  Seit der globalen Phasen-Serialisierung (statische `concurrency`-Gruppe je Phase, s.
  [pipeline-flow.md](./pipeline-flow.md)) ist die Obergrenze strukturell **6 gleichzeitige
  Agent-Läufe** — einer je Phase; weitere Läufe derselben Phase stapeln sich, statt parallel
  Kontingent zu ziehen.
- **Sperrzeiten:** Das einzige gebuchte Modell mit Spitzenzeit-Aufschlag ist `glm-5-turbo`
  (Mo–Fr 14:00–18:00 UTC+8 = dt. Vormittag, DST-abhängig 07:00–11:00 MEZ / 08:00–12:00 MESZ;
  am Wochenende gilt ganztägig der Nebenzeittarif). Der Zeitfenster-Fallback in `setup-claude`
  prüft direkt die Singapore-Zeit (UTC+8, kein DST) und greift damit an Samstagen/Sonntagen
  nicht mehr; er ist bewusst pauschal (konservativ), solange unklar ist, ob der 3×-Tarif
  planweit oder nur für 2×/3×-Modelle gilt.

**Fazit (Abo-Realität):** `glm-5.3[1m]` trägt alle Phasen-Aliase außer `haiku` (→ `glm-4.7`) —
1× Kontingent, keine Sperrzeit. `glm-5-turbo` läuft nur als `CLAUDE_CODE_SUBAGENT_MODEL` und ist
der einzige 2×/3×-Tarif-Nutzer sowie mit Parallelität 1 der Flaschenhals für parallele
Subagent-Calls. Wer beides vermeiden will, setzt `CLAUDE_CODE_SUBAGENT_MODEL` in
`vars.CLAUDE_CODE_SETTINGS_LOCAL_ZAI` auf `glm-4.7` oder `glm-5.3[1m]` — dann ist der
Peak-Fallback praktisch rein defensiv.

### Modell-Routing je Phase (ai-phase-routing-Tabelle)

Die Triage schreibt neben dem Analyse-Block eine Routing-Tabelle in den Issue-Body
(Marken `<!-- ai-phase-routing:START/END -->`): je Phase ux/spec/impl/review die Spalten
Run (ja/nein), Modell (haiku/sonnet/opus) und Effort (low/medium/high). `impl` und `review`
laufen immer; die Run-Spalte dokumentiert dieselbe Entscheidung wie die Label-Kette.

**Vorrang:** Tabelle > `ai:model:*`-Label > Workflow-Default (`vars.CLAUDE_MODEL_*` bleibt
manueller Not-Override). `resolve-phase-routing.sh` liest die Tabelle (am Issue; bei PRs über
das Closing-Issue) und ist fail-open: fehlt sie oder ist eine Zeile ungültig, gelten Label bzw.
Defaults unverändert — ein Tippfehler des LLM parkt die Pipeline nie. Details: ADR 0004.

**Eskalation bei Wiederholung (`ai:continued`):** Setzt der Soft-Abort der Umsetzung
`ai:continued` und re-triggert `ai:needs-impl`, stuft der Precheck von 04 das gemergte
Ergebnis (Tabelle/Label/Default) eine Stufe hoch ([`resolve-escalation.sh`](../.github/scripts/resolve-escalation.sh)):
Modell `haiku → sonnet → opus` (ab `opus` unverändert — Allowlist-Ende, die Eskalation trägt
dann allein den Effort), Effort `low → medium → high → xhigh → max`. Wirkt genau einmal —
der zweite Soft-Abort geht ohnehin an den Menschen (`ai:to-big-issue`). Fail-open: bei
Fehlern gilt das ungeescalatierte Ergebnis weiter.

### Delegation und Mentor-Eskalation (ADR 0008)

Die Phasen-Modellwahl steuert den **Lauf** — innerhalb eines Laufs greifen zwei weitere
Mechanismen, die unterschiedliche Richtungen haben und sich nicht ins Gehege kommen dürfen:

|          | Delegation (Subagent)                            | Eskalation (Mentor)               |
| -------- | ------------------------------------------------ | --------------------------------- |
| Richtung | nach unten, billiger                             | nach oben, teurer                 |
| Modell   | `haiku`, global via `CLAUDE_CODE_SUBAGENT_MODEL` | `opus` (Default), eigener Prozess |
| Auslöser | der Agent selbst, nach SKILL-Regel               | deterministischer Workflow-Step   |
| Aufgabe  | breit lesen, ausführen, fassen                   | einmal urteilen, Weg vorschlagen  |
| Rückgabe | kurzes Fazit, nie Rohtext                        | ≤ 40 Zeilen Handlungsanweisung    |

**Delegation:** Zwei Rollen in [`.claude/agents/`](../.claude/agents/) mit
Rückgabevertrag (Fazit statt Rohtext — ohne den Vertrag verdoppeln Subagents Tokens,
denn jedes Ergebnis fließt in den Elternkontext zurück): `recherche` (read-only
Suchfragen) und `gate-runner` (Gate-Kette, meldet nur Exit-Code + Fehlersignatur).
Die Workflows setzen `subagent-model: haiku` (Triage schon länger; Umsetzung/Fixup/Review
seit ADR 0008) — der Override schlägt das Rollen-Frontmatter und gilt für ALLE Subagents,
deshalb stehen Rollen und Override auf derselben Stufe. Anweisung und Kriterium stehen in
den SKILLs (`ticket-implementation` → „Delegation", `review-kreuzverhoer` → „Delegation",
`ticket-triage` Schritt 1), die Prompts verweisen nur.

**Mentor:** Eigener `claude -p`-Step **vor** dem Phasen-Step in 04 (beide Eingänge),
read-only. Kein Subagent, weil `CLAUDE_CODE_SUBAGENT_MODEL` global überschreibt — ein
Mentor-Subagent zwänge dem Fan-out dasselbe Modell auf oder umgekehrt. Auslöser rein
deterministisch über [`mentor-gate.sh`](../.github/scripts/mentor-gate.sh):

| Eingang   | Auslöser                                           | Signal                  |
| --------- | -------------------------------------------------- | ----------------------- |
| Fixup     | `rounds >= 2` (ab der 2. Review→Fixup-Runde)       | `fixup-rounds.sh`       |
| Umsetzung | `escalated == true` (Wiederholung nach Soft-Abort) | `resolve-escalation.sh` |

Der Mentor schreibt `/tmp/mentor-advice.md` (≤ 40 Zeilen: Ursache/Weg/Fallen, Prompt:
[mentor.md](../.github/prompts/mentor.md)), das als Markerblock `═══ MENTOR-RAT
(VERBINDLICH) ═══` in den Phasen-Prompt wandert — als Block angehängt statt per
`sed`-Platzhalter substituiert, weil LLM-Freitext `{{…}}` enthalten darf
(`assert-prompt-complete.sh` nimmt beide Markerblöcke aus). Der Mentor-Step ist
`continue-on-error` (fail-open): Ohne Rat läuft die Phase normal weiter. Modell:
`vars.CLAUDE_MODEL_MENTOR` (Default `opus`), eigene Soft-Deadline (~8 Min).

**Kostenabgrenzung:** `record-cost` summiert alle Transkriptzeilen seit `--since` — der
Mentor bekommt einen eigenen Datensatz (`phase: mentor`, `since` = Job-Start), und der
Phasen-Datensatz zählt ab **Mentor-Ende** (`steps.mentor.outputs.since_epoch`), sonst
verbuchte er die Mentor-Tokens als Phasenkosten mit. Die Mentor-Kostenfrage entscheidet
sich an `.costs/`: Sie trägt sich, wenn eine vermiedene Schleifenrunde (2–4 Mio Token)
teurer ist als ein Mentor-Lauf.

### Modell-Allowlist & Freigabe neuer Modelle

Pipeline-Phasen laufen nur mit erprobten Modell-Aliassen. Ein `ai:model:<alias>`-Label
mit unbekanntem Alias bricht im **Precheck** ab (04/05: `resolve-model-label.sh`, nur noch
Fallback-Pfad ohne Routing-Tabelle) statt halb erfüllte Prompt-Verträge im Lauf zu
hinterlassen — die Lektion aus PR #903, wo ein Free-Modell nur die `VERDICT:`-Zeile lieferte
und die Begründungs-Kommentare übersprang. Dieselbe Allowlist gilt für die
Modell-Spalte der Routing-Tabelle.

**Geltende Allowlist:** `fable | opus | sonnet | haiku`

**Stellen, die bei einem neuen Alias synchron zu pflegen sind:**

| #   | Datei                                         | Stelle                                                                                                               |
| --- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1   | `.github/scripts/resolve-model-label.sh`      | case-Filter + Abbruch-Meldung (~Zeile 167)                                                                           |
| 2   | `.github/actions/setup-claude/action.yml`     | Phasen-Modell-Auflösung: case + `::error`-Meldung (~Zeile 552–564)                                                   |
| 3   | `.github/actions/setup-claude/action.yml`     | Subagent-Alias: case + `::error`-Meldung (~Zeile 607–612)                                                            |
| 4   | `.github/scripts/resolve-model-label.test.ts` | neuer Fall „bekannter Alias → durch“ + alter Abbruch-Fall bleibt grün                                                |
| 5   | `.github/workflows/04-claude-implement.yml`   | Mentor-Modell-Auflösung (2 Steps, implement- + fixup-Job): case `MENTOR_MODEL` mit Restore-trap auf den Phasen-Alias |
| 6   | `.claude/agents/*.md`                         | Rollen-Frontmatter `model:` (dieselben Aliase; wird in CI vom Subagent-Override überdeckt, greift lokal)             |

**Freigabe-Prozess:** Alias in allen vier Stellen eintragen, das Resolve-Ziel je Provider ergänzen
(`claude` nativ via `--model`; `zai`/`openrouter` über die `ANTHROPIC_DEFAULT_*_MODEL`-Einträge der
GitHub Variables `CLAUDE_CODE_SETTINGS_LOCAL_*` — deren JSON ist dort Source of Truth und wird hier
nicht gespiegelt), `pnpm test:scripts` grün, dann erst das Label im Betrieb nutzen. Die
`vars.CLAUDE_MODEL_*` tragen nur Phasen-**Defaults** — sie erweitern die Allowlist nicht.

**`unrecognized_model`-Warnung (Issue #962):** Die CLI loggt bei nicht-nativ bekannten Modell-IDs
(zai/openrouter) pro Request eine `[claude-code:unrecognized_model]`-Zeile. Es gibt **kein** ENV/Flag
zur globalen Unterdrückung; die CLI kennt nur `modelOverrides` (per Modell-ID, siehe
[Model configuration](https://code.claude.com/docs/en/model-config)). Da unsere Modell-IDs aus den
dynamischen GitHub Variables stammen, wäre eine statische Override-Map bei jeder Variablen-Änderung
veraltet — deshalb filtert der `logtail`-Subcommand von `needs-human-explain.sh` diese Zeilen aus
den Diagnose-Auszügen. Erwartet bei zai/openrouter, laufunschädlich.

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
echo "ANTHROPIC_DEFAULT_OPUS_MODEL=glm-5.3[1m]"     >> "$GITHUB_ENV"
```

### CI-Flags

| Flag                                                                | Zweck                                   |
| ------------------------------------------------------------------- | --------------------------------------- |
| `-p '<prompt>'`                                                     | Single-query, non-interactive           |
| `--dangerously-skip-permissions`                                    | Keine Gefahren-Bestätigung (headless)   |
| `--allowedTools Bash,Read,Write,Edit,Grep,Glob`                     | Nur Terminal- und Datei-Tools           |
| `--allowedTools …,mcp__kolibri-mcp__search,mcp__kolibri-mcp__fetch` | ergänzt in allen Phasen mit `needs-mcp` |

Kein `--model`: das Modell wird über `"model": "opus"` in der `settings.json` gewählt — bei
`LLM_PROVIDER=claude` ist das echtes Opus, bei `zai` bildet die Setup-Action es per
`ANTHROPIC_DEFAULT_OPUS_MODEL` auf `glm-5.3[1m]` ab.

**Prompt:** Kanonisch in `.github/prompts/` (triage, ux, spec, implement, fixup, review,
documenter, dazu die Nightly-Helfer spec-sync/guide-sync/prompt-audit;
Memory-Snippets memory-read.md/memory-write.md am selben Ort);
per `sed`/`cat` nach `/tmp/claude-prompt.txt` assembliert und via `-p "$(cat /tmp/claude-prompt.txt)"`
übergeben — vermeidet Shell-Quoting-Probleme. Die Methode je Phase lebt in der `SKILL.md` des
jeweiligen Skills (`.claude/skills/*/SKILL.md`).

**Memory (zwei Ebenen, `.ai-memory/`):** Die Snippets `memory-read.md`/`memory-write.md`
adressieren beide. `MEMORY.md` ist das **eingecheckte Dauergedächtnis** über Tickets hinweg — es
reist im normalen Commit der Phasen mit Commit-Auftrag (Spec, Umsetzung, Fixup) und kommt nie in
den Issue-Storage, sonst überschriebe ein alter Stand beim Restore der Folgephase die frisch
committete Datei. `issue-<N>-<phase>.md` sind die **Phasen-Notizen** für den
Soft-Abort-Resume — seit ADR 0007 committet (nicht mehr gitignored): Sie reisen im
Harness-Branch mit und gelangen per PR-Merge dauerhaft nach `main`. Vertrag und
Aufnahmekriterium: [AGENTS.md → Memory](../AGENTS.md#memory).

**Issue-Storage (Transport):** Der Zustand pro Issue liegt auf dem **Harness-Branch
`ai/harness/{N}`** — demselben Branch, auf dem Spec/Impl arbeiten und der per PR nach
`main` gemergt wird. Triage/UX legen ihn an bzw. schreiben ihn über die Composite-Action
`issue-state-save` fort (Temp-Index, Basis `origin/main`); ab Spec committet der Agent
seine Phasen-Notiz selbst mit, der Save-Step bleibt idempotentes Sicherheitsnetz.
Jede Phase lädt per `git fetch` + `git restore` in den Workspace (Index unberührt,
Legacy-Fallback auf `ai/state/issue-{N}`). `state.json` ist entfallen. Beim Merge löscht
`delete_branch_on_merge` den Branch (Memory ist dann in `main`), der Hygiene-Sweep in
`cache-cleanup.yml` fängt Verwaiste (Issue geschlossen + 7 Tage Ruhe) auf beiden Prefixen.
Entscheidung inkl. Geschichte (Artefakt-/Cache-Ablehnung, read-only Cache-Tokens):
[ADR 0007](./adr/0007-issue-storage-harness-branch.md), Vorgänger [ADR 0006](./adr/0006-issue-storage-state-branch.md).

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

## MCP-Server für KoliBri und Playwright (Browser-Inspektion)

Der **KoliBri MCP-Server** (`kolibri-mcp`) ist in allen Phasen außer Documenter (06) via `needs-mcp: true`
verfügbar und liefert KoliBri-Komponenten-Suche und Dokumentation. Der **Playwright MCP-Server**
(`playwright`) steht zusätzlich in UX (02) und Umsetzung (04, beide Eingänge) via `browser-mcp: true`
für Layout-Prüfung bei 375px/1280px Viewport auf der laufenden Inspect-Instanz (http://localhost:4174).

**Einrichtung:** Beide Server sind in `.mcp.json` registriert (KoliBri: HTTP, Playwright: `@playwright/mcp@0.0.79`,
`allowed-origins: localhost:4174;3001`). Die Setup-Action (`setup-claude`) hängt bei `needs-mcp: true` die
KoliBri-Tools (`mcp__kolibri-mcp__*`) an die Allowlist aller Tiers; bei `browser-mcp: true` zusätzlich die
Playwright-Tools (`mcp__playwright__*`).

**Verfügbare Tools:**

- KoliBri: `mcp__kolibri-mcp__search` (Komponenten-Suche), `mcp__kolibri-mcp__fetch` (Beispiel/Dokument)
- Playwright: `mcp__playwright__browser_navigate`, `mcp__playwright__browser_snapshot`,
  `mcp__playwright__browser_take_screenshot`, `mcp__playwright__browser_resize`, u.a.

**Chromium + Hintergrund-App:** Die Phasen mit Browser-MCP (02/04/06) installieren Chromium (cached,
`pnpm --filter frontend exec playwright install --with-deps chromium`), bauen den Server vorab
(`pnpm --filter server build`) und starten die Inspect-Instanz im Hintergrund
(`INSPECT_NO_WATCH=1 nohup ./ui-inspect.sh` mit Readiness-Check auf http://localhost:4174, Timeout 120s —
ohne nodemon-Watch/Rebuild startet der Server in Sekunden; bei Timeout landen die letzten Log-Zeilen
in der Step-Ausgabe).
Der Runner killt den Prozess am Ende; `ui-inspect.sh` hat einen trap für eigenen Cleanup.

## Weiches Zeitlimit (Soft-Abort)

Statt harten `timeout-minutes` nutzt jeder Workflow ein **weiches Timeout**, das der Agent über
die instruierte Deadline selbst kontrolliert:

- **Phase 1 (Triage/Review/Fixup)**: Soft-Deadline 10 Minuten (`now+600`)
- **Phase 2 (Spec/Implement)**: Soft-Deadline 14 Minuten (`now+840`)

Der `starttime`-Step setzt die Soft-Deadline. Der Prompt instruiert den Agenten, VOR jedem
Teilschritt `date +%s` gegen die Deadline zu prüfen. Bei Erreichen:

1. **Arbeit sichern** — Zwischenstand in Body-Block/Dokumentation schreiben
2. **Kein Abschluss-Label** setzen — verhindert automatische Weiterleitung
3. **Trigger-Label entfernen** + **sofort neu setzen** (z.B. `ai:needs-impl` entfernen + wieder setzen)
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
das Label **`ai:to-big-issue`** (und entfernt zusätzlich den Phasen-Trigger `ai:needs-impl` bzw.
`ai:needs-spec`, damit er nicht erneut aufgegriffen wird) — als Kandidat zum **Aufteilen** in
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
frei, sobald **alle** seine Blocker gemergt/geschlossen sind (Fan-in-Gate) — indem es
`ai:needs-analyse` **per App-Token** setzt und so die Re-Triage gegen den nun gemergten Code-Stand
anstößt.

### Continue-Sweep (`claude-continue-sweep.yml`)

Sicherheitsnetz für hängengebliebene Phasen (Issue #894): Der Soft-Abort-Selbstretrigger läuft
im sterbenden Job — stirbt der Lauf davor (Runner-Ausfall, Cancel, hartes Timeout), klebt das
Trigger-Label am Issue/PR, ohne dass ein Folge-Event die Phase weckt. Der Sweep prüft alle
6 Stunden (00:05/06:05/12:05/18:05 Europe/Berlin; DST-korrekt über zwei UTC-Crons plus
Laufzeit-Guard der Berliner Stunde) je Phase, ob sie ruht (kein `queued`/`in_progress`-Run,
jüngster Run älter als 10 Minuten) und dennoch ein Trigger-Label klebt — und feuert dieses
per App-Token neu (entfernen + setzen, gleiche Mechanik wie der Selbstretrigger). Bewusst
nie geweckt: `ai:to-big-issue`, `ai:needs-human`, Draft-PRs. `ai:continued` wird nie angefasst
und nie als Detektions-Kriterium genutzt — der geweckte Folgelauf liest den Marker selbst und
setzt fort statt neu zu starten. Der `ai:needs-human`-Ausschluss ist zweistellig: Die Sweep-
Suche ist nur Schicht 1 — Schicht 2 ist der globale Parker-Check im Phasen-Pre-Check
(`check-phase-label.sh`), der jede Phase (außer documenter) blockt, auch wenn ein Trigger-Label
klebt (manuell gesetzt oder Suchindex-Lag), und damit die Endlosschleife unmöglich macht.

### Named Session Resume (Stufe 2, aktuell nicht aktiv)

Die Session-Resume-Funktionalität (MIG-002) ist noch nicht aktiviert. Derzeit startet jeder Lauf
frisch ohne Kontext aus vorherigen Läufen derselben Phase. Der Zielzustand ist als Stufe 2 in
[ADR 0006](./adr/0006-issue-storage-state-branch.md) entschieden (nur jüngste Session je Phase,
~5-MB-Cap, `--resume` ausschließlich beim `ai:continued`-Folgelauf derselben Phase) — aktiviert
wird sie erst, wenn `record-cost` belegt, dass Resumes nennenswert Wiederarbeit sparen. Mit
ADR 0007 ist der damalige Anker (`state.json` im Storage-Branch) entfallen; bei Aktivierung
braucht Stufe 2 einen neuen Session-ID-Speicher außerhalb des Merge-Pfads (s.
[ADR 0007](./adr/0007-issue-storage-harness-branch.md), Entscheidung Punkt 3).

## PR-Documenter: Arbeitsteilung Regel-Logik + LLM (Phase 7)

Der Post-Merge-Documenter ([06-claude-pr-documenter.yml](../.github/workflows/06-claude-pr-documenter.yml))
war anfangs eine reine Prompt-Phase — empirisch drifteten dabei Kommentar-Formate, blieben
Branch-Namen-Titel (`perf/#692: …`, `feat/issue-671-…`) unnormalisiert und landeten UX-Änderungen
unter `perf(...)` (feste Prompt-Regel `improved→perf`). Jetzt entscheidet Regel-Logik, das LLM
liefert nur Inhalte:

| Schritt            | Ausführung                                                                                                                                                                                                                                                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pr-doc-facts.sh`  | Bot-Erkennung (Autor + nur Dependency-Pfade), Conventional-Commits-Titelprüfung, Typ-/Scope-Vorschlag aus Pfaden                                                                                                                                                                                                            |
| Bot-SHORTCUT       | Dependency-Bot-/`release:ignore`-PRs: nur `ai:documented` (+ `release:ignore`) setzen — **ohne** LLM-Lauf                                                                                                                                                                                                                   |
| Claude             | Liest Diff + Issue und schreibt **nur** `/tmp/doc.json` (Klassifikation, Titel-Vorschlag, Texte; [documenter.md](../.github/prompts/documenter.md))                                                                                                                                                                         |
| `pr-doc-render.sh` | **Alle** Schreibzugriffe: Titel-Rename (validiert gegen dieselbe CC-Regex), Body-Sektion zwischen `<!-- ai-documenter-body -->`-Markern (Rest des Bodys bleibt unangetastet), GENAU EIN `<!-- ai-documenter -->`-Kommentar (PATCH statt Duplikat), Labels — `ai:documented` immer ZULETZT (fail-closed-Precheck-Invariante) |

Fällt Claude oder die Validierung aus, rendert der Fallback-Pfad eine Minimal-Dokumentation
(Minimal-Kommentar + `ai:documented` + `release:engineering`) und hält den Job grün — ein Re-Run
wäre durch den Precheck blockiert, ein roter Job also eine Sackgasse.

**Sprachregel:** PR-Titel und Haupttexte englisch (Conventional Commits, Subject klein, ≤72
Zeichen); die deutsche Zusammenfassung lebt in einer `<details>`-Box. Der Reviewer (Phase 5)
bekommt dieselben Titelfakten (`--mode title-only`) und korrigiert non-konforme Titel schon
**vor** dem Merge — post-merge ist ein Rename nur noch kosmetisch, der Merge-Commit-Subject
steht bereits.

## Release-Notes-Kette

Die `release:*`-Labels des Documenters (vergeben nach Klassifikation: `breaking→release:breaking-change`,
`new→release:feature`, `improved→release:improvement`, `fixed→release:fix`,
`internal→release:engineering`, Bot→`release:ignore`) speisen
[`.github/release.yml`](../.github/release.yml). Die Deploy-Pipeline taggt nach dem Patch-Bump
`v<Version>` und erstellt via `gh release create --generate-notes` das GitHub-Release — Notes
erscheinen kategorisiert (Breaking/Features/Fixes/Improvements/Engineering); Bot-PRs sind per
`exclude.authors` **und** `release:ignore` doppelt ausgeschlossen. Der Release-Schritt ist
best-effort: ein Fehlschlag warnt, kippt aber nie das Deploy.

## Aufrufpfade der Kreuzverhör-Workflows

1. **Chat/REPL (interaktiv):** Trigger-Phrasen aktivieren den Agenten direkt: „Kreuzverhör",
   „nimm das auseinander", „stress-teste das", „challenge mich".
2. **Skill:** `review-kreuzverhoer` ([SKILL.md](../.claude/skills/review-kreuzverhoer/SKILL.md), mit PR-Nummer).
3. **GitHub Actions (automatisch):** `05-claude-pr-review.yml` feuert, wenn ein PR das Label
   `ai:needs-review` trägt.

In **GitHub Actions** läuft das über **Labels**: Der Umsetzungs-Workflow macht den PR
review-bereit und labelt ihn **selbst** mit `ai:needs-review`. Der separate
[`pr-needs-review-label.yml`](../.github/workflows/pr-needs-review-label.yml) reagiert bewusst
**NICHT** auf bot-erzeugte Draft→ready-Übergänge (nur auf menschliche Aktoren).

## Nightly Spec-Sync (`claude-spec-sync.yml`)

Keine Pipeline-Phase, sondern ein nächtlicher Helper-Workflow (täglich 03:37 UTC +
`workflow_dispatch`): Ein LLM-Lauf verifiziert die Specs in `docs/spec/` (`user-journeys.md` +
`issue-*.md`) gegen die tatsächliche Implementation (`frontend/src/`, `server/src/`,
`openapi.yml`) und hält sie auf **Ist-Stand** — die Implementation ist die Wahrheit, die Spec
spiegelt sie nur. Leitlinie ist das **arc42-Prinzip** (so viel wie nötig, so wenig wie möglich):
Nur langfristig relevantes, von außen sichtbares Verhalten ist Spec-Information. Drei
Operationen: **korrigieren** (Impl hat sich geändert → Spec folgt), **entsorgen** (einzelne
Aussagen ohne langfristigen Spec-Wert — insb. transitorische Soll-Aussagen — sowie ganze
Dateien ohne langfristigen Spec-Wert: Test-Protokolle, Validierungs-Platzhalter, vollständig
redundant abgebildete Journeys werden gelöscht bzw. an einer Stelle konsolidiert),
**ergänzen** (implementiertes, un-spezifiziertes Verhalten bekommt neue
Journeys im user-journeys.md-Format).

**Mechanik:**

- **Skip-Guard:** Hat `main` denselben SHA wie der letzte erfolgreiche Lauf, wird der Lauf
  übersprungen (deterministisch dasselbe Ergebnis, spart LLM-Budget). Fail-open bei API-Fehlern;
  `workflow_dispatch` mit `force: true` umgeht den Guard.
- **Branch/PR (Sammel-Modell):** Der Agent committed nur lokal auf `chore/spec-sync-work` (nie
  gepusht). Die Mechanik überträgt diff-basiert für alle geänderten Spec-Dateien den finalen Stand
  auf einen Sammel-Branch `chore/spec-sync-all` und erzeugt daraus **einen Sammel-PR (Non-Draft)**
  mit direkt gesetztem `ai:needs-review`-Label per App-Token — dies ersetzt das früere Modell
  (Branch/PR pro Datei, `chore/spec-sync/<stem>`). Das Label-Setzen erfolgt mit Retry (3 Versuche);
  bei endgültigem Fehlschlag fällt der Lauf laut (`::error` + Exit 1). PR-Body ist der aggregierte
  Agent-Report mit je einem `## <dateiname>`-Abschnitt pro Spec-Datei (Fallback: `git log`, mit Warning).
- **Pipeline-Integration:** Das Label wird per App-Token direkt nach PR-Create gesetzt
  (Autolabeler `pr-needs-review-label.yml` greift bei Bots nicht). Das `labeled`-Event
  feuert → Kreuzverhör-Review (05) und Fixup-Loop (06) übernehmen Prüfung und Nacharbeitung
  automatisch, ohne Menschseingriff. Ein Workflow-Rerun bleibt idempotent (offene Sync-PRs
  → Skip mit Notice).
- **Post-Assertion (VERDICT-Muster):** `VERDICT: synced` ↔ null Commits (0-PR-Pfad: kein PR
  erzeugt), `VERDICT: updated` ↔ Commits vorhanden, geänderte Dateien ⊆ `docs/spec/` — jeder
  Widerspruch failt laut. In-Flight-Guard via Pipeline-Labels (`ai:needs-review`,
  `ai:needs-human`) verhindert konkurrierende Spec-Änderungen.
- **Bewusst stateless:** Kein pro-Issue-Memory — die offenen Draft-PRs sind der einzige Zustand.
- **Modell:** `vars.CLAUDE_MODEL_SPEC_SYNC` (Default `sonnet`), Provider wie alle LLM-Phasen via
  `vars.LLM_PROVIDER` (setup-claude, `tools-tier: full`, inkl. Tailscale-Egress und
  Fair-Usage-Check).

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
- **In-Flight-Guard:** Trägt der offene Sync-PR gerade `ai:needs-review`, `ai:needs-fixup`,
  `ai:reviewed` oder (terminal) `ai:needs-human`, wird der Lauf ausgesetzt. Sonst zieht der
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
