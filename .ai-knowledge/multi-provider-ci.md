# Multi-Provider CI Setup (Claude / Z.ai / OpenRouter)

## Übersicht

**Drei Ebenen:**

1. **Pipeline-Workflows** (triage, spec, implement, review, fixup) — nutzen gemeinsame Action `.github/actions/setup-claude`
2. **CI Multi-Provider** (`.github/workflows/ci-multi-provider.yml`) — separater Workflow für Provider-Vergleich im CI (verify + e2e)
3. **Haupt-CI** (`.github/workflows/ci.yml`) — **Gate-Vertrag** (verify + e2e-sharded), keyt auf `name: CI`

Alle nutzen **GitHub Variables für Model-Config** (JSON), Secrets für Keys.

---

## GitHub Secrets (Settings → Secrets → Actions)

| Secret Name          | Wert           | Wird zu                                                        |
| -------------------- | -------------- | -------------------------------------------------------------- |
| `CLAUDE_API_KEY`     | `sk-ant-...`   | `ANTHROPIC_API_KEY` / `CLAUDE_CODE_OAUTH_TOKEN` (auto-erkannt) |
| `ZAI_API_KEY`        | `dein-zai-key` | `ANTHROPIC_AUTH_TOKEN`                                         |
| `OPENROUTER_API_KEY` | `sk-or-...`    | `ANTHROPIC_AUTH_TOKEN`                                         |

> **Pipeline + Haupt-CI (setup-claude Action):** claude nutzt `ANTHROPIC_API_KEY`/`CLAUDE_CODE_OAUTH_TOKEN`, zai/openrouter nutzen `ANTHROPIC_AUTH_TOKEN`.
> **CI Multi-Provider:** Alle drei → `ANTHROPIC_AUTH_TOKEN` (vereinfacht).

---

## GitHub Variables (Settings → Variables → Actions)

### `LLM_PROVIDER` (steuert **Pipeline-Workflows + Haupt-CI**)

| Wert         | Provider                  |
| ------------ | ------------------------- |
| `claude`     | Anthropic nativ (Default) |
| `zai`        | z.ai / GLM                |
| `openrouter` | OpenRouter                |

> Wird in allen 5 Pipeline-Workflows + `ci.yml` via `vars.LLM_PROVIDER` an `setup-claude` übergeben.

### `CLAUDE_CODE_SETTINGS_LOCAL_ZAI` (für **Pipeline + Haupt-CI + CI Multi-Provider**)

> Abo (GLM Coding Plan) umfasst nur `glm-4.7`, `glm-5-turbo`, `glm-5.3` — keine anderen GLM-IDs
> eintragen. Aktueller Stand (Alias-Mapping + Subagent-Modell):

```json
{
	"env": {
		"ANTHROPIC_BASE_URL": "https://api.z.ai/api/anthropic",
		"ANTHROPIC_DEFAULT_HAIKU_MODEL": "glm-4.7",
		"ANTHROPIC_DEFAULT_SONNET_MODEL": "glm-5.3[1m]",
		"ANTHROPIC_DEFAULT_OPUS_MODEL": "glm-5.3[1m]",
		"ANTHROPIC_DEFAULT_FABLE_MODEL": "glm-5.3[1m]",
		"CLAUDE_CODE_SUBAGENT_MODEL": "glm-5-turbo"
	},
	"model": "opus"
}
```

### `CLAUDE_CODE_SETTINGS_LOCAL_OPENROUTER` (für **Pipeline + Haupt-CI + CI Multi-Provider**)

```json
{
	"env": {
		"ANTHROPIC_BASE_URL": "https://openrouter.ai/api",
		"ANTHROPIC_DEFAULT_HAIKU_MODEL": "nvidia/nemotron-3-nano-30b-a3b:free",
		"ANTHROPIC_DEFAULT_SONNET_MODEL": "cohere/north-mini-code:free",
		"ANTHROPIC_DEFAULT_OPUS_MODEL": "nvidia/nemotron-3-ultra-550b-a55b:free",
		"ANTHROPIC_DEFAULT_FABLE_MODEL": "nvidia/nemotron-3-ultra-550b-a55b:free",
		"CLAUDE_CODE_SUBAGENT_MODEL": "nvidia/nemotron-3-nano-30b-a3b:free"
	}
}
```

> **Einzeilig** in GitHub UI einfügen (keine Newlines). Dienen **allen drei** Systemen.

---

## Wie es funktioniert

### Pipeline-Workflows + Haupt-CI (via `setup-claude` Action)

```yaml
# In jedem Workflow (01-05 + ci.yml):
- uses: ./.github/actions/setup-claude
  with:
    llm-provider: ${{ vars.LLM_PROVIDER }}
    zai-api-key: ${{ secrets.ZAI_API_KEY }}
    claude-api-key: ${{ secrets.CLAUDE_API_KEY }}
    openrouter-api-key: ${{ secrets.OPENROUTER_API_KEY }}
    # Optional: Variable-Namen für settings.local.json (Defaults)
    zai-settings-var: CLAUDE_CODE_SETTINGS_LOCAL_ZAI
    openrouter-settings-var: CLAUDE_CODE_SETTINGS_LOCAL_OPENROUTER
```

