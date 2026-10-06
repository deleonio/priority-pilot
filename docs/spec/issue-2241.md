# Spec #2241 — Upgrade-Guthaben über dem neuen Preis auf Folgezyklen übertragen

G = Guthaben (`creditCents`), P = Preis des neuen Pakets, k = floor(G / P), r = G − k·P.

## Upgrade mit G ≥ P

- Vorschau: `dueCents` 0, zusätzlich `creditCoversUntil` (ISO-Datum): Upgrade + k Perioden. Bei G < P fehlt das Feld, alles andere unverändert.
- `/change`: neues Abo `approval_pending` mit `currentPeriodEnd` = Upgrade + k Perioden und `creditCents` = r. Keine Rechnung, auch keine über 0 €.
- PayPal-Override: `startTime` ≥ Upgrade + k Perioden (keine Abbuchung für gedeckte Zyklen); der Folgezyklus zieht P − r ein (Mechanismus: Umsetzungsentscheidung, nicht Teil der Tests).

## Erste echte Abbuchung (SALE.COMPLETED)

- Rechnung mit „Paket …“ (P) und „Verrechnung Restlaufzeit“ (−r), Betrag P − r; danach `creditCents` = 0. Bei G > P (Altbestand) wird nur um P reduziert.
- Periode verlängert ab altem `currentPeriodEnd`, auch wenn dieses schon vergangen ist und noch keine Rechnung existiert (Heuristik `paypal.ts` „ab jetzt“ greift bei Guthaben-Abos nicht).

## Dialog (AK6)

Zeigt `creditCoversUntil`; 375 px ohne Überlauf (E2E/Vitest in der Umsetzungsphase, siehe PR „Offene Fragen“).
