# PI Migration Plan: Claude Code → PI Coding Agent

> **Ziel:** Die 7-Phasen-Pipeline (Triage → UX → Spec → Implement → Review → Fixup → Documenter) plus Helper-Workflows (Guide-Sync, Spec-Sync, Continue-Sweep, Issue-Unblock) von **Claude Code CLI** auf **PI Coding Agent** umstellen.
>
> **Status:** Konzeptionsphase — noch keine Implementierung.

---

## 1. Architektureller Überblick

| Aspekt                       | Heute (Claude Code)                                          | Ziel (PI)                                                                             |
| ---------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| **Agent-Aufruf**             | `claude -p '<prompt>'` (Single-Query)                        | `pi --mode print` oder SDK `runPrintMode`                                             |
| **Provider-Switch**          | `setup-claude` Action: `ANTHROPIC_BASE_URL` + Auth-Variablen | `ModelRuntime` mit Runtime-API-Keys, Provider-Katalog                                 |
| **Modellwahl**               | Alias `fable                                                 | opus                                                                                  | sonnet | haiku`→`--model`oder`settings.local.json` | Echte Model-IDs (`anthropic/claude-opus-4-5`, `zai/glm-5.1`, `openrouter/...`) |
| **Tools**                    | `--allowedTools 'Read,Glob,Edit(.claude/memory/*),...'`      | SDK: `tools: ["read","bash","edit",...]`, Custom Tools für GitHub/Memory              |
| **MCP (KoliBri/Playwright)** | `mcp__kolibri-mcp__*`, `mcp__playwright__*` via `.mcp.json`  | **Kein MCP in PI** → Extensions oder CLI-Tools wrappen                                |
| **Session/Memory**           | GitHub Actions Artefakte (`claude-memory-issue-{N}`)         | PI Sessions (JSONL, Tree-Struktur) + Artefakt-Transport für CI                        |
| **Tailscale Exit-Node**      | Vor `claude -p` in `setup-claude`                            | Vor PI-Aufruf (identisch, nur anderer Binary)                                         |
| **Soft-Abort/Deadline**      | Prompt-intern: `date +%s` vs `SOFT_DEADLINE`                 | Gleiches Prinzip, aber PI-Event-Stream überwachen                                     |
| **VERDICT-Parsing**          | `grep 'VERDICT:'` aus stdout                                 | `--mode json` → strukturiertes `turn_end` Event, oder stdout-Parse bei `--mode print` |
| **Kosten/Token**             | `record-cost` Action (Anthropic-Response-Header)             | PI `session.agent.state` liefert Usage, oder `--mode json` Events                     |

---

## 2. Migrationsstrategie: Schrittweise, Phase für Phase

**Prinzip:** Eine Pipeline-Phase nach der anderen migrieren, Rest läuft weiter auf Claude Code. Kein Big-Bang.

### Phase 0: Vorbereitung (gemeinsame Basis)

1. **PI als Dependency** — `pnpm add -D @earendil-works/pi-coding-agent` (Root oder `server`? Besser Root, da alle Phasen es brauchen).
2. **PI-CLI im CI installieren** — analog `npm install -g @anthropic-ai/claude-code`, aber `npm install -g @earendil-works/pi-coding-agent` (oder `npx pi`).
3. **Provider-Konfiguration** — `ModelRuntime` Setup mit Secrets (`ANTHROPIC_API_KEY`, `ZAI_API_KEY`, `OPENROUTER_API_KEY`) als Runtime-Overrides (nicht persistiert).
4. **Session-Speicher für CI** — Ephemere Sessions (`--no-session`) oder In-Memory `SessionManager` für CI-Läufe; Persistenz nur für lokale Entwicklung.
5. **Shared SDK Wrapper** — Ein Node-Skript (z. B. `.github/scripts/pi-runner.ts`), das:
   - Provider + Modell auflöst (entspricht `setup-claude` Logik)
   - Prompt lädt (aus `.github/prompts/` + Memory-Snippets)
   - PI Session startet, Prompt sendet, Events verarbeitet
   - VERDICT extrahiert, Usage loggt, Ergebnis zurückgibt
   - Als CLI aufrufbar: `node .github/scripts/pi-runner.ts --phase triage --issue 123 --prompt-file /tmp/...`

