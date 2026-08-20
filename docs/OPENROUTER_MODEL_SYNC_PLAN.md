# Plan: OpenRouter Model Sync Workflow

## Ziel

Täglicher Workflow (oder manuell), der:

1. Freie Modelle von OpenRouter abruft (`/api/v1/models`, `pricing == 0`)
2. Per LLM die 5 besten Coding-Modelle evaluiert
3. Auf die 5 Claude-Rollen mapped: **OPUS, SONNET, HAIKU, FABLE, SUBAGENT**
4. `CLAUDE_CODE_SETTINGS_LOCAL_OPENROUTER` GitHub Variable aktualisiert

---

## Architektur

### Trigger

- **Schedule**: Täglich `03:07 UTC` (zwischen Guide-Sync 04:27 und Spec-Sync 03:37)
- **Manual**: `workflow_dispatch` mit Input `force: boolean` (Skip-Guard überspringen)

### Skip-Guard (wie `claude-spec-sync.yml` / `claude-guide-sync.yml`)

- Letzten erfolgreichen Run dieses Workflows auf `main` finden
- Wenn `head_sha == origin/main` SHA → Skip (mit `force=true` erzwingbar)

### Schritte

| Step               | Beschreibung                                                                           |
| ------------------ | -------------------------------------------------------------------------------------- |
| 1. Checkout        | `actions/checkout@v4`                                                                  |
| 2. App-Token       | `actions/create-github-app-token` (für `variables:write`)                              |
| 3. SHA-Check       | Skip-Guard Logik                                                                       |
| 4. Models fetchen  | `curl https://openrouter.ai/api/v1/models` mit `OPENROUTER_API_KEY`                    |
| 5. Filtern         | Nur `pricing.prompt == "0" && pricing.completion == "0"`, relevante Felder extrahieren |
| 6. LLM-Evaluation  | Prompt an kostenloses Modell (`meta-llama/llama-3.1-8b-instruct:free` via OpenRouter)  |
| 7. JSON bauen      | `settings.local.json` Struktur gemäß `multi-provider-ci.md`                            |
| 8. Variable setzen | `gh variable set CLAUDE_CODE_SETTINGS_LOCAL_OPENROUTER -b <json>`                      |
| 9. Verifizieren    | `gh variable get` + Summary                                                            |

---

## LLM-Evaluation Prompt

**Evaluator-Modell**: `meta-llama/llama-3.1-8b-instruct:free` (kostenlos, schnell, via OpenRouter)

**Kriterien** (absteigend):

1. Coding-Fähigkeit (Generierung, Debugging, Refactoring, Architektur)
2. Kontext-Länge
3. Instruction Following
4. Verfügbarkeit/Stabilität (Top-Provider)

**Rollen-Mapping**:

- **OPUS** — Maximum Quality: bestes Coding-Modell insgesamt
- **SONNET** — Balanced: gute Qualität, schnell genug
- **HAIKU** — Fast: einfachste Tasks, Boilerplate, Tests
- **FABLE** — Long-Context/Experimental: größte Codebasen, Spec-Writing
- **SUBAGENT** — Default für Subagents

**Output**: Striktes JSON mit 5 Model-IDs + `reasoning` Objekt für Begründungen

---

## Settings-JSON Struktur (Target)

```json
{
	"env": {
		"ANTHROPIC_BASE_URL": "https://openrouter.ai/api",
		"ANTHROPIC_DEFAULT_HAIKU_MODEL": "<haiku-id>",
		"ANTHROPIC_DEFAULT_SONNET_MODEL": "<sonnet-id>",
		"ANTHROPIC_DEFAULT_OPUS_MODEL": "<opus-id>",
		"ANTHROPIC_DEFAULT_FABLE_MODEL": "<fable-id>",
		"CLAUDE_CODE_SUBAGENT_MODEL": "<subagent-id>"
	}
}
```

Exakt passend zu `CLAUDE_CODE_SETTINGS_LOCAL_OPENROUTER` in `.ai-knowledge/multi-provider-ci.md`.

---

## Secrets / Variables (bereits vorhanden)

| Name                                    | Typ      | Zweck                                  |
| --------------------------------------- | -------- | -------------------------------------- |
| `OPENROUTER_API_KEY`                    | Secret   | Auth für Models-API + Evaluation-LLM   |
| `APP_ID` / `APP_PRIVATE_KEY`            | Secret   | GitHub App Token für `variables:write` |
| `CLAUDE_CODE_SETTINGS_LOCAL_OPENROUTER` | Variable | Wird aktualisiert (bereits in Repo)    |

---

## Dateien (neu)

```
.github/
├── workflows/
│   └── openrouter-model-sync.yml      # Haupt-Workflow
└── scripts/
    └── openrouter-eval-prompt.txt     # Prompt (extra Datei, vermeidet YAML-Heredoc-Probleme)
```

---

## Testing

```bash
# Normal (respektiert Skip-Guard)
gh workflow run openrouter-model-sync.yml

# Force (ignoriert Skip-Guard)
gh workflow run openrouter-model-sync.yml -f force=true
```

---

## Abhängigkeiten im Repo

- `jq` (verfügbar auf ubuntu-latest)
- `gh` CLI (verfügbar)
- `curl` (verfügbar)
- Keine neuen npm-Deps nötig

---

## Parallelen zu bestehenden Workflows

| Feature                        | Vorbild                                         |
| ------------------------------ | ----------------------------------------------- |
| Skip-Guard via SHA             | `claude-spec-sync.yml`, `claude-guide-sync.yml` |
| App-Token für Variable         | `00-set-llm-provider.yml`                       |
| OpenRouter Settings-Variable   | `multi-provider-ci.md` (bereits dokumentiert)   |
| LLM via OpenRouter im Workflow | `ci-multi-provider.yml` (Pattern)               |

---

## Risiken / Offene Punkte

1. **Evaluator-Modell Verfügbarkeit**: `meta-llama/llama-3.1-8b-instruct:free` könnte wegfallen → Fallback in Prompt dokumentieren oder zweites Modell als Backup
2. **API-Rate-Limits**: OpenRouter Models-API ist unlimitiert, Chat-Completions haben Limits → 1 Call/Tag ist unkritisch
3. **LLM halluziniert Model-IDs**: Validierung im Workflow (Prüfung auf Existenz in gefetchter Liste) als Safety-Net einbauen
4. **Prompt-Qualität**: Erste Iteration → nach ersten Läufen Reasoning prüfen und Prompt kalibrieren
