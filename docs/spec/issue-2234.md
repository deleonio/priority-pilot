# Spec #2234 — Kulanzfrist-Ablauf entzieht das Paket

## Ziel

Wer nach einem fehlgeschlagenen Einzug 15 Tage lang nicht zahlt, verliert das Paket und das PayPal-Abo wird gekündigt. Nutzerdaten bleiben.

## Vorbedingung

Abo mit `firstFailureAt` gesetzt (Status `past_due`/`suspended`), `User.plan` = `pro`.

## Schritte und erwartetes Ergebnis

1. `applyDueGracePeriod(subscription, now, deps?)` mit `deps.cancel(externalSubscriptionId)`:
   - Tag 15 oder früher: No-Op, `plan` bleibt, kein `cancel` (AK2).
   - Ab Tag 16: bei `provider === 'paypal'` genau ein `cancel`-Aufruf; `User.plan` = `free`, `status` = `grace_expired`, `firstFailureAt` = `null` (AK1). Google Play: kein `cancel`.
   - Wirft `cancel`, wird gewarnt (`console.warn`); der Downgrade läuft trotzdem (AK3).
2. `GET /auth/me` liefert danach `plan: 'free'`, `subscription.status: 'grace_expired'` (AK4).
3. `applyDueGracePeriods(now, deps?)` (täglicher Scheduler-Lauf) wendet Schritt 1 auf alle Abos mit gesetztem `firstFailureAt` an; Abos ohne Fehlschlag oder in der Frist bleiben unberührt (AK5).
4. `PAYMENT.SALE.COMPLETED` in der Frist: `status` = `active`, `firstFailureAt` = `null`; ein späterer Lauf entzieht nichts (AK6).