### Phase 1: Triage (01-claude-triage.yml → 01-pi-triage.yml)

**Besonderheiten:** `tools-tier: restricted` (nur Lesen + Memory-Schreiben), `needs-mcp: true` (KoliBri).

**Änderungen:**

- `setup-claude` Action wird durch **eigenen Job-Step** ersetzt, der `pi-runner.ts` aufruft
- KoliBri-MCP → **PI Extension** (`kolibri-extension.ts`), die `mcp__kolibri-mcp__search/fetch` als PI-Tools registriert
- Memory: Statt Artefakt-Restore vorab → PI Session lädt vorherige Session (oder In-Memory State) via `SessionManager`
- VERDICT: Aus `turn_end` Event (JSON-Mode) oder stdout (Print-Mode) parsen
- Label-Post-Assertion bleibt **identisch** (bash-Script, liest VERDICT aus PI-Output)

### Phase 2: UX (02-claude-ux.yml)

**Besonderheiten:** `browser-mcp: true` (Playwright), laufende App auf localhost:4174.

**Änderungen:**

- Playwright-MCP → **PI Extension** (`playwright-extension.ts`) mit Tools: `browser_navigate`, `browser_snapshot`, `browser_resize`, `browser_take_screenshot`
- App-Start (`ui-inspect.sh`) bleibt unverändert (vor PI-Aufruf)
- Extension registriert Tools nur bei `browser-mcp=true`

### Phase 3: Spec (03-claude-spec.yml)

**Besonderheiten:** `tools-tier: full`, Draft-PR erzeugen, rote Tests schreiben.

**Änderungen:**

- Kein MCP nötig
- Git-Operationen (Branch, Commit, Push) → **Custom Tools** (`git_create_branch`, `git_commit`, `git_push`, `gh_pr_create`)
- Oder: PI ruft `bash` mit `gh`/`git` auf (bereits built-in `bash` Tool)

### Phase 4: Implement (04-claude-implement.yml)

**Besonderheiten:** `browser-mcp: true`, volle Autonomie, Tests grün machen.

**Änderungen:**

- Wie Phase 2 + 3 kombiniert: Playwright-Extension + Git-Tools

### Phase 5: Review (05-claude-pr-review.yml)

**Besonderheiten:** PR-Review via Kreuzverhör-Skill, `tools-tier: review` (Read-only + Memory).

**Änderungen:**

- Skill `review-kreuzverhoer` → **PI Skill** (`.pi/skills/review-kreuzverhoer/SKILL.md`) — PI lädt Skills nativ
- Tools: Read-only + Memory-Edit

### Phase 6: Fixup (06-claude-pr-fixup.yml)

**Besonderheiten:** Wie Implement, aber auf bestehendem PR-Branch.

### Phase 7: Documenter (07-claude-pr-documenter.yml)

**Besonderheiten:** Post-Merge, Arbeitsteilung: `pr-doc-facts.sh` (Regel-Logik) + LLM (Klassifikation/Texte) + `pr-doc-render.sh` (Schreibzugriffe).

**Änderungen:**

- LLM-Teil → PI `--mode print` oder SDK
- Regel-Logik (Shell-Scripts) bleibt **unverändert**

---

## 3. Detaillierte technische Mapping-Tabelle

### 3.1 Provider & Auth

