# Claude Code --bare Modus

## Was bewirkt `--bare`?

Der `--bare`-Flag für die Claude Code CLI aktiviert einen minimalistischen, aufgeräumten Modus mit folgenden Eigenschaften:

### 1. Bis zu 10x schnellerer Start

Ohne lokale Konfigurationsdateien, Hooks oder Plugins durchsuchen zu müssen, startet das CLI blitzschnell. Dies ist besonders relevant in CI/CD-Umgebungen wie GitHub Actions, wo jede Sekunde zählt.

### 2. Kein Anthropic-Zwang

Der Flag blockiert den **automatischen OAuth-Login-Prozess** von Anthropic. Dadurch wird erzwungen, dass Claude Code **ausschließlich** die explizit gesetzten Umgebungsvariablen verwendet:

- `ANTHROPIC_BASE_URL` — Endpoint-URL (z. B. `https://api.z.ai/api/anthropic` für DeepSeek)
- `ANTHROPIC_API_KEY` — API-Schlüssel (z. B. `ZAI_API_KEY` Secret für DeepSeek)
- `ANTHROPIC_DEFAULT_*_MODEL` — Modell-Aliase

Ohne `--bare` würde Claude Code versuchen, über OAuth mit Anthropic zu kommunizieren — selbst wenn Umgebungsvariablen für andere Anbieter gesetzt sind.

### 3. Reiner Fokus auf das Wesentliche

Claude behält den vollen Zugriff auf seine **Kernwerkzeuge**:

- Bash-Konsole
- Dateien lesen (`Read`)
- Code editieren (`Edit`)
- Dateien schreiben (`Write`)

Alles andere wird abgeschaltet:

- MCP-Server (Model Context Protocol)
- Komplexe Skills
- Lokale Plugins
- Benutzerdefinierte Hooks

Dies führt zu einem **deterministischen, reproduzierbaren Verhalten** — ideal für automatisierte Skripte und Pipelines.

---

## Wann nutzt man den Bare-Modus?

### 1. Für Drittanbieter-APIs

**Primärer Anwendungsfall:** Betrieb von Claude Code mit alternativen Anbietern wie:

- **DeepSeek (z.ai)** — über `ai:use-zai` Label
- **OpenAI** — über `OPENAI_API_KEY` + Endpoint
- **Ollama** — lokal oder Remote
- **Jeder andere Anthropic-kompatible Anbieter**

Ohne `--bare` würde Claude Code versuchen, den OAuth-Flow mit Anthropic zu starten — selbst wenn `ANTHROPIC_BASE_URL` auf einen anderen Anbieter zeigt. Der Bare-Modus **erzwingt** die Verwendung der Umgebungsvariablen.

### 2. Für Skripte und CI/CD-Pipelines

In automatisierten Umgebungen wie GitHub Actions ist `--bare` **standardmäßig aktiviert**, weil:

- **Schneller Start** — keine unnötige Initialisierungszeit
- **Sauberes Verhalten** — keine "Hintergrundgeräusche" durch lokale Konfigurationen
- **Determinismus** — jeder Lauf verhält sich identisch, unabhängig vom Runner-Zustand
- **Sicherheit** — keine unerwarteten OAuth-Flows in headless Umgebungen

---

## Zusätzliche Performance-Optimierungen

Neben `--bare` nutzt Priority Pilot weitere **sichere** Umgebungsvariablen, um Claude Code in CI/CD zu optimieren:

### Aktivierte Variablen (in allen Workflows)

| Variable                                   | Wert    | Wirkung                                                                                                                        |
| ------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` | `1`     | Deaktiviert Telemetrie, Sentry-Fehlerberichte und automatische Hintergrund-Updates — schützt Privatsphäre und spart Bandbreite |
| `BASH_MAX_OUTPUT_LENGTH`                   | `20000` | Begrenzt Terminal-Ausgaben auf 20.000 Zeichen, verhindert "Zuspammen" des KI-Kontexts durch riesige Logs (z. B. `npm install`) |
| `CLAUDE_CODE_HIDE_BANNER`                  | `1`     | Unterdrückt den CLI-Banner bei jedem Start — weniger Lärm in den Logs                                                          |

### Bewusst NICHT genutzte Optionen

| Option                   | Entscheidung        | Begründung                                                                                                                                                                                                                                                     |
| ------------------------ | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--max-tokens`           | **Nicht verwendet** | Würde den bestehenden **Soft-Abort-Mechanismus** untergraben. Priority Pilot hat einen kontrollierten Abbau (Session-Resume mit `date +%s`-Prüfung gegen `soft_deadline_epoch`), der Zwischenstand sichert — `--max-tokens` bricht abrupt ab ohne diese Logik. |
| `CLAUDE_CODE_NO_FLICKER` | **Nicht aktiviert** | Experimenteller Renderer, nicht stabil genug für Produktions-Pipelines                                                                                                                                                                                         |

