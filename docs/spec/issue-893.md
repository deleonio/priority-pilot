# Issue 893: ZAI-Provider Timeout-Fallback 08-12 Berlin

## Ziel

ZAI-Provider automatisch zwischen 08:00 und 12:00 Uhr Europe/Berlin auf Claude fallen lassen, unabhängig von der konfigurierten `vars.LLM_PROVIDER`.

## Vorbedingung

- GitHub-Repository mit CI/CD-Pipelines
- `vars.LLM_PROVIDER` ist auf `zai` gestellt
- `CLAUDE_API_KEY` Secret ist vorhanden
- `.github/actions/setup-claude/action.yml` steuert Provider-Logik

## Schritte

1. **Zeitfenster erkennen**: Laufzeit-Prüfung der aktuellen Berliner Zeit (`TZ=Europe/Berlin date +%H`)
   - Stunden 08-11 → innerhalb Zeitfenster
   - Stunden 00-07 oder 12-23 → außerhalb Zeitfenster
2. **Provider-Entscheidung**: Wenn `LLM_PROVIDER=zai` UND Zeitfenster aktiv → auf `claude` fallen
3. **DST-Korrektheit**: `TZ=Europe/Berlin` berücksichtigt Sommer-/Winterzeit automatisch
4. **Observability**: Auto-Switch im Log via `::notice::` und optional Step Summary

## Erwartetes Ergebnis

- Zwischen 08:00-12:00 Berlin: ZAI wird NICHT verwendet, selbst wenn `vars.LLM_PROVIDER=zai`
- Außerhalb des Fensters: konfigurierter `LLM_PROVIDER`-Wert gilt unverändert
- Lösung ist DST-korrekt (kein zweimaliges Fehlschalten im Jahr)
- CI-Läufe sind nicht blockiert, CLAUDE_API_KEY ist verfügbar
- Jeder Auto-Switch ist im Job-Log sichtbar
- `ci-multi-provider.yml` bleibt ausgenommen (eigener Vergleichs-Workflow)

## Testfälle

1. **Innerhalb Zeitfenster (08-11 Berlin)**: `LLM_PROVIDER=zai` → effektiv `claude`
2. **Außerhalb Zeitfenster (12-07 Berlin)**: `LLM_PROVIDER=zai` → effektiv `zai`
3. **Andere Provider unverändert**: `LLM_PROVIDER=claude` oder `openrouter` → keine Änderung
4. **DST-Wechsel**: Zeitfenster arbeitet korrekt bei UTC+1 (Winter) und UTC+2 (Sommer)
5. **Log-Sichtbarkeit**: Auto-Switches erscheinen als `::notice::` Messages
6. **CI-Stabilität**: Pipeline-Läufe schließen nicht ab wegen fehlender Secrets

## Implementierungshinweise

- Variante (b) empfohlen: Laufzeitbasierte Entscheidung in `setup-claude` Action
- Keine persistente Variablen-Mutation (keine Race-Conditions mit manuellen Switches)
- DST-Prüfung via `TZ=Europe/Berlin date +%H` (robuster als statisches UTC-Fenster)
- Voraussetzung: `CLAUDE_API_KEY` muss vorhanden sein (in Setup prüfen/dokumentieren)
- Nur betroffene Workflows: 5 Pipeline-Workflows + Haupt-CI, nicht `ci-multi-provider.yml`