| Claude Code (setup-claude)                                                                                                        | PI (ModelRuntime)                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `vars.LLM_PROVIDER=claude` + `CLAUDE_API_KEY` → `ANTHROPIC_API_KEY` oder `CLAUDE_CODE_OAUTH_TOKEN`                                | `modelRuntime.setRuntimeApiKey("anthropic", key)`                                                   |
| `vars.LLM_PROVIDER=zai` + `ZAI_API_KEY` → `ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic`, `ANTHROPIC_AUTH_TOKEN`             | `modelRuntime.setRuntimeApiKey("zai", key)` + Custom Provider in `models.json`                      |
| `vars.LLM_PROVIDER=openrouter` + `OPENROUTER_API_KEY` → `ANTHROPIC_BASE_URL=https://openrouter.ai/api/v1`, `ANTHROPIC_AUTH_TOKEN` | `modelRuntime.setRuntimeApiKey("openrouter", key)` (built-in)                                       |
| Modell-Aliase via `ANTHROPIC_DEFAULT_*_MODEL`                                                                                     | Echte Model-IDs: `anthropic/claude-opus-4-5`, `zai/glm-5.1`, `openrouter/anthropic/claude-opus-4-5` |

**Custom Provider für z.ai (falls nicht built-in):**

```json
// ~/.pi/agent/models.json oder .pi/models.json
{
	"customProviders": [
		{
			"id": "zai",
			"name": "ZAI",
			"api": "anthropic",
			"baseUrl": "https://api.z.ai/api/anthropic",
			"models": [
				{ "id": "glm-5.1", "name": "GLM-5.1", "attachment": false, "reasoning": true, "toolUse": true },
				{ "id": "glm-4.7", "name": "GLM-4.7", "attachment": false, "reasoning": true, "toolUse": true },
				{ "id": "glm-4.5-air", "name": "GLM-4.5-Air", "attachment": false, "reasoning": false, "toolUse": true }
			]
		}
	]
}
```

### 3.2 Modell-Mapping pro Phase

| Phase      | Heute (Alias) | PI Model-ID (claude)                  | PI Model-ID (zai) | PI Model-ID (openrouter)                 |
| ---------- | ------------- | ------------------------------------- | ----------------- | ---------------------------------------- |
| Triage     | `fable`       | `anthropic/claude-fable-5`            | `zai/glm-5.2`     | `openrouter/anthropic/claude-3-5-haiku`  |
| Spec       | `sonnet`      | `anthropic/claude-sonnet-5`           | `zai/glm-4.7`     | `openrouter/anthropic/claude-3-5-sonnet` |
| UX         | `sonnet`      | `anthropic/claude-sonnet-5`           | `zai/glm-4.7`     | `openrouter/anthropic/claude-3-5-sonnet` |
| Implement  | `opus`        | `anthropic/claude-opus-5`             | `zai/glm-5.1`     | `openrouter/anthropic/claude-opus-4-5`   |
| Review     | `opus`        | `anthropic/claude-opus-5`             | `zai/glm-5.1`     | `openrouter/anthropic/claude-opus-4-5`   |
| Fixup      | `sonnet`      | `anthropic/claude-sonnet-5`           | `zai/glm-4.7`     | `openrouter/anthropic/claude-3-5-sonnet` |
| Documenter | `haiku`       | `anthropic/claude-haiku-4-5-20251001` | `zai/glm-4.5-air` | `openrouter/anthropic/claude-3-5-haiku`  |

> **Hinweis:** PI kennt `fable` nicht als separates Modell — `claude-fable-5` ist ein Alias für `claude-3-5-haiku-20241022` o.ä. Mapping in `pi-runner.ts` pflegen.

### 3.3 Tools-Mapping

| Claude Code `--allowedTools`     | PI SDK `tools` / Custom Tools                                                 |
| -------------------------------- | ----------------------------------------------------------------------------- |
| `Read,Glob,Grep,Bash,Write,Edit` | `["read","bash","edit","write","grep","find","ls"]` (built-in)                |
| `Bash(gh *)`, `Bash(git *)`      | Custom Tools: `gh_api`, `git_cmd` (sicherer als globales `bash`)              |
| `Edit(.claude/memory/*)`         | Built-in `edit` + Pfad-Prüfung in Custom Tool Wrapper                         |
| `Task` (Subagents)               | PI Subagents via Extension oder SDK `session.agent.spawnSubagent()`           |
| `mcp__kolibri-mcp__search/fetch` | **Extension Tool** `kolibri_search`, `kolibri_fetch`                          |
| `mcp__playwright__browser_*`     | **Extension Tool** `pw_navigate`, `pw_snapshot`, `pw_resize`, `pw_screenshot` |