### Warum kein `--max-tokens`?

Priority Pilot setzt auf einen **kooperativen Soft-Abort-Approach**:

1. **Weiches Zeitlimit:** 14 Minuten nach Start (`soft_deadline_epoch = jetzt + 840s`)
2. **Harte Grenze:** 20 Minuten (GitHub Actions `timeout-minutes`)
3. **6 Minuten Puffer:** Der Agent prüft selbst vor jedem größeren Schritt `date +%s` gegen die Deadline
4. **Sauberer Abbau:** Bei Erreichen der Deadline sichert der Agent:
   - Zwischenstand committen/pushen
   - Draft-PR aktualisieren mit TODO-Notiz
   - Label-Management für Selbst-Retrigger
   - Kein Label setzen (kein falsches Signal)
5. **Session-Resume:** Der Folgelauf setzt mit `--resume` am gleichen Kontext fort

Ein `--max-tokens`-Limit würde diesen kontrollierten Prozess **abrupt unterbrechen** und den Zwischenstand **verworfen** — genau das, was der Soft-Abort vermeiden soll.

---

## Integration in Priority Pilot

### GitHub Actions Workflows

Alle fünf Haupt-Workflows nutzen `--bare` **und die Performance-Optimierungen** standardmäßig:

| Workflow               | Modell | `--bare` | `DISABLE_NONESSENTIAL_TRAFFIC` | `BASH_MAX_OUTPUT_LENGTH` | `HIDE_BANNER` |
| ---------------------- | ------ | -------- | ------------------------------ | ------------------------ | ------------- |
| `claude-triage.yml`    | Opus   | ✅       | ✅                             | ✅ (20000)               | ✅            |
| `claude-spec.yml`      | Sonnet | ✅       | ✅                             | ✅ (20000)               | ✅            |
| `claude-implement.yml` | Sonnet | ✅       | ✅                             | ✅ (20000)               | ✅            |
| `claude-pr-review.yml` | Sonnet | ✅       | ✅                             | ✅ (20000)               | ✅            |
| `claude-pr-fixup.yml`  | Sonnet | ✅       | ✅                             | ✅ (20000)               | ✅            |

### Konfiguration in den Workflows

```yaml
# In allen 5 Workflows (env-Block auf Job-Ebene)
env:
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1"
  BASH_MAX_OUTPUT_LENGTH: "20000"
  CLAUDE_HIDE_BANNER: "1"

# Im Claude-Schritt
- name: Triage via Claude Code
  uses: anthropics/claude-code-action@v1
  with:
    claude_args: >-
      --bare --model claude-opus-4-8 --effort max
      --allowedTools "Bash(gh issue:*),Bash(gh api:*),..."
```

### Soft-Abort Implementation

Jeder Workflow enthält:

```yaml
- name: Startzeit merken (fuer Timeout-Erkennung + weiches Zeitlimit)
  id: starttime
  run: |
    now=$(date +%s)
    echo "epoch=$now" >> "$GITHUB_OUTPUT"
    echo "soft_deadline_epoch=$((now + 840))" >> "$GITHUB_OUTPUT"

# Im claude_args (Prompt-Auszug)
Pruefe daher VOR jedem groesseren Teilschritt mit
`test "$(date +%s)" -ge ${{ steps.starttime.outputs.soft_deadline_epoch }}`
ob das weiche Limit (14 Min nach Start, 6 Min Puffer) erreicht ist.
```

---

## Migration von existierenden Setups

| Workflow               | Modell | `--bare` | Begründung                              |
| ---------------------- | ------ | -------- | --------------------------------------- |
| `claude-triage.yml`    | Opus   | ✅       | Analyse-Lauf, schnell + deterministisch |
| `claude-spec.yml`      | Sonnet | ✅       | Spezifikations-Lauf, CI/CD-Optimierung  |
| `claude-implement.yml` | Sonnet | ✅       | Umsetzungs-Lauf, 20-Min-Timeout         |
| `claude-pr-review.yml` | Sonnet | ✅       | Review-Lauf, Label-Steuerung            |
| `claude-pr-fixup.yml`  | Sonnet | ✅       | Fixup-Lauf, schnelle Iterationen        |

### Konfiguration mit z.ai (DeepSeek)

Die Kombination aus `--bare` und der `configure-ai-backend`-Action ermöglicht nahtloses Umschalten zwischen Anthropic und z.ai:

