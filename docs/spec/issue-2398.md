# Spec #2398 — Inhaltliche Präferenzen kontogebunden speichern

Teil von #2019 (PO-Entscheidung F1 b in #1957). Muster: `balanceVariant` (#2009), `geoConfig` (#1098).

## Umfang

Am Konto liegen genau vier Schalter: KI aktiv (`aiEnabled`, Default `true`), Balance-Priorität
(`balancePriority`, Default `true`), Expertenmodus (`expertMode`, Default `false`), Geo-Schalter
(`geolocationEnabled`, Default `false`). Die Defaults sind die bisherigen Frontend-Defaults.
Gerätelokal bleiben Theme, Kopfzeilen-Position, Animationen, Sprach-Autostart und Hinweis-Banner
(inkl. Balance-Hinweis-Dismiss). Die Balance-Variante ist schon kontogebunden (#2009).

## Server — `GET/PUT /api/v1/account-preferences`

- Antwort/Body: `{ aiEnabled, balancePriority, expertMode, geolocationEnabled }` (alle boolean).
- GET: gespeicherte Werte, fehlende Felder mit Default. Setzt den CSRF-Token als Header `x-csrf-token`.
- PUT: Teilmenge der vier Felder, nur boolean; andere Typen → 400 ohne Persistenz; leerer Body → 400.
  Antwort = vollständiger Stand. Nicht gesendete Felder bleiben unverändert.
- Ohne Anmeldung 401. Konto B sieht und ändert nie die Werte von Konto A.

## Frontend

- `lib/accountPreferences.ts`: `pullAccountPreferences()` holt per GET einmal je Seitenlade den
  Kontostand und schreibt ihn in die Spiegel-Schlüssel (`pp-ai-enabled`, `pp-balance-priority`,
  `pp-expert-mode`, `pp-geolocation-enabled`); das Konto gewinnt gegen den Gerätewert.
- `storeAiPreferences`, `storeBalancePreferences`, `storeExpertMode`, `storeGeolocationPreference`
  schreiben den Spiegel und senden das geänderte Feld per PUT (Best-Effort, Fehler geschluckt).
- Gerätelokale Speicher (`storeTheme`, `storeHeaderPosition`, `storeAnimationsEnabled`,
  `storeVoiceAutostartPreference`, `dismissBalanceHint`) rufen nie `fetch`.

## Akzeptanz

- AK1/AK2: Server-Tests `server/src/express/account-preferences.test.ts`.
- AK3: Vitest `frontend/src/lib/accountPreferences.test.ts`; e2e `frontend/e2e/issue-2398-konto-praeferenzen.spec.ts`.
- AK4: Vitest `frontend/src/lib/accountPreferences.test.ts` (Gerätelokal-Block).
