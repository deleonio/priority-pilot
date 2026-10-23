# Spec #2546 — Server: PayPal-Aufrufe brechen nach einem Zeitlimit ab

## Ziel

Jeder der sieben Fetch-Aufrufstellen in `server/src/logics/paypal.ts` trägt ein AbortSignal mit
festem Zeitlimit (`signal: AbortSignal.timeout(<Limit>)`, Muster `obsidianFeedback.ts:60` /
`calendar-ics.ts:157` / `geocodeSearch.ts:79`): `verifyWebhookSignature` (2 Stellen),
`getAccessToken` (1), `createPaypalClient` mit `createSubscription`/`cancel`/`getSubscription`/
`revise` (4).

- Das Zeitlimit ist eine benannte Konstante, Default **10000 ms**, zur **Callzeit** über
  `PAYPAL_TIMEOUT_MS` überschreibbar (Muster `apiBase()`) — sonst greift der Test-Override nicht.
- `/auth/me` (`auth.ts:594` → `applyDueGracePeriod`, `lifecycle.ts:114`) antwortet auch bei
  hängendem PayPal in begrenzter Zeit.
- Ein abgebrochener Kündigungsversuch läuft wie jeder cancel-Fehler im catch von
  `applyDueGracePeriod`: `console.warn`, Entzug läuft weiter (`status: 'grace_expired'`,
  `plan: 'free'`, `firstFailureAt: null`) — bewusster Vertrag #2234, **kein Retry**
  („Kulanzfrist bleibt für den nächsten Versuch fällig" ist Out of Scope lt. Analyse).
- Worst Case Lesepfad = Token- + Fachaufruf sequenziell = 2 × Zeitlimit (akzeptiert, wie bei den
  Nachbarn je Fetch).
- Bestehende Tests mit injizierten `fetchImpl`-Fakes (ignorieren die Fetch-Options) dürfen nicht
  brechen.

## Vorbedingung

- `PAYPAL_CLIENT_ID`/`PAYPAL_CLIENT_SECRET` gesetzt — sonst ist `paypalGraceDeps()` leer und es
  entsteht gar kein PayPal-Aufruf.
- Test-Fakes sind **abort-bewusst**: produktives `fetch` bricht über das übergebene Signal ab —
  der nie antwortende Fake spiegelt exakt dieses Verhalten (abort-Listener → reject) und hängt bis
  zum Signal. Ein Fake, der das Signal ignoriert, würde nie abbrechen (falsches Rot bzw. Hang).
- Watchdog (3 s) um jeden „muss abbrechen"-Fall: ohne Zeitlimit-Umsetzung endet der Test als
  klares Rot statt als ewiger Hang.

## Schritte (Kontrakt je Testfall)

- **TF1 (AK1, Unit `server/src/logics/paypal.test.ts`):** Fetch-Spy über alle fünf Abläufe —
  `verifyWebhookSignature` (2 Aufrufe), `createSubscription` (2), `cancel` (2), `getSubscription`
  (2), `revise` (2) = 10 Aufrufe über die 7 Stellen. Jeder protokollierte Aufruf trägt
  `init.signal` als `AbortSignal`.
- **TF2 (AK2, Unit ebd.):** nie antwortender, abort-bewusster `fetchImpl` +
  `PAYPAL_TIMEOUT_MS=100` → `cancel()` lehnt innerhalb von unter 1 s ab (gemessen; Watchdog 3 s).
- **TF3 (AK3/AK4, API `server/src/express/auth.test.ts`):** Abo mit abgelaufener Kulanzfrist
  (`firstFailureAt` 20 Tage zurück, `status: 'past_due'`), globaler `fetch` durch hängenden
  abort-bewussten Fake ersetzt (nach dem Test-Login, wiederhergestellt im `finally`),
  `PAYPAL_TIMEOUT_MS=100` → `/auth/me` antwortet in unter 1 s mit Status 200; `console.warn`
  protokolliert die gescheiterte Kündigung; die Antwort trägt den unveränderten Entzugs-Vertrag
  (`status: 'grace_expired'`, `plan: 'free'`).
- **TF4 (AK4, Regression — kein neuer Test, Dedup):** bestehende `lifecycle.test.ts`- und
  `paypal.test.ts`-Suiten bleiben grün. Der Entzugs-Vertrag bei werfendem `cancel` (inkl.
  `firstFailureAt: null` und Warnung) ist durch `lifecycle.test.ts` AK3 bereits abgedeckt; die
  Protokoll-Prüfung läuft mit in TF3.

## Erwartetes Ergebnis

Kein PayPal-Aufruf kann unbegrenzt hängen: nach dem Zeitlimit bricht er ab, `/auth/me` antwortet
auch bei ausgefallenem PayPal zügig, der Abbruch steht als Warnung im Log und der Entzug wird
trotzdem vollzogen (nächster PayPal-Versuch beim nächsten Lauf — kein eigener Retry-Mechanismus).
