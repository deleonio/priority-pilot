# Spec — Issue #1459: T4 KI-Kontingent-Metering (Server)

Quelle: KI-ANALYSE-Block im Harness-Marker-Kommentar von #1459, AK1–AK9. Baut auf T1 (#1456, `plans.ts`
mit `AI_ASSIST_MONTHLY_QUOTA`/`getEntitlements`/`shouldBlockFeature`, `http-error.ts` mit `quota_exhausted`)
und T2 (#1457, `planGuard.ts` mit dem Marker-Muster `PlanFeatureHandler`) auf.

## Ziel

Jeder erfolgreiche Aufruf einer der fünf LLM-Routen (`POST /tasks/parse-text`, `POST /tasks/parse-search`,
`POST /tasks/suggest-pillars`, `POST /pillars/advisor`, `POST /lektorat`) verbraucht genau einen Punkt des
monatlichen `ai_assist`-Kontingents des angemeldeten Nutzers. Am Deckel antwortet der Server 429
(`code: 'quota_exhausted'`), ein gescheiterter Provider-Call (Status ≥ 500) kostet kein Kontingent. Alle
fünf Routen bekommen zusätzlich `requirePlanFeature('ai_assist')` vorgeschaltet (fehlt heute komplett).

## Tabelle `ai_usage` (AK1, AK3)

Neu: `server/src/models/aiUsage.ts`. Spalten `userId` (INTEGER), `yearMonth` (STRING, Format `YYYY-MM`),
`count` (INTEGER). Unique-Index auf (`userId`, `yearMonth`) — Muster `notificationLog.ts:22-54`.
Registrierung in `server/src/models/index.ts`, Anlage über `sequelize.sync()`.

## Handler-Reihenfolge

`requireAuth` → `requirePlanFeature('ai_assist')` → Zähler-Middleware (neu, `server/src/express/aiQuotaMeter.ts`)
→ Routen-Handler.

## Buchung (AK1, AK2, AK3)

- Zeile per `findOrCreate` sicherstellen, danach ein einziges bedingtes
  `UPDATE ai_usage SET count = count + 1 WHERE userId = ? AND yearMonth = ? AND count < ?` (Limit aus
  `AI_ASSIST_MONTHLY_QUOTA[plan]`, `plans.ts:25`). Kein Read-Modify-Write in JavaScript.
- `0` betroffene Zeilen ⇒ Kontingent erreicht ⇒ 429.
- Zehn gleichzeitige Requests eines Nutzers mit Restkontingent 1 ergeben genau einen 2xx und neun 429; der
  Zähler steht danach exakt auf dem Kontingent (AK3).

## Rückbuchung (AK4)

Bei Provider-Fehler (Antwortstatus ≥ 500, inkl. 503) ein `UPDATE ai_usage SET count = count - 1 WHERE
userId = ? AND yearMonth = ? AND count > 0`, angebunden ans `finish`-Ereignis der Response (deckt alle
fünf Routen ohne Handler-Eingriff ab). Eine 400 aus der Eingabevalidierung zählt nicht (kein Provider-Call
erfolgt).

## Rollout-Schalter (AK8)

Bei `isMonetizationEnforced() === false` wird unbedingt gebucht (`count = count + 1` ohne Obergrenze) und
nie mit 429 abgewiesen.

## Fehlerantwort (AK6)

429, Body `sendPlanError(res, 429, message, { code: 'quota_exhausted', feature: 'ai_assist', currentPlan })`
— kein `requiredPlan` (das Paket selbst reicht, nur das Kontingent ist verbraucht).

## Restkontingent im Vertrag (AK7)

`getEntitlements(plan, consumed?)` bekommt einen optionalen zweiten Parameter (Verbrauch im laufenden
Monat); `ai_assist.quotaRemaining = max(0, AI_ASSIST_MONTHLY_QUOTA[plan] - consumed)`. `GET /auth/me`
(`routes/auth.ts:339`) ruft ihn mit dem aktuellen Verbrauch des Nutzers auf. Erfolgreiche Antworten der
fünf Routen tragen denselben Wert als optionales Feld `quotaRemaining` im Body.

## Plan-Gating vor dem Zähler (AK9)

Free (Kontingent 0) erreicht den Zähler nicht: `requirePlanFeature('ai_assist')` weist mit 403
`plan_required` ab, bevor die Zähler-Middleware läuft. Kein `ai_usage`-Eintrag entsteht.

## OpenAPI (AK6)

`openapi.yml`: 429-Antwort mit Schema `Error` an den vier bestehenden Pfaden (`/tasks/parse-text`,
`/tasks/parse-search`, `/tasks/suggest-pillars`, `/pillars/advisor`) sowie am neu aufzunehmenden
`/lektorat`; `quotaRemaining` in den zugehörigen Erfolgsschemata.

## Testabdeckung (AK5)

`server/src/express/ai-quota-coverage.test.ts` enumeriert den gemounteten Router-Stack der fünf
LLM-Routendateien (Muster `plan-gating-coverage.test.ts`) und prüft, dass jede Route eine
Middleware mit der Marker-Eigenschaft der Zähler-Fabrik trägt.