**Empfehlung:** Für CI **kein globales `bash`**, sondern gezielte Custom Tools (`gh_label`, `gh_issue_edit`, `gh_pr_create`, `git_commit_push`). Das entspricht dem `tools-tier` Sicherheitsmodell.

### 3.4 Memory & Session Handling

| Heute                                                                   | PI                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Artefakt `claude-memory-issue-{N}` (JSONL-Dateien in `.claude/memory/`) | PI Session JSONL (Tree-Struktur) — **aber**: CI braucht Persistenz über Job-Grenzen hinweg                                                                                                                                                                                                          |
| `memory-load` Step restored Artefakt in `.claude/memory/`               | **Option A:** PI Session pro Issue als Artefakt speichern (`pi-session-issue-{N}.jsonl`), nächste Phase lädt via `SessionManager.open()`<br>**Option B:** In-Memory `SessionManager` + nur `MEMORY.md` (eingecheckt) als persistent State; Phasen-Notizen als Issue-Kommentare oder Dateien im Repo |
| `autoMemoryDirectory: .claude/memory` in `.claude/settings.json`        | PI Session-Datei liegt woanders; `MEMORY.md` bleibt eingecheckt                                                                                                                                                                                                                                     |

**Empfehlung Option A:** PI Session als Artefakt transportieren. `SessionManager` kann JSONL-Datei laden/speichern. Vorteil: Volle Conversation-History, Tree-Branching, Compaction erhalten.

### 3.5 MCP → PI Extensions

PI hat **kein MCP**. Zwei Wege:

1. **Extension wrapt MCP-Client** — Extension startet MCP-Server (stdio) und ruft Tools via JSON-RPC auf. PI Extension API erlaubt beliebiges Node.js.
2. **Direkte Implementation** — KoliBri-Suche via HTTP gegen `https://kolibri-docs.earendil.work` (oder lokale Instanz); Playwright via `@playwright/test` direkt in Extension-Tool.

**Empfehlung:** Direkte Implementation (leichter, weniger Moving Parts). KoliBri-MCP ist ohnehin nur HTTP-Wrapper um Doku-Suche.

**Extension-Struktur (Beispiel KoliBri):**

