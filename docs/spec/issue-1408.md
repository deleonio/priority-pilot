# E2E ai-disable AK5 prüft den KI-an-Pfad statt den KI-aus-Pfad

**Stand:** 2026-09-23

## Ziel

`frontend/e2e/ai-disable.spec.ts` prüft mit AK5 („KI aus — Neuen Task anlegen öffnet direkt das Task-Formular") den KI-aus-Pfad. Der Helfer `initAiEnabled` (Zeile 27) ruft `page.addInitScript(...)` auf, ohne dessen Promise zurückzugeben oder abzuwarten. Beim direkt folgenden `page.goto` ist das Init-Skript nicht sicher registriert — `pp-ai-enabled` bleibt in der Praxis `null` und die App startet mit ihrem Default (KI an). AK5 testet damit unbemerkt den KI-an-Pfad statt des KI-aus-Pfads.

## Verhalten

- `initAiEnabled` wird asynchron (`Promise<void>`) und gibt das Promise von `page.addInitScript(...)` zurück; alle drei Aufrufer (#1335-AK5, #1525-AK3, #1527-`beforeEach`) warten mit `await`.
- Der #1335-AK5-Test verankert vor dem Klick auf „Neuen Task anlegen" eine Assertion, dass `localStorage.getItem('pp-ai-enabled')` bereits `"false"` liefert — das macht den KI-aus-Zustand zum expliziten, geprüften Teil des Tests statt einer stillschweigenden Annahme.
- Die App selbst (`frontend/src/lib/aiPreferences.ts`) bleibt unverändert; es handelt sich um eine reine Testkorrektur.

## Akzeptanzkriterien (Kurzreferenz)

Siehe Harness-Kommentar zu #1408 für die vollständige, verbindliche Formulierung (AK1–AK4). Kurzfassung:

1. `initAiEnabled` gibt ein abwartbares Promise zurück; alle Aufrufer nutzen `await`.
2. Der #1335-AK5-Test verankert `localStorage.getItem('pp-ai-enabled') === 'false'` vor dem Klick auf „Neuen Task anlegen".
3. `npx playwright test e2e/ai-disable.spec.ts` läuft komplett grün.
4. Mutationsprobe: Ohne `await initAiEnabled(page, false)` wird der #1335-AK5-Test spätestens an der AK2-Assertion rot.

## Spec-Status

Rot (dieser Commit): AK2-Assertion ist in `ai-disable.spec.ts` verankert (TF2), scheitert aber noch, weil `initAiEnabled` (AK1) noch nicht auf `async`/`await page.addInitScript(...)` umgestellt ist — die Race bleibt bis zur Implementierungsphase bestehen. TF1 (Code-Review/`grep -n "initAiEnabled(" … | await`) und TF4 (Mutationsprobe) sind ebenfalls erst nach der Implementierung erfüllbar und dokumentieren dieselbe Lücke.
