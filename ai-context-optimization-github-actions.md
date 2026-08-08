# KI-Kontext-Optimierung in GitHub Actions – 5-Phasen-Plan

> **Ziel:** Token-Verbrauch reduzieren, Performance verbessern, Kosten senken – durch konsequentes Context-Trimming über alle Workflow-Phasen hinweg.

---

## Übersicht der 5 Phasen

| Phase                | Fokus               | Kern-Maßnahme                                     |
| -------------------- | ------------------- | ------------------------------------------------- |
| 1 – Trigger/Dispatch | Eingehender Kontext | Payload auf Minimum reduzieren                    |
| 2 – Setup/Prepare    | Kontext-Aufbau      | Schlanke `context.json`, präzises Caching         |
| 3 – Build/Test       | Laufzeit-Kontext    | Selektive File-Feeds, Artifact-Filter             |
| 4 – Package/Release  | Output-Kontext      | Gezielte Artifacts, Changelog-basierte Versioning |
| 5 – Deploy/Monitor   | Laufzeit-Kontrolle  | Idempotente Scripts, Health-Endpoints, Cleanup    |

---

## Phase 1 – Trigger / Dispatch

### Maßnahmen

- [ ] **Event-Payload scoping** – Nur `github.event_name`, `github.ref`, `github.sha` extrahieren
- [ ] **Große Blobs strippen** – Keine vollen Dateibäume, keine Roh-Logs im Initial-Kontext
- [ ] **Kurze Referenzen** – Short-SHA + Repository-Link statt voller Payload
- [ ] **`repository_dispatch` Schema** – Max. 5 Keys definieren, Extras als Artifacts auslagern
- [ ] **Artifact-Referenzen** – Überschüssige Daten per `actions/upload-artifact` speichern, Pfad im Kontext halten

### Implementierungs-Hinweise

```yaml
# Beispiel: Minimaler Dispatch-Payload
on:
  repository_dispatch:
    types: [ci-trigger]
# Input-Schema: { ref, sha, pr_number, changed_files[], target_env }
```

---

## Phase 2 – Setup / Prepare

### Maßnahmen

- [ ] **`context.json` generieren** – Nur: Branch, PR-Nummer, betroffene Packages, Target-Environment
- [ ] **File-Globs statt Full-Reads** – `src/**/*.ts` statt `**/*` in `actions/setup-node`, `actions/cache`
- [ ] **Atomares Caching** – Cache-Key = Hash von `pnpm-lock.yaml` / `package-lock.json`, nicht `node_modules`
- [ ] **Präzise Patterns** – Explizite Include/Exclude-Listen für Dependencies und Build-Outputs

### Implementierungs-Hinweise

```yaml
- uses: actions/cache@v4
  with:
    path: |
      ~/.pnpm-store
      **/dist
    key: ${{ runner.os }}-deps-${{ hashFiles('pnpm-lock.yaml') }}
```

---

## Phase 3 – Build / Test

### Maßnahmen

- [ ] **Test-spezifische File-Feeds** – `npm test -- -t="pattern"` oder `--testPathPattern` nutzen
- [ ] **Selektive Artifacts** – Nur `test-results/*.png`, `logs/*.log` bei Änderungen behalten
- [ ] **Token-bewusstes YAML** – Wiederverwendbare Snippets (Cache-Keys, Matrizen) in separate Files auslagern (`include:`)
- [ ] **Playwright Sharding** – Matrix-basiert, pro Shard eigene VM → keine Port-Kollisionen

### Implementierungs-Hinweise

```yaml
# .github/workflows/ci.yml
jobs:
  test:
    strategy:
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - run: npx playwright test --shard=${{ matrix.shard }}/4
```

---

## Phase 4 – Package / Release

### Maßnahmen

- [ ] **Gefilterte Artifact-Uploads** – Nur `dist/**`, `package.json`, `CHANGELOG.md` veröffentlichen
- [ ] **Changelog-basiertes Versioning** – Bump aus `CHANGELOG.md` statt Git-History-Parsing
- [ ] **Environment-spezifische Secrets** – Nur Staging-Secrets an Downstream, Prod-Keys außen vor
- [ ] **Path-basierte Filter** – `actions/upload-artifact` mit `path: dist/**` statt `./*`

### Implementierungs-Hinweise

```yaml
- uses: actions/upload-artifact@v4
  with:
    name: release-package
    path: |
      dist/**
      package.json
      CHANGELOG.md
```

---

## Phase 5 – Deploy / Monitor

### Maßnahmen

- [ ] **Idempotente Deployment-Scripts** – Script kodiert Idempotenz, CI braucht nur Target-URL + Branch-Tag
- [ ] **Health-Endpoint für Context-Monitoring** – `/health`返回: `context-tokens=12k, size=4KB`
- [ ] **Auto-Abort bei Budget-Überschreitung** – Threshold definieren (z.B. 8k Tokens), Job killen
- [ ] **Post-Run Cleanup** – Generierte `context.json`, temporäre Artifacts nach Run löschen

### Implementierungs-Hinweise

