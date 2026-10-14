# Spec #2545 — PayPal ohne Zugangsdaten: eindeutige Meldung statt stillem 503

## Ziel

Fehlende PayPal-Zugangsdaten werden sichtbar gemacht statt still verschluckt:

1. **Startup (AK1):** `assertPaypalConfig` meldet in Produktion auch dann eine eindeutige Meldung
   mit den fehlenden Variablennamen (nie Werten), wenn ALLE PayPal-Variablen leer sind. Gewählter
   Weg (PO-Entscheidung 2026-10-14): **kein Startabbruch** — `console.error` und der Server läuft
   weiter, das PayPal-Billing ist aus (eine fehlende Konfiguration darf die App nicht lahmlegen).
   Teil-Konfiguration (ID oder Secret gesetzt, Rest fehlt) wirft weiter wie #2302. Dev/Test ohne
   Zugangsdaten bleibt No-Op (Plan-ID-Fallback-Muster #2302/#1494 unverändert).
2. **Webhook (AK2):** `verifyWebhookSignature` erkennt fehlende Konfiguration **vor** dem
   Netzaufruf und liefert ein von `unreachable` unterscheidbares Ergebnis
   **`'unconfigured'`** (neuer Wert in `PaypalVerificationResult`), dabei `console.error` mit den
   fehlenden Variablennamen. `receiveProviderEvent` in `billing.ts` beantwortet `'unconfigured'`
   **ohne 5xx**, damit PayPal nicht endlos erneut zustellt; kein `WebhookEvent`-Eintrag nötig.
   Der `unreachable`-Pfad (echter Netzausfall → unverifizierte Ablage + 503, #1495 AK2, ADR 0013)
   bleibt unverändert; Google-Play-RTDN teilt sich `receiveProviderEvent` und wird im
   Statusverhalten nicht angetastet.

`unconfigured` ⟺ mindestens eine der drei Variablen `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`,
`PAYPAL_WEBHOOK_ID` ist leer (getrimmt).

## Vorbedingung

- Server gestartet; `POST /webhooks/paypal` erreichbar (ohne Session/CSRF, #1495 AK1).
- Für den Netzausfall-Fake im Test steht `PAYPAL_API_BASE` auf einer toten lokalen Adresse, sodass
  `fetch` schnell scheitert.

## Schritte (Kontrakt je Testfall)

- **TF1 (AK1, Unit `server/src/logics/paypal.test.ts`, describe `assertPaypalConfig`):**
  1. `NODE_ENV=production`, keinerlei `PAYPAL_*`-Variable gesetzt → `assertPaypalConfig` wirft
     nicht und loggt per `console.error`; die Meldung nennt `PAYPAL_CLIENT_ID` und
     `PAYPAL_CLIENT_SECRET`.
  2. `NODE_ENV≠production` und keine `PAYPAL_*`-Variable gesetzt → wirft nicht (Dev/Test erlaubt).
- **TF2 (AK2, Unit `server/src/logics/paypal.test.ts`):** `verifyWebhookSignature` mit geleerten
  drei Zugangsvariablen und Fetch-Spy → Ergebnis genau `'unconfigured'`, `console.error` enthält
  Variablennamen, Fetch wurde **nicht** aufgerufen.
- **TF3 (AK2, API `server/src/express/billing.test.ts`, echter Provider):**
  1. Ohne Konfiguration (`PAYPAL_API_BASE` tot, Zugangsvariablen geleert) → `POST
/webhooks/paypal` antwortet mit Status < 500 (kein PayPal-Retry).
  2. Mit gesetzten Zugangsvariablen, aber totem `PAYPAL_API_BASE` (echter Netzausfall) →
     weiterhin 503 (Grenze des Vertrags, schützt #1495 AK2).

## Erwartetes Ergebnis

Produktivstart ohne jegliche PayPal-Zugangsdaten läuft mit eindeutiger Variablen-Meldung
(`console.error`) weiter, das PayPal-Billing bleibt aus; ein PayPal-Webhook ohne Konfiguration wird
ohne 5xx quittiert (kein Retry-Loop) und der Grund steht mit Variablennamen im Log — klar
abgesetzt vom 503-Pfad bei echten Erreichbarkeitsproblemen.