```typescript
// .pi/extensions/kolibri-extension.ts
import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function (pi) {
  pi.registerTool(defineTool({
    name: "kolibri_search",
    label: "KoliBri Search",
    description: "Search KoliBri components",
    parameters: Type.Object({ query: Type.String() }),
    execute: async (_id, { query }) => {
      const res = await fetch(`https://kolibri-docs.earendil.work/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], details: {} };
    }
  }));
  pi.registerTool(defineTool({ ... fetch ... }));
}
```

### 3.6 Soft-Abort / Deadline Handling

| Heute                                                                          | PI                                                                                       |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Prompt enthält `SOFT_DEADLINE` Epoch, Agent prüft vor jedem Schritt `date +%s` | **Gleiches Prinzip:** Prompt enthält Deadline, PI-Agent prüft via `bash` Tool `date +%s` |
| Bei Erreichen: Body-Block sichern, Turn beenden, Label re-arm                  | Identisch: PI `abort()` aufrufen oder Prompt mit "STOP" steuern                          |
| Max 1 Selbst-Retrigger via Label entfernen+setzen                              | Identisch: Workflow-Logik unverändert                                                    |

**Zusatz:** PI Event-Stream (`turn_start`, `turn_end`) erlaubt **externes** Deadline-Monitoring im Wrapper-Skript — präziser als Prompt-intern.

### 3.7 VERDICT-Extraktion

| Heute                                    | PI (`--mode json`)                                                           |
| ---------------------------------------- | ---------------------------------------------------------------------------- |
| `grep 'VERDICT:' /tmp/claude-output.log` | Event `turn_end` → `event.message.content` parsen                            |
| Falls Fehlschlag: `exit 1`               | Wrapper wertet `turn_end` aus, schreibt VERDICT nach stdout für Label-Script |

**Wrapper-Output-Format (stdout):**

```
... PI Streaming Output ...
VERDICT: spec-ready
TOKENS_IN: 12345
TOKENS_OUT: 6789
COST_USD: 0.045
```

Label-Post-Assertion Script bleibt **unverändert** (liest stdout).

---

## 4. Neuer Shared Wrapper: `pi-runner.ts`

Ein **einziger** Node-Einstiegspunkt für alle 7 Phasen + Helper-Workflows.

```typescript
// .github/scripts/pi-runner.ts
import {
	createAgentSession,
	ModelRuntime,
	SessionManager,
	DefaultResourceLoader,
	getAgentDir,
	defineTool,
	Type,
} from '@earendil-works/pi-coding-agent';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// 1. CLI Args parsen: --phase, --issue, --prompt-file, --provider, --model, --tools-tier, --needs-mcp, --browser-mcp, --memory-load, --expect-memory
// 2. ModelRuntime erstellen, Runtime-API-Keys setzen (aus process.env Secrets)
// 3. Provider-spezifische Model-ID auflösen (Mapping-Tabelle)
// 4. ResourceLoader: Extensions (KoliBri, Playwright bedingt), Skills, Prompts, AGENTS.md
// 5. Custom Tools registrieren: gh_*, git_*, memory_*, kolibri_*, playwright_*
// 6. SessionManager: In-Memory oder Datei-basiert (Artefakt-Pfad)
// 7. Prompt laden, Platzhalter ersetzen (#ISSUE_NR, #PHASE, #MEMORY_STATUS, SOFT_DEADLINE)
// 8. Session starten, prompt() mit streamingBehavior="followUp" (kein Streaming in CI)
// 9. Events sammeln: turn_end → VERDICT, Usage, Cost
// 10. Session speichern (falls Datei-basiert) für Artefakt-Upload
// 11. VERDICT + Usage auf stdout schreiben (für Label-Post-Assertion + record-cost)
```

**Aufruf im Workflow:**

```yaml
- name: Run PI Agent
  id: pi
  env:
    GH_TOKEN: ${{ steps.setup.outputs.gh-token }} # für Custom Tools
    ANTHROPIC_API_KEY: ${{ secrets.CLAUDE_API_KEY }}
    ZAI_API_KEY: ${{ secrets.ZAI_API_KEY }}
    OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
    TAILSCALE_EXIT_NODE: ${{ vars.TAILSCALE_EXIT_NODE }}
  run: |
    npx tsx .github/scripts/pi-runner.ts \
      --phase triage \
      --issue ${{ github.event.issue.number }} \
      --prompt-file /tmp/claude-prompt.txt \
      --provider ${{ vars.LLM_PROVIDER || 'claude' }} \
      --model ${{ vars.CLAUDE_MODEL_TRIAGE || 'fable' }} \
      --tools-tier restricted \
      --needs-mcp true \
      --memory-load true \
      --expect-memory false \
      2>&1 | tee /tmp/pi-output.log
