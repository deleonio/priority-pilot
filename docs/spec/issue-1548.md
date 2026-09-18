# Spec — Issue #1548: Eigener LLM-Provider pro Nutzer — Auflösung, Gate- und Kontingent-Bypass (2/3)

Quelle: Harness-Marker-Kommentar (KI-ANALYSE, stand=2026-09-17T20:45:19Z), AK3–AK7.
Parent #1531; Voraussetzung #1547 (nutzergebundene Custom-Provider) ist gemergt.

## Ziel

Ein Nutzer mit eigenem Custom-Provider (#1547) kann diesen als den für seine KI-Aufrufe
gültigen Provider auswählen. Aufrufe über den eigenen Provider umgehen das Paket-Gate
(`requirePlanFeature('ai_assist')`) und die Kontingent-Buchung (`meterAiQuota`) — auch im
Free-Paket. Aufrufe über instanzweite Provider werden wie bisher gezählt und bei erschöpftem
Kontingent abgewiesen.

## Vorbedingung

- #1547: Custom-Provider tragen `userId`; `providerScope()`/`isProviderAccessible()` existieren.
- `AI_ASSIST_MONTHLY_QUOTA.free = 0` bleibt unverändert — Free ohne eigenen Provider ändert sich nicht.
- Die Kontingent-Buchung bleibt atomar inkl. Rückbuchung bei Fehlerantworten; der Bypass darf die
  Rückbuch-Logik nicht doppelt auslösen (nicht gebucht wird auch nicht zurückgebucht).

## Ablauf / Verhalten

1. **Auswahl (AK3):** Die Auswahl wird als Spalte `users.selectedLlmProviderId` (nullable,
   Default `null` = keine Auswahl) pro Nutzer gespeichert — Muster Geo-Config #1098, keine
   Instanz-Globalie. Endpunkte hinter `requireAuth`:
   - `PUT /llm-providers/selection` mit Body `{ providerId: number | null }`: wählt einen
     eigenen ODER einen instanzweiten Provider aus bzw. hebt die Auswahl auf (`null`).
     Provider-ID eines fremden Nutzers → **404** (wie #1547), ungültiger Body → **400**.
   - `GET /llm-providers/selection` → `{ providerId: number | null }`.
2. **Auflösung (AK3):** `loadActiveProvider(userId?)` (Aufrufpfad der LLM-Routen) liefert für
   einen Nutzer mit wirksamer Auswahl genau diesen Provider statt des instanzweit aktiven.
   Ohne Nutzerkontext, ohne Auswahl oder mit Auswahl auf einen nicht mehr existierenden bzw.
   nicht zugänglichen Provider: unverändert der instanzweit aktive Provider (inkl. Built-in-
   Fallback). `loadActiveProvider()` ohne Argument bleibt bytegleich beim Status quo.
3. **Gate-Bypass (AK4):** Auf den vier KI-Endpunkten (`/pillars/advisor`, `/tasks/parse-text`,
   `/tasks/parse-search`, `/lektorat`) erhält ein Nutzer mit wirksamer Auswahl eines **eigenen**
   Providers eine fachliche Antwort statt der 403-`plan_required`-Antwort — der Aufruf läuft
   über Endpoint/API-Key/Modell des eigenen Providers.
4. **Kontingent-Bypass (AK5):** Fällt die Auflösung auf einen eigenen Provider des Nutzers,
   bucht `meterAiQuota` keinen Punkt: der `ai_usage`-Monatszähler ist vor und nach dem Aufruf
   identisch, und ein erschöpftes Kontingent (Free = Limit 0) führt nicht zu 429.
5. **Instanz-Provider zählt weiter (AK6):** Ohne wirksame eigene Auswahl bleibt alles beim
   Status quo: Buchung vor dem Call, 429 `quota_exhausted` bei Erschöpfung.
6. **Free ohne eigenen Provider (AK7):** Free-Nutzer ohne wirksame Auswahl bekommen die
   KI-Funktionen weiterhin nicht: 403 `plan_required` an allen vier KI-Endpunkten — auch wenn
   sie eigene Provider **angelegt**, aber keinen **ausgewählt** haben.

## Akzeptanzkriterien → Testfälle

Neu `server/src/llm/llmProviders.per-user.test.ts` (Unit) und
`server/src/express/llm-provider-per-user.test.ts` (API):

| AK  | Testfall                                                                                                                                                                                                                                                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AK3 | TF1 (Unit): Auswahl des eigenen Providers → `loadActiveProvider(userId)` liefert ihn statt des instanzweit aktiven; ohne Auswahl den instanzweit aktiven; Auswahl eines instanzweiten Providers wirkt wie keine Auswahl; Auswahl auf gelöschten Provider → Fallback. |
| AK3 | TF2 (API): `PUT /llm-providers/selection` persistiert die Auswahl (`GET` liefert sie zurück), `null` hebt sie auf; fremde Provider-ID → 404.                                                                                                                         |
| AK4 | TF3 (API): Free-Nutzer mit ausgewähltem eigenen Provider ruft `/lektorat` auf → 200 mit fachlicher Antwort, der LLM-Call geht an Endpoint + API-Key des eigenen Providers (nicht an den instanzweit aktiven).                                                        |
| AK5 | TF4 (API): Derselbe Aufruf mit `MONETIZATION_ENFORCED=true`: kein 429 trotz Free-Limit 0, `ai_usage`-Zähler vor/nach identisch.                                                                                                                                      |
| AK6 | Von `ai-quota.test.ts` AK1/AK6 abgedeckt (Instanz-Provider zählt, 429 bei Erschöpfung) — keine Duplizierung.                                                                                                                                                         |
| AK7 | TF5 (API): Free-Nutzer mit angelegtem, aber NICHT ausgewähltem eigenem Provider → 403 `plan_required` an allen vier KI-Endpunkten. Die Vollmatrix free-ohne-jeden-Provider deckt `plan-gating.test.ts` AK2 ab.                                                       |

## Annahmen (dokumentiert, nicht blockierend)

- Spaltenname `selectedLlmProviderId` und Endpunktpfad `/llm-providers/selection` sind in dieser
  Spec verbindlich gesetzt (die Analyse nennt nur „analog Geo-Config"); die Implementierung darf
  Details (Validierungsfehlermeldungen, DTO-Namen) frei wählen.
- OpenAPI-Schemata und Client-Typen zieht die Implementierungsphase mit (kein eigener AK — die
  AKs sind rein Verhalten).
- „Fremder Provider" bei der Auswahl richtet sich nach dem #1547-Zugriffsmodell
  (`isProviderAccessible`): eigene + instanzweite IDs sind wählbar, fremde nicht.
