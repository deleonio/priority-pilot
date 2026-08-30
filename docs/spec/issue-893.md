# Issue 893: ZAI-Provider Timeout-Fallback 08-12 Berlin

**Stand:** 2026-08-30

## Ziel

ZAI-Provider automatisch in den z.ai-Peak-Zeiten (Mo–Fr 08:00–12:00 Uhr Europe/Berlin) auf Claude fallen lassen, unabhängig von der konfigurierten `vars.LLM_PROVIDER`.

## Vorbedingung

- GitHub-Repository mit CI/CD-Pipelines
- `vars.LLM_PROVIDER` ist auf `zai` gestellt
- `CLAUDE_API_KEY` Secret ist vorhanden
- `.github/actions/setup-claude/action.yml` steuert Provider-Logik

## Schritte

1. **Zeitfenster erkennen**: Laufzeit-Prüfung in Singapore-Zeit (`TZ='Asia/Singapore' date +%H` und `date +%u`) — das z.ai-Peak-Fenster ist Mo–Fr 14:00–17:59 Asia/Singapore (UTC+8, kein DST)
   - Wochentag 1–5 (Mo–Fr) und Stunden 14-17 SGT → innerhalb Zeitfenster (= 08:00–12:00 MESZ bzw. 07:00–11:00 MEZ Berlin)
   - Wochenende (Sa/So) oder Stunden außerhalb → außerhalb Zeitfenster (am Wochenende gilt bei z.ai ganztägig Off-Peak)
2. **Provider-Entscheidung**: Wenn `LLM_PROVIDER=zai` UND Zeitfenster aktiv → auf `claude` fallen; andere Provider werden gar nicht geprüft (Notice „Zeitfenster-Check übersprungen (Provider=$PROVIDER, nur zai wird geprüft)")
3. **DST-Korrektheit**: Das Fenster ist in Singapore-Zeit (UTC+8, ohne DST) definiert — das Berliner Fenster verschiebt sich mit Sommer-/Winterzeit automatisch korrekt
4. **Observability**: Auto-Switch im Log via `::notice::` (mit Wochentag/Stunde in SGT)

## Erwartetes Ergebnis

- Mo–Fr zwischen 08:00-12:00 Berlin: ZAI wird NICHT verwendet, selbst wenn `vars.LLM_PROVIDER=zai`
- Am Wochenende sowie außerhalb des Fensters: konfigurierter `LLM_PROVIDER`-Wert gilt unverändert
- Lösung ist DST-korrekt (kein zweimaliges Fehlschalten im Jahr)
- CI-Läufe sind nicht blockiert, CLAUDE_API_KEY ist verfügbar
- Jeder Auto-Switch ist im Job-Log sichtbar
- `ci-multi-provider.yml` nutzt die Action nicht und ist von der Umschaltung nicht betroffen

## Verhaltensfälle

1. **Innerhalb Zeitfenster (Mo–Fr, 14-17 SGT)**: `LLM_PROVIDER=zai` → effektiv `claude`
2. **Außerhalb Zeitfenster (Wochenende oder 18-13 SGT)**: `LLM_PROVIDER=zai` → effektiv `zai`
3. **Andere Provider unverändert**: `LLM_PROVIDER=claude` oder `openrouter` → keine Änderung
4. **DST-Wechsel**: Zeitfenster arbeitet korrekt bei UTC+1 (Winter) und UTC+2 (Sommer)
5. **Log-Sichtbarkeit**: Auto-Switches erscheinen als `::notice::` Messages