```

---

## 5. Workflow-Änderungen pro Phase

### 5.1 Gemeinsame Änderungen (alle Phasen)

1. **`setup-claude` Action entfernen** → durch `pi-runner.ts` Step ersetzt
2. **Tailscale Steps** bleiben **identisch** (laufen vor PI-Aufruf)
3. **Memory-Artefakt** → PI-Session-Artefakt (Name: `pi-session-issue-{N}`)
4. **`record-cost` Action** → liest Usage aus PI-Output (stdout `TOKENS_IN/OUT/COST`)
5. **Label-Post-Assertion** → liest `VERDICT:` aus PI-Output (unverändert)
6. **`llm-fair-usage-check`** → prüft PI-Output auf z.ai Fair-Usage-Fehler

### 5.2 Phasen-spezifisch

| Phase      | Workflow-Datei            | Besondere Anpassungen                                                               |
| ---------- | ------------------------- | ----------------------------------------------------------------------------------- |
| Triage     | `01-pi-triage.yml`        | `--tools-tier restricted --needs-mcp true --memory-load true --expect-memory false` |
| UX         | `02-pi-ux.yml`            | `--tools-tier full --needs-mcp true --browser-mcp true` + App-Start vorab           |
| Spec       | `03-pi-spec.yml`          | `--tools-tier full` + Git-Custom-Tools                                              |
| Implement  | `04-pi-implement.yml`     | `--tools-tier full --browser-mcp true` + Git-Custom-Tools                           |
| Review     | `05-pi-pr-review.yml`     | `--tools-tier review --needs-mcp true` + Skill `review-kreuzverhoer`                |
| Fixup      | `06-pi-pr-fixup.yml`      | `--tools-tier full --browser-mcp true` + Git-Custom-Tools                           |
| Documenter | `07-pi-pr-documenter.yml` | `--tools-tier full` (nur LLM-Teil), Shell-Scripts bleiben                           |

### 5.3 Helper-Workflows

- `claude-guide-sync.yml` → `pi-guide-sync.yml` (nur LLM-Teil via PI)
- `claude-spec-sync.yml` → `pi-spec-sync.yml` (nur LLM-Teil via PI)
- `claude-continue-sweep.yml` → **unverändert** (nur Label-Logik, kein LLM)
- `claude-issue-unblock.yml` → **unverändert** (nur GraphQL, kein LLM)

---

## 6. Offene Fragen & Entscheidungsbedarf

| Frage                                  | Optionen                                                                                                                                                          | Empfehlung                                                                                |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Session-Persistenz in CI**           | A) PI Session als Artefakt (JSONL)<br>B) Nur `MEMORY.md` (eingecheckt) + Phasen-Notizen als Issue-Kommentare<br>C) In-Memory, kein Cross-Job-State                | **A** — vollständige History, Compaction, Branching erhalten. Artefakt-Größe ~100-500 KB. |
| **Custom Tools vs. `bash`**            | A) Nur `bash` (einfach, aber unsicher)<br>B) Custom Tools für `gh`, `git`, Memory, KoliBri, Playwright<br>C) Hybrid: `bash` für Read-only, Custom Tools für Write | **B** — entspricht `tools-tier` Sicherheitsmodell, auditierbar.                           |
| **MCP → Extension Migration**          | A) MCP-Client in Extension (behält MCP-Server)<br>B) Native Implementation (HTTP/Playwright direkt)                                                               | **B** — weniger Abhängigkeiten, PI-nativ.                                                 |
| **Subagents (Task-Tool)**              | A) PI Subagent API (`session.agent.spawnSubagent`)<br>B) Nicht nutzen, Fan-out via Prompt-Chaining<br>C) Extension registriert `task` Tool                        | **A** — PI hat natives Subagent-Konzept, effizienter für Recherche-Fan-out.               |
| **Model-Aliase (fable/opus/…)**        | A) Mapping-Tabelle in `pi-runner.ts` pflegen<br>B) GitHub Variables für echte Model-IDs nutzen                                                                    | **A** — Variables sind pro Phase bereits vorhanden (`CLAUDE_MODEL_*`), Mapping einmalig.  |
| **ZAI Zeitfenster (08-12 Uhr Berlin)** | A) In `pi-runner.ts` prüfen, Provider auf `anthropic` fallen<br>B) In Workflow vor PI-Aufruf prüfen, `provider` Input ändern                                      | **B** — konsistent mit heutiger Logik in `setup-claude`, separierbar.                     |

---

## 7. Risiken & Mitigation

| Risiko                         | Wahrscheinlichkeit | Impact  | Mitigation                                                                                      |
| ------------------------------ | ------------------ | ------- | ----------------------------------------------------------------------------------------------- |
| **PI Extension API instabil**  | Mittel             | Hoch    | Erst KoliBri/Playwright Extensions lokal entwickeln & testen, dann CI                           |
| **Token-Counting anders**      | Hoch               | Mittel  | `record-cost` Action an PI-Output anpassen (Usage aus `turn_end` Event)                         |
| **Prompt-Kompatibilität**      | Niedrig            | Niedrig | Prompts sind Text — unverändert nutzbar. Nur Tool-Namen ändern (MCP → Extension).               |
| **Session-Artefakt zu groß**   | Niedrig            | Niedrig | Compaction in PI aktivieren, `retention-days: 14` wie heute.                                    |
| **Parallelitätsgrenzen (zai)** | Gleich             | Gleich  | Unverändert: `concurrency` Groups in Workflows, PI nutzt gleiche API-Limits.                    |
| **Tailscale + PI**             | Niedrig            | Hoch    | Tailscale Steps laufen **vor** PI-Aufruf — identisch zu heute.                                  |
| **VERDICT nicht gefunden**     | Mittel             | Hoch    | Wrapper schreibt VERDICT **immer** am Ende (auch bei Abbruch/Error), Label-Script prüft strikt. |

---

## 8. Implementierungs-Reihenfolge (Meilensteine)

### M0: Foundation (1-2 Tage)

- [ ] `pnpm add -D @earendil-works/pi-coding-agent`
- [ ] `pi-runner.ts` Grundgerüst (Provider/Auth/Model-Auflösung, SessionManager, Prompt-Loading)
- [ ] Custom Tools: `gh_label`, `gh_issue_edit`, `gh_pr_create`, `git_commit_push`, `memory_read`, `memory_write`
- [ ] Test: Triage-Prompt lokal mit `npx tsx pi-runner.ts --phase triage --issue 123`

### M1: KoliBri & Playwright Extensions (2-3 Tage)

- [ ] `kolibri-extension.ts` (search, fetch via HTTP)
- [ ] `playwright-extension.ts` (navigate, snapshot, resize, screenshot via `@playwright/test`)
- [ ] Integration in `pi-runner.ts` (bedingtes Laden via `--needs-mcp` / `--browser-mcp`)
- [ ] Test: UX-Phase lokal gegen laufende App

### M2: Triage-Phase migrieren (1 Tag)

- [ ] `01-pi-triage.yml` erstellen (Kopie von 01-claude-triage.yml, `setup-claude` → `pi-runner`)
- [ ] Label-Post-Assertion & record-cost unverändert lassen
- [ ] CI-Test: `ai:needs-analyse` auf Test-Issue setzen

### M3: Spec & Implement migrieren (2 Tage)

- [ ] Git-Custom-Tools finalisieren
- [ ] `03-pi-spec.yml`, `04-pi-implement.yml`
- [ ] Draft-PR Erzeugung, Test-Runs validieren

### M4: Review & Fixup migrieren (1-2 Tage)

- [ ] Skill `review-kreuzverhoer` als PI-Skill (`.pi/skills/.../SKILL.md`)
- [ ] `05-pi-pr-review.yml`, `06-pi-pr-fixup.yml`
- [ ] Review-Loop testen

### M5: Documenter & Helper migrieren (1 Tag)

- [ ] `07-pi-pr-documenter.yml` (nur LLM-Teil)
- [ ] `pi-guide-sync.yml`, `pi-spec-sync.yml`
- [ ] Nightly Runs validieren

### M6: Cutover & Cleanup (1 Tag)

- [ ] `vars.LLM_PROVIDER` Default auf `claude` belassen (PI nutzt gleiche Secrets)
- [ ] Alte `0*-claude-*.yml` Workflows deaktivieren (nicht löschen — Rollback)
- [ ] `setup-claude` Action archivieren
- [ ] Dokumentation aktualisieren

---

## 9. Rollback-Plan

Falls PI in der Prod-Pipeline Probleme macht:

1. **Workflow-Dateien:** Alte `0*-claude-*.yml` sind unverändert im Repo → einfach `ai:needs-analyse` Label setzen, alter Workflow triggert.
2. **`setup-claude` Action:** Bleibt im Repo (nicht gelöscht).
3. **Secrets/Variables:** Unverändert (`CLAUDE_API_KEY`, `ZAI_API_KEY`, `LLM_PROVIDER`, `CLAUDE_MODEL_*`).
4. **Memory-Artefakte:** PI schreibt `pi-session-issue-{N}`, Claude Code sucht `claude-memory-issue-{N}` — **kein Konflikt**. Bei Rollback fehlt nur der PI-Kontext (neuer Lauf startet frisch).
5. **PRs in Flight:** Review/Fixup laufen auf Claude Code weiter, da PR-Label `ai:needs-review` unverändert funktioniert.

---

## 10. Lokale Entwicklung mit PI

Entwickler können PI **parallel** zu Claude Code nutzen:

```bash
# Global installieren
npm install -g @earendil-works/pi-coding-agent

