# Issue 1577 — Verbindungstest im Provider-Dialog (Dry-Test vor dem Speichern)

Issue: #1577 · Spec-Phase (rote Tests als ausführbarer Vertrag)

## Ziel

Im Anlege- und Bearbeiten-Dialog für Custom-LLM-Provider (`LlmProviderFormDialog`) kann die
Verbindung mit den aktuell eingegebenen, **ungespeicherten** Formulardaten geprüft werden —
ohne dass dafür gespeichert werden muss. Erfolg zeigt die Reaktionszeit, Misserfolg die
konkrete Ursache. Der Test legt oder verändert keinen Provider-Datensatz.

## Vertrag Server: `POST /llm-providers/test-dry`

Ziel: dieselbe `runTest()`-Logik wie `POST /llm-providers/{id}/test`, aber mit einer
Laufzeit-Konfiguration aus dem Request-Body statt aus einer DB-Zeile.

- **Body:** `{ endpoint: string, apiKey: string, model: string, providerId?: number }`
- **Auth:** Session erforderlich — ohne Session 401 (wie jeder Schreib-Endpunkt, #1547).
- **Validierung wie beim Anlegen:** `endpoint` muss eine gültige http(s)-URL sein, `model`
  ein nicht-leerer String → sonst 400 mit verständlicher Meldung.
- **Key-Fallback im Bearbeiten-Modus (`providerId` gesetzt, `apiKey` leer):** der gespeicherte
  Key des Providers wird genutzt. Besitzprüfung über `isProviderAccessible` — fremde oder
  unbekannte `providerId` → 404 (wie `:id/test`).
- **Antwort:** `ProviderTestResultDto` (`ok`, `model?`, `latencyMs?`, `sample?`, `message?`)
  — bei Erfolg inkl. Modell und Latenz in ms, bei Misserfolg die konkrete Ursache.
- **Keine Persistenz:** kein Provider wird angelegt oder verändert (Provider-Anzahl in der DB
  bleibt unverändert); kein `testResultsCache`-Eintrag (Ergebnis ändert sich mit jedem
  Tastenanschlag — anders als beim `:id/test`-Cooldown).
- **Unangetastet:** `POST /llm-providers/{id}/test` inkl. Cache und der Zeilen-Testen-Schalter
  in den Einstellungen funktionieren weiter (AK5 — bereits durch
  `llmProviders.test.ts` „Test-Cooldown …" und `llm-settings.spec.ts` „Test-Prompt …" verankert).

## Vertrag Client & Dialog

- Neue Client-Funktion `api.testLlmProviderDraft({ endpoint, apiKey, model, providerId? })`
  neben `api.testLlmProvider` (`frontend/src/api.ts`), OpenAPI-Endpoint + DTO ergänzt.
- **Testen-Schalter** im Dialog (sekundärer Button neben Speichern/Abbrechen), Zustand
  idle/prüft/Ergebnis; während `saving` deaktiviert (AK1).
- **Anlegen-Modus:** Test ruft `testLlmProviderDraft` mit `{ endpoint, apiKey, model }` auf —
  ohne `providerId`, ohne Speichern (`createLlmProvider` wird nicht gerufen; AK2/AK3).
- **Bearbeiten-Modus mit leerem API-Key-Feld:** Aufruf mit `providerId` des Providers — der
  Server nutzt den gespeicherten Key (Dialog-Semantik „leer = unverändert", AK2).
- **Erfolg (AK3):** `KolAlert _type="success"` mit Reaktionszeit in ms und Modell; kein
  Provider wird angelegt/verändert.
- **Misserfolg (AK4):** `KolAlert _type="error"` mit der konkreten Server-Meldung (z. B.
  ungueltiger API-Key); der Dialog bleibt bedienbar (Buttons nicht dauerhaft deaktiviert).
- **Mobile (AK6):** Dialog mit Testen-Schalter und Ergebnismeldung bei 375px ohne horizontalen
  Overflow nutzbar — Bounding-Box-Check (App-Shell clippt `overflow-x:hidden`, scrollWidth
  täuscht grün).

## Testfälle (rote Tests)

| TF  | Datei                                                          | Deckt                         |
| --- | -------------------------------------------------------------- | ----------------------------- |
| TF1 | `server/src/express/routes/llmProvidersTestDry.test.ts` (neu)  | AK2, AK3, AK4 (Server-Seite)  |
| TF2 | `frontend/src/components/LlmProviderFormDialog.test.tsx` (neu) | AK1–AK4 (Dialog)              |
| TF3 | `frontend/e2e/issue-1577-provider-dialog-test.spec.ts` (neu)   | AK1, AK3, AK4, AK6 end-to-end |

AK5 (Bestands-Testen unverändert) ist bereits durch `llmProviders.test.ts` (Cooldown-Test)
und `llm-settings.spec.ts` („Test-Prompt: Testen-Button zeigt das Ergebnis inline") abgedeckt
— keine Duplikation, siehe PR-Body.