```yaml
# In allen Workflows
- name: KI-Backend konfigurieren
  uses: ./.github/actions/configure-ai-backend
  with:
    entity-type: issue
    entity-number: ${{ github.event.issue.number }}
    gh-token: ${{ steps.app-token.outputs.token }}
    zai-api-key: ${{ secrets.ZAI_API_KEY }}

# Später im Claude-Schritt
- name: Umsetzung via Claude Code
  uses: anthropics/claude-code-action@v1
  with:
    claude_args: >-
      --bare --model claude-sonnet-4-6 --effort medium
      --allowedTools "..."
  env:
    ANTHROPIC_BASE_URL: ${{ env.AI_BACKEND == 'zai' && 'https://api.z.ai/api/anthropic' || '' }}
    ANTHROPIC_API_KEY: ${{ env.AI_BACKEND == 'zai' && secrets.ZAI_API_KEY || '' }}
```

Wenn das Issue das Label `ai:use-zai` trägt:

1. Setzt `configure-ai-backend` die Umgebungsvariablen `AI_BACKEND=zai`, `ANTHROPIC_BASE_URL` und `ANTHROPIC_API_KEY`
2. `--bare` blockiert den OAuth-Login
3. Claude Code verwendet **ausschließlich** die Umgebungsvariablen für die Verbindung zu z.ai

---

## Beispiel: Bash-Skript mit DeepSeek und --bare

Ein minimalistisches Beispiel für ein automatisiertes Skript:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Voraussetzungen
if [ -z "${ZAI_API_KEY:-}" ]; then
  echo "Fehler: ZAI_API_KEY muss gesetzt sein" >&2
  exit 1
fi

# Projekt auschecken
cd /pfad/zum/repo
git pull origin main

# Umgebungsvariablen für DeepSeek
export ANTHROPIC_BASE_URL="https://api.z.ai/api/anthropic"
export ANTHROPIC_API_KEY="$ZAI_API_KEY"
export ANTHROPIC_DEFAULT_SONNET_MODEL="glm-4.7"
export ANTHROPIC_DEFAULT_OPUS_MODEL="glm-5.1"

# Claude Code im Bare-Modus starten
claude --bare \
  --model glm-4.7 \
  --effort medium \
  --allowedTools "Bash,Read,Edit,Write" \
  --append-system-prompt "Du bist ein KI-Assistent für Code-Analyse. Verwende ausschliesslich die Umgebungsvariablen für die API-Verbindung." \
  "Analysiere das Projekt und schlage Verbesserungen vor"
```

### Erläuterung:

1. **`--bare`** — Blockiert OAuth, erzwingt Umgebungsvariablen
2. **`ANTHROPIC_BASE_URL`** — Zeigt auf DeepSeek-Endpoint
3. **`ANTHROPIC_API_KEY`** — Authentifizierung mit DeepSeek
4. **`ANTHROPIC_DEFAULT_*_MODEL`** — Modell-Aliase für Subagenten
5. **`--allowedTools`** — Einschränkung auf benötigte Werkzeuge

---

## Migration von existierenden Setups

### Vorher (ohne --bare)

```bash
claude --model glm-4.7 "Analysiere den Code"
# → Versucht möglicherweise OAuth mit Anthropic, ignoriert Umgebungsvariablen
```

### Nachher (mit --bare)

```bash
claude --bare --model glm-4.7 "Analysiere den Code"
# → Verwendet garantiert ANTHROPIC_BASE_URL + ANTHROPIC_API_KEY
```

---

## Troubleshooting

### Problem: "Authentication failed" mit z.ai

**Ursache:** `--bare` fehlt, Claude Code versucht OAuth mit Anthropic statt z.ai.

**Lösung:** `--bare` hinzufügen und Umgebungsvariablen prüfen:

```bash
# Prüfen
echo "AI_BACKEND=$AI_BACKEND"
echo "ANTHROPIC_BASE_URL=$ANTHROPIC_BASE_URL"
echo "ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-<gesetzter>}"

# Korrigieren
claude --bare --model glm-4.7 "Test"
```

### Problem: Skills oder MCP-Server funktionieren nicht

**Ursache:** `--bare` deaktiviert alle nicht-Kern-Funktionen.

**Lösung:** Entweder:

1. Skills/MCP lokal testen (ohne `--bare`)
2. Auf Kernwerkzeuge (Bash, Read, Edit, Write) umstellen

---

## Referenzen

- [Claude Code CLI Dokumentation](https://github.com/anthropics/claude-code)
- [Anthropic API Kompatibilität](https://docs.anthropic.com/en/docs/third-party-integrations)
- [DeepSeek API](https://api.z.ai)
- Priority Pilot: [AGENTS.md](../AGENTS.md) — KI-Agent-Konfiguration
- Priority Pilot: [.github/actions/configure-ai-backend](../.github/actions/configure-ai-backend) — Backend-Switching
