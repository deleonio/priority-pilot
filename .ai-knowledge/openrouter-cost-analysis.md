# OpenRouter Kostenanalyse

Stand: 2026-07-10. Modellpreise über die [OpenRouter API](https://openrouter.ai/api/v1/models)
abgerufen (ohne Authentifizierung — öffentliche Preisdaten).

## Claude-Modelle (via OpenRouter)

| Modell                           | Prompt/1M | Completion/1M | Kontext |
| -------------------------------- | --------- | ------------- | ------- |
| `anthropic/claude-opus-4.8`      | $5.00     | $25.00        | 1,000K  |
| `anthropic/claude-opus-4.8-fast` | $10.00    | $50.00        | 1,000K  |
| `anthropic/claude-opus-4.7`      | $5.00     | $25.00        | 1,000K  |
| `anthropic/claude-sonnet-4.6`    | $3.00     | $15.00        | 1,000K  |
| `anthropic/claude-sonnet-5`      | $2.00     | $10.00        | 1,000K  |
| `anthropic/claude-haiku-4.5`     | $1.00     | $5.00         | 200K    |
| `anthropic/claude-fable-5`       | $10.00    | $50.00        | 1,000K  |

## DeepSeek-Modelle (über OpenRouter)

| Modell                                   | Prompt/1M | Completion/1M | Kontext |
| ---------------------------------------- | --------- | ------------- | ------- |
| `deepseek/deepseek-v4-pro`               | $0.43     | $0.87         | 1,048K  |
| `deepseek/deepseek-v4-flash`             | $0.09     | $0.18         | 1,048K  |
| `deepseek/deepseek-v3.2`                 | $0.23     | $0.34         | 131K    |
| `deepseek/deepseek-v3.2-exp`             | $0.27     | $0.41         | 163K    |
| `deepseek/deepseek-chat` (V3)            | $0.20     | $0.80         | 131K    |
| `deepseek/deepseek-chat-v3.1`            | $0.21     | $0.79         | 163K    |
| `deepseek/deepseek-r1`                   | $0.70     | $2.50         | 163K    |
| `deepseek/deepseek-r1-0528`              | $0.50     | $2.15         | 163K    |
| `deepseek/deepseek-r1-distill-llama-70b` | $0.80     | $0.80         | 128K    |

## Google Gemini-Modelle (über OpenRouter)

| Modell                          | Prompt/1M | Completion/1M | Kontext |
| ------------------------------- | --------- | ------------- | ------- |
| `google/gemini-3.1-pro-preview` | $2.00     | $12.00        | 1,048K  |
| `google/gemini-3.5-flash`       | $1.50     | $9.00         | 1,048K  |
| `google/gemini-3.1-flash-lite`  | $0.25     | $1.50         | 1,048K  |
| `google/gemini-3-flash-preview` | $0.50     | $3.00         | 1,048K  |
| `google/gemini-2.5-pro`         | $1.25     | $10.00        | 1,048K  |
| `google/gemini-2.5-flash`       | $0.30     | $2.50         | 1,048K  |
| `google/gemini-2.5-flash-lite`  | $0.10     | $0.40         | 1,048K  |

## OpenAI GPT-Modelle (über OpenRouter)

| Modell                    | Prompt/1M | Completion/1M | Kontext |
| ------------------------- | --------- | ------------- | ------- |
| `openai/gpt-5.6-luna`     | $1.00     | $6.00         | 1,050K  |
| `openai/gpt-5.6-luna-pro` | $1.00     | $6.00         | 1,050K  |
| `openai/gpt-5.6-sol-pro`  | $5.00     | $30.00        | 1,050K  |
| `openai/gpt-4.1`          | $2.00     | $8.00         | 1,047K  |
| `openai/gpt-4.1-mini`     | $0.40     | $1.60         | 1,047K  |
| `openai/gpt-4.1-nano`     | $0.10     | $0.40         | 1,047K  |
| `openai/gpt-4o`           | $2.50     | $10.00        | 128K    |
| `openai/gpt-4o-mini`      | $0.15     | $0.60         | 128K    |
| `openai/gpt-5-mini`       | $0.25     | $2.00         | 400K    |
| `openai/gpt-5-nano`       | $0.05     | $0.40         | 400K    |

## Meta Llama (über OpenRouter)

| Modell                        | Prompt/1M | Completion/1M | Kontext |
| ----------------------------- | --------- | ------------- | ------- |
| `meta-llama/llama-4-maverick` | $0.15     | $0.60         | 1,048K  |
| `meta-llama/llama-4-scout`    | $0.10     | $0.30         | 10,000K |

---

## Empfohlenes Mapping für Priority Pilot

### Opus-Ersatz: `deepseek/deepseek-v4-pro`

Vergleich mit `claude-opus-4.8`:

| Metrik        | Claude Opus 4.8 | DeepSeek V4 Pro | Faktor    |
| ------------- | --------------- | --------------- | --------- |
| Prompt/1M     | $5.00           | $0.43           | **11.6×** |
| Completion/1M | $25.00          | $0.87           | **28.7×** |
| Kontext       | 1,000K          | 1,048K          | ≈gleich   |

**Begründung:** DeepSeek V4 Pro ist das stärkste Reasoning-Modell der DeepSeek-Familie mit
1M-Kontext. In Code-Generierung und Tool-Use konkurrenzfähig mit Opus, zu einem Bruchteil der
Kosten.

**Alternative:** `google/gemini-3.1-pro-preview` ($2/$12, 2.5× günstiger) — näher an Claudes
vorsichtig-gründlichem Stil, falls DeepSeek für bestimmte Aufgaben zu "direkt" ist.

### Sonnet-Ersatz: `deepseek/deepseek-v3.2`

Vergleich mit `claude-sonnet-4.6`:

| Metrik        | Claude Sonnet 4.6 | DeepSeek V3.2 | Faktor     |
| ------------- | ----------------- | ------------- | ---------- |
| Prompt/1M     | $3.00             | $0.23         | **13.0×**  |
| Completion/1M | $15.00            | $0.34         | **44.1×**  |
| Kontext       | 1,000K            | 131K          | ⚠️ kleiner |

**Begründung:** V3.2 ist DeepSeeks aktueller Allrounder mit extrem günstigem Output-Preis. Der
kleinere Kontext (131K vs. 1M) ist der Hauptnachteil — bei langen Codebasen könnte das knapp
werden.

**Alternative:** `deepseek/deepseek-v4-flash` ($0.09/$0.18, 1M Kontext, aber schwächeres Reasoning)
oder `google/gemini-3-flash-preview` ($0.50/$3, 1M Kontext).

### Haiku-Ersatz: `deepseek/deepseek-v4-flash`

Vergleich mit `claude-haiku-4.5`:

| Metrik        | Claude Haiku 4.5 | DeepSeek V4 Flash | Faktor    |
| ------------- | ---------------- | ----------------- | --------- |
| Prompt/1M     | $1.00            | $0.09             | **11.1×** |
| Completion/1M | $5.00            | $0.18             | **27.8×** |
| Kontext       | 200K             | 1,048K            | 5× größer |

**Begründung:** Absurd günstig, 1M Kontext, ideal für mechanische/triviale Aufgaben (Subagent
`light`). Für Formatierung, einfache Refactorings, Boilerplate mehr als ausreichend.

**Alternative:** `google/gemini-2.5-flash-lite` ($0.10/$0.40) oder `meta-llama/llama-4-scout`
($0.10/$0.30, 10M Kontext!).

### Fable-Ersatz: `deepseek/deepseek-r1-0528`

Vergleich mit `claude-fable-5`:

| Metrik        | Claude Fable 5 | DeepSeek R1 0528 | Faktor     |
| ------------- | -------------- | ---------------- | ---------- |
| Prompt/1M     | $10.00         | $0.50            | **20.0×**  |
| Completion/1M | $50.00         | $2.15            | **23.3×**  |
| Kontext       | 1,000K         | 163K             | ⚠️ kleiner |

**Begründung:** R1 ist DeepSeeks Chain-of-Thought-Reasoning-Modell — ideal für Aufgaben, die
tiefes analytisches Denken erfordern (Fable-Ersatz). 163K Kontext ist ausreichend für
Reasoning-Aufgaben, die selten extreme Kontextlängen brauchen.

---

## Nicht empfohlene Alternativen und warum

| Modell                                   | Problem                                                                       |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| `deepseek/deepseek-chat` (V3)            | Veraltet, schlechteres Reasoning als V3.2, teurerer Output                    |
| `deepseek/deepseek-r1`                   | Veraltet, teurer als r1-0528 ($0.70/$2.50 vs $0.50/$2.15)                     |
| `deepseek/deepseek-r1-distill-llama-70b` | Distilliertes Modell, deutlich schwächer als natives R1                       |
| `openai/gpt-5.6-sol-pro`                 | $5/$30 — kaum günstiger als Claude Opus, kein Kostenvorteil                   |
| `openai/gpt-4o`                          | $2.50/$10, nur 128K Kontext — in jeder Hinsicht schwächer als DeepSeek V4 Pro |
| `google/gemini-3.5-flash`                | $1.50/$9 — teurer als DeepSeek V4 Pro bei schlechterem Reasoning              |

## Zusammenfassung der gewählten Konfiguration

```
ANTHROPIC_DEFAULT_OPUS_MODEL=deepseek/deepseek-v4-pro     # $0.43/$0.87
ANTHROPIC_DEFAULT_SONNET_MODEL=deepseek/deepseek-v3.2     # $0.23/$0.34
ANTHROPIC_DEFAULT_HAIKU_MODEL=deepseek/deepseek-v4-flash  # $0.09/$0.18
ANTHROPIC_DEFAULT_FABLE_MODEL=deepseek/deepseek-r1-0528   # $0.50/$2.15
```

**Token-Preis pro Workflow-Lauf (Schätzung, 50K Prompt + 10K Completion):**

| Backend             | Opus (Triage) | Sonnet (Spec/Impl/Review/Fix) |
| ------------------- | ------------- | ----------------------------- |
| Claude/Anthropic    | $0.50         | $0.30                         |
| OpenRouter/DeepSeek | $0.03         | $0.015                        |
| **Ersparnis**       | **~94%**      | **~95%**                      |

**Hinweis:** Die tatsächlichen Token-Verbräuche der Priority-Pilot-Workflows liegen oft höher
(200K–500K Prompt wegen der umfangreichen System-Prompts). Die prozentuale Ersparnis bleibt
jedoch konstant, da die Preisverhältnisse linear skalieren.

Verfügbare Modelle:

1. anthropic/claude-fable-5
1. anthropic/claude-opus-4.8
1. anthropic/claude-opus-4.8-fast
1. anthropic/claude-sonnet-5
1. anthropic/claude-haiku-4.5
1. openai/gpt-5.6-sol
1. openai/gpt-5.6-sol-pro
1. openai/gpt-5.6-terra
1. openai/gpt-5.6-terra-pro
1. openai/gpt-5.6-luna
1. openai/gpt-5.6-luna-pro
1. openai/gpt-5.5
1. openai/gpt-5.5-pro
1. openai/gpt-5.4-mini
1. google/gemini-3.1-pro-preview
1. google/gemini-3.5-flash
1. x-ai/grok-4.5
1. deepseek/deepseek-v4-pro
1. deepseek/deepseek-v4-flash
1. qwen/qwen3.7-max
1. qwen/qwen3.7-plus
1. qwen/qwen3.6-35b-a3b
1. moonshotai/kimi-k2.6
1. moonshotai/kimi-k2.7-code
1. minimax/minimax-m3
1. z-ai/glm-5.2
1. z-ai/glm-5.1
1. xiaomi/mimo-v2.5-pro
1. tencent/hy3
1. stepfun/step-3.7-flash
1. nvidia/nemotron-3-super-120b-a12b
1. sakana/fugu-ultra
1. poolside/laguna-m.1:free
1. tencent/hy3:free
1. nvidia/nemotron-3-super-120b-a12b:free
1. nvidia/nemotron-3-ultra-550b-a55b:free