**Action `setup-claude` löst zur Laufzeit auf:**

| Provider     | Was passiert                                                                                                                                                                              |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `claude`     | Setzt `ANTHROPIC_API_KEY` oder `CLAUDE_CODE_OAUTH_TOKEN` (auto per Prefix `sk-ant-oat*`). Keine `settings.local.json`.                                                                    |
| `zai`        | 1. Liest Variable `CLAUDE_CODE_SETTINGS_LOCAL_ZAI` via `gh variable get`<br>2. Schreibt `.claude/settings.local.json` daraus<br>3. Setzt `ANTHROPIC_AUTH_TOKEN=ZAI_API_KEY`               |
| `openrouter` | 1. Liest Variable `CLAUDE_CODE_SETTINGS_LOCAL_OPENROUTER` via `gh variable get`<br>2. Schreibt `.claude/settings.local.json` daraus<br>3. Setzt `ANTHROPIC_AUTH_TOKEN=OPENROUTER_API_KEY` |

> **Model-Config ist NICHT im Action-Code hardcoded** — sie kommt aus GitHub Variables (JSON). Ein Ort für Änderungen.

### CI Multi-Provider (`.github/workflows/ci-multi-provider.yml`)

- Trigger: `workflow_dispatch` (Provider wählbar) + `schedule` (täglich 04:17)
- Baut `settings.local.json` zur Laufzeit aus GitHub Variables (inline, ohne `gh` CLI)
- **Alle 3 Provider → `ANTHROPIC_AUTH_TOKEN`** (vereinfacht)
- **Bricht NICHT Gate-Vertrag** (anderer Workflow-Name)

---

## Lokales Setup

Deine `.claude/settings.local.json` bleibt dein Default (z.B. OpenRouter):

```json
{
	"permissions": {
		"allow": ["Skill(update-config)"]
	},
	"env": {
		"ANTHROPIC_AUTH_TOKEN": "sk-or-v1-...",
		"ANTHROPIC_BASE_URL": "https://openrouter.ai/api",
		"ANTHROPIC_DEFAULT_HAIKU_MODEL": "nvidia/nemotron-3-nano-30b-a3b:free",
		"ANTHROPIC_DEFAULT_SONNET_MODEL": "cohere/north-mini-code:free",
		"ANTHROPIC_DEFAULT_OPUS_MODEL": "nvidia/nemotron-3-ultra-550b-a55b:free",
		"ANTHROPIC_DEFAULT_FABLE_MODEL": "nvidia/nemotron-3-ultra-550b-a55b:free",
		"CLAUDE_CODE_SUBAGENT_MODEL": "nvidia/nemotron-3-nano-30b-a3b:free"
	}
}
```

---

## CI Usage

```bash
# Pipeline + Haupt-CI: LLM_PROVIDER Variable in GitHub setzen (claude|zai|openrouter)
# Dann laufen ALLE Workflows (Pipeline + ci.yml) mit dem gewählten Provider

# CI Multi-Provider: explizit testen (Provider-Vergleich)
gh workflow run ci-multi-provider.yml -f provider=openrouter
gh workflow run ci-multi-provider.yml -f provider=zai
gh workflow run ci-multi-provider.yml  # Default: claude
```

---

## Architektur-Entscheidungen

1. **Eine Action (`setup-claude`)** für Pipeline + Haupt-CI — DRY, konsistent
2. **`LLM_PROVIDER` Variable** steuert Pipeline + Haupt-CI global — ein Ort für Provider-Wechsel
3. **Model-Config aus Variables (JSON)** — nicht hardcoded, in UI lesbar/änderbar, ein Source of Truth
4. **CI Multi-Provider separat** — für Provider-Vergleich, bricht **nicht** Gate-Vertrag
5. **Haupt-CI (`ci.yml`) nutzt `setup-claude`** — damit auch dort die Variables greifen

---

## Troubleshooting

| Problem                                   | Lösung                                                                                              |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Pipeline/Haupt-CI nutzt falschen Provider | `vars.LLM_PROVIDER` in GitHub prüfen (claude/zai/openrouter)                                        |
| Auth-Fehler                               | Secrets `CLAUDE_API_KEY` / `ZAI_API_KEY` / `OPENROUTER_API_KEY` gesetzt?                            |
| settings.local.json nicht erstellt        | Variables `CLAUDE_CODE_SETTINGS_LOCAL_*` existieren & valides JSON? `gh variable get` funktioniert? |
| Model falsch                              | Variables `CLAUDE_CODE_SETTINGS_LOCAL_*` prüfen (Base-URL + Model-Namen)                            |

---

## Dateien

- Action: `.github/actions/setup-claude/action.yml`
- Pipeline-Workflows: `.github/workflows/01-claude-triage.yml` bis `06-claude-pr-documenter.yml` (inkl. `02-claude-ux.yml`)
- Haupt-CI (Gate): `.github/workflows/ci.yml`
- CI Multi-Provider (Vergleich): `.github/workflows/ci-multi-provider.yml`
- Local Config: `.claude/settings.local.json` (gitignored)
- Docs: `.ai-knowledge/multi-provider-ci.md` (diese Datei)