```bash
# deploy.sh – idempotent
#!/bin/bash
set -euo pipefail
TARGET_URL=$1
BRANCH_TAG=$2
# ... deployment logic that can run safely multiple times ...
```

```yaml
# Cleanup step
- name: Cleanup context files
  if: always()
  run: |
    rm -f context.json
    rm -rf tmp-artifacts/
```

---

## Phasen-übergreifende Best Practices

### 1. Explizite Kontext-Budgets

```yaml
# In workflow oder step-level
env:
  MAX_CONTEXT_TOKENS: 8000
```

- Hard Limit definieren, Steps bei Überschreitung abbrechen (`fail-fast`)
- Metrics-Endpoint (`/health`) für Echtzeit-Monitoring nutzen

### 2. Hierarchische Kontext-Files

```
/.github/
  contexts/
    cache-keys.yml      # Wiederverwendbare Cache-Keys
    matrix-defs.yml     # Matrix-Definitionen
    secret-refs.yml     # Secret-Namen pro Environment
```

- Versioniert, referenziert statt inlined
- Single Source of Truth für wiederverwendbare Config

### 3. Strategische Job-Isolation via `needs:`

```yaml
jobs:
  build:
    outputs:
      artifact_url: ${{ steps.upload.outputs.url }}
  test:
    needs: build
    # NUR artifact_url konsumieren, kein File-Tree
```

- Minimaler Handoff: Artifact-URLs, SHA, Version-String
- Keine kompletten Workspaces durch `needs` reichen

### 4. Dynamische Kontext-Kontrolle

```yaml
steps:
  - name: Heavy analysis
    if: contains(github.event.pull_request.title, '[full-context]')
    # Lauf nur bei explizitem Opt-in
```

- `if:` Conditions für bedingte Step-Ausführung
- Labels/Titles als Trigger für erweiterte Kontext-Loads

### 5. Agent-Level Guardrails (Claude/Claude-Code)

```json
// .claude/settings.json
{
	"contextTrimMode": "aggressive",
	"maxContextTokens": 8000
}
```

- Automatisches Discarden unnötiger File-Reads
- Modell-spezifische Limits konfigurieren

---

## Erwartete Verbesserungen

| Metrik                       | Vorher | Nachher (Ziel) |
| ---------------------------- | ------ | -------------- |
| Avg. Context Tokens/Run      | ~25k   | **< 8k**       |
| Workflow Duration            | 12 min | **< 7 min**    |
| Token Cost/Run               | $0.25  | **~$0.08**     |
| Flaky Rate (Context-bedingt) | ~15%   | **< 3%**       |

---

## Implementierungs-Roadmap

### Sprint 1 (Woche 1-2): Foundation

- [ ] `context.json` Schema definieren & Generator schreiben
- [ ] Hierarchische Context-Files anlegen (`/.github/contexts/`)
- [ ] Cache-Keys auf Lockfile-Hash umstellen

### Sprint 2 (Woche 3-4): Build/Test Optimierung

- [ ] Test-Selektion via Patterns implementieren
- [ ] Playwright Matrix-Sharding finalisieren
- [ ] Artifact-Filter für Test-Results

### Sprint 3 (Woche 5-6): Package/Deploy

- [ ] Changelog-basiertes Versioning Script
- [ ] Idempotente Deploy-Scripts
- [ ] Health-Endpoint + Cleanup-Steps

### Sprint 4 (Woche 7-8): Guardrails & Monitoring

- [ ] Token-Budget Enforcement in Workflows
- [ ] Agent-Settings (`contextTrimMode`) konfigurieren
- [ ] Dashboard für Context-Metriken

---

## Validierung & Messung

```bash
# Context-Größe messen (Beispiel)
CONTEXT_SIZE=$(cat context.json | wc -c)
CONTEXT_TOKENS=$(echo "$CONTEXT_SIZE / 4" | bc)  # rough estimate
echo "Context: ${CONTEXT_SIZE} bytes ≈ ${CONTEXT_TOKENS} tokens"

# Budget-Check
if [ "$CONTEXT_TOKENS" -gt 8000 ]; then
  echo "⚠️ BUDGET EXCEEDED: ${CONTEXT_TOKENS} > 8000"
  exit 1
fi
```

---

## Referenzen & Verwandte Docs

- [[ci-gate-contract-and-sharding]] – CI Gate Contract & E2E Sharding Details
- [[workflow-cost-summary-snippet]] – Token/Cost Reporting Pattern
- [[priority-pilot-env-gotchas]] – Environment Gotchas (Auto-Commit, Concurrent Bots)
- [[pipeline-hardening-split-henne-ei]] – Pipeline Hardening Lessons

---

## Changelog

| Version | Datum      | Änderung                                          |
| ------- | ---------- | ------------------------------------------------- |
| 1.0     | 2026-08-08 | Initialer Plan aus KI-Kontext-Optimierung-Session |

---

> **Hinweis:** Dieser Plan ist ein lebendiges Dokument. Bei jeder Workflow-Änderung prüfen: _Reduziert das den Kontext?_ Falls nein – Refactoring anstoßen.
