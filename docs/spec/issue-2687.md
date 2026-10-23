# Spec: DB-Fehler in der Provider-Auflösung sichtbar loggen (#2687)

## Ziel

Schlägt die Datenbank bei der LLM-Provider-Auflösung fehl, versickert die Ursache bislang in
stillen Catches — die App liefert nur „kein Provider“ (HTTP 503), ohne dass im Log erkennbar
ist, warum. Künftig loggt jede der vier Auflösungsstellen die Ursache per `console.error`
(Stil `console.error('<Kontext:', …>', error)` wie `requireAuth.ts`/`apiTokenAuth.ts`), bevor
der bisherige Fallback greift. Nach außen ändert sich nichts.

## Voraussetzungen

- Datenbank erreichbar (Built-in-Provider-Zeilen lazy vorhanden oder anlegbar).
- Die innere Log-Stelle in `ensureBuiltins` (Tabelle fehlt in Unit-Tests ohne DB-Sync) bleibt
  unangetastet — sie ist bewusst still.

## Verhalten (aus den Akzeptanzkriterien)

- **AK1:** `loadActiveProvider` fängt einen DB-Fehler (z. B. `LlmProvider.findAll` wirft), loggt
  die Ursache per `console.error` (genau eine Zeile, mit Fehlermeldung) und liefert weiterhin
  `null`.
- **AK2:** `hasOwnProviderSelection` fängt einen DB-Fehler (`User.findByPk` wirft), loggt die
  Ursache per `console.error` und liefert weiterhin `false`.
- **AK3:** `findProviderByName` fängt einen DB-Fehler (`LlmProvider.findOne` wirft), loggt die
  Ursache per `console.error` und liefert weiterhin `null`.
- **AK4:** `resolveProvider` (llm.ts) loggt in ihrem (defensiven) Catch die Ursache per
  `console.error`, liefert weiterhin `null`; der Catch trägt einen Kommentar im Muster von
  `requireAuth.ts:57-65`. Über den öffentlichen Pfad ist der beobachtbare Vertrag gleich:
  DB-Fehler bei der Auflösung → Ursache im Log, Aufrufer erhält `MissingApiKeyError` (→ 503,
  unverändert).
- **AK5:** Antwortverhalten und Status-Codes unverändert — die Bestandssuiten
  (`llmProviders.per-user.test.ts`, `routes/llmProviders.test.ts`) bleiben grün.

## Erwartetes Ergebnis

Ein provozierter DB-Fehler erzeugt an jeder erreichbaren Auflösungsstelle genau eine Logzeile
mit Ursache; Rückgabewerte (`null`/`false`) und die 503-Antwort bleiben unverändert.

## Tests (TF-Mapping)

- TF1 → `server/src/llm/llmProviders.db-error.test.ts`: DB-Fehler per Methoden-Override
  (`LlmProvider.findAll`/`findOne`, `User.findByPk`), `mock.method(console, 'error')` prüft
  genau eine Logzeile mit Ursache, Rückgabewert unverändert (AK1–AK3).
- TF2 → derselbe File, öffentlicher Pfad `parseSearchQueryWithMistral`: `MissingApiKeyError`
  (503-Vertrag) unverändert + Log-Aufruf mitverifiziert (AK4/AK5).
- TF3 → Bestandssuite `pnpm --filter server test` (AK5, Gate).