# Oder via npx
npx pi

# Mit Projekt-Kontext (lädt .pi/settings.json, .pi/extensions, AGENTS.md)
pi --name "priority-pilot feature"

# Non-interaktiv für Scripting
pi -p "Review the changes in PR #123"
```

**Projekt-Setup (`.pi/settings.json`):**

```json
{
	"model": "anthropic/claude-opus-4-5",
	"thinkingLevel": "medium",
	"tools": ["read", "bash", "edit", "write", "grep", "find", "ls"],
	"extensions": ["./extensions"],
	"skills": ["./skills"],
	"prompts": ["./prompts"]
}
```

**Lokale Extensions/Skills** (für Dogfooding):

- `.pi/extensions/kolibri-extension.ts`
- `.pi/extensions/playwright-extension.ts`
- `.pi/skills/review-kreuzverhoer/SKILL.md` (Kopie aus `.claude/skills/...`)

---

## 11. Kosten-Vergleich (Schätzung)

| Faktor                  | Claude Code                          | PI (SDK/CLI)                                      |
| ----------------------- | ------------------------------------ | ------------------------------------------------- |
| **API-Kosten**          | Identisch (gleiche Provider/Modelle) | Identisch                                         |
| **Token-Overhead**      | System-Prompt ~4k, Tools ~2k         | Vergleichbar (System-Prompt konfigurierbar)       |
| **CI-Laufzeit**         | `claude -p` Startup ~3-5s            | `pi --mode print` Startup ~2-4s (ähnlich)         |
| **Cache-Hits**          | Anthropic Prompt Caching (1h/24h)    | PI `PI_CACHE_RETENTION=long` nutzt gleiche Caches |
| **Entwicklungsaufwand** | —                                    | Einmalig ~10-15 Tage (Plan oben)                  |

**Fazit:** Laufende Kosten **gleich**, einmaliger Migrationsaufwand. Vorteil: Kein Vendor-Lock-in, volle Kontrolle über Tools/Extensions, Multi-Provider nativ.

---

## 12. Nächste Schritte

1. **Entscheidung:** Migration gewünscht? (Ja/Nein/Später)
2. **Bei Ja:** M0 starten — `pi-runner.ts` + Custom Tools + Extensions lokal entwickeln
3. **Review:** Nach M1 (Extensions fertig) erste CI-Test-Runs auf Feature-Branch
4. **Go/No-Go** vor M2 (Triage-Migration)

---

_Anhänge:_

- [PI SDK Docs](https://pi.dev/docs/sdk.md)
- [PI Extensions Guide](https://pi.dev/docs/extensions.md)
- [PI Skills Spec](https://pi.dev/docs/skills.md)
- [Aktuelle Pipeline-Docs](docs/ci-architecture.md)
- [Pipeline Flow Diagram](docs/pipeline-flow.md)
