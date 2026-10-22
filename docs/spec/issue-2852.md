# Spec #2852 — Abo-/Rechnungs-Service-Pushes (zustandsbasierter Sweep) und Rechnungen-Anker

Vertrag für die Umsetzung (rote Tests: `server/src/logics/aboPush.test.ts`, `server/src/logics/pushTargets.test.ts`, `frontend/e2e/abo-rechnungen-anchor.spec.ts`). Keine Webhook-Änderung: PayPal/Play schreiben nur den Zustand (`applyPaymentEvent` → `firstFailureAt`+`past_due`; `applyPlayState` → `past_due`/`suspended`; Rechnungen in `invoices.ts`). Ein neuer Sweep liest stündlich Subscription + Invoice + User.

## Ziel: `server/src/logics/aboPush.ts` (neu)

`runAboServicePush(now?: Date, send?: PushSender): Promise<{ sends: number }>` — Muster `monthlyRecapPush.ts` (injizierbare Uhr + injizierbarer Sender), Dedupe über `sendDedupedPush` (NotificationLog, Log erst bei `sent > 0`), Ruhezeit-Gate `istRuhezeit` (21–7 Ortszeit, `nutzerZeitzone(user.zeitzone)`). Texte `ABO_PUSH_TEXTE` (je Ereignis × de/en nach `spracheVon(user.sprache)`). Rückstands-Schutz: nur Ereignisse der letzten 7 Tage (Rechnungs-`createdAt` bzw. Abo-Ende) erhalten einen Push.

Dedupe-Keys je Zustand getrennt (ein Zustand blockiert keinen anderen): `invoice:<id>`, `abo:<subscriptionId>:failed`, `abo:<subscriptionId>:grace`, `abo:<subscriptionId>:ended`.

## AK1 — Neue Rechnung/Gutschrift

- Vor: User mit Push-Subscription; Invoice-Zeile ohne NotificationLog-Eintrag, `createdAt` innerhalb der letzten 7 Tage.
- Lauf: genau **ein** Push mit `url: '/settings/pakete#rechnungen'` (`PUSH_TARGETS.aboInvoice`); zweiter Lauf sendet nichts (Idempotenz über NotificationLog).
- Gutschrift (`creditForInvoiceId` gesetzt) erhält denselben Push. Rechnung älter als 7 Tage: kein Push.
- Die Rechnungsmail mit PDF (`issueInvoiceForPeriod`, #2306) bleibt unangetastet — dort bereits durch `invoices-credit-note.test.ts`/`invoice-pdf.test.ts` abgesichert, hier kein neuer Test.

## AK2 — Fehlgeschlagene Zahlung

- Vor: Subscription `status: 'past_due'` (PayPal `PAYMENT.FAILED`/`SALE.DENIED`) oder `status: 'suspended'` (Play `IN_GRACE_PERIOD`/`ON_HOLD`, PayPal `SUSPENDED`), jeweils mit `firstFailureAt`.
- Lauf: genau **ein** Push mit `url: '/settings/pakete'` (`PUSH_TARGETS.aboStatus`); zweiter Lauf sendet nichts. Beide Status teilen den Dedupe-Key-Raum `:failed` — kein Doppel-Push beim Provider-Übergang past_due → suspended.
- Ist der Zustand wieder `active`, wird nichts nachgeholt (auch nicht bei alt gesetztem `firstFailureAt`).

## AK3 — Kulanz-Erinnerung (3 Tage vor Fristende)

- Vor: Subscription `past_due`/`suspended` mit `firstFailureAt`; Kulanzfrist `GRACE_PERIOD_DAYS = 15` (`billing/lifecycle.ts`).
- Lauf: ab `firstFailureAt` + 12 Tagen und solange die Frist läuft (bis Tag 15) genau **eine** Erinnerung mit `url: '/settings/pakete'` unter eigenem Dedupe-Key (`:grace`) — ein zuvor geloggter Zahlungsausfall-Push blockiert sie nicht. Vor Tag 12 und ab Fristablauf (Tag 16, `grace_expired`): kein Push.

## AK4 — Ruhezeit (21–7 Ortszeit) mit Nachholung

- Lauf in der Ruhezeit (z. B. 23:00 UTC): **kein** Versand **und kein** NotificationLog-Eintrag — sonst würde der blockierte Lauf die Nachholung wegdeduppen.
- Erster Lauf im Tagesfenster (z. B. 07:30 UTC), Zustand trifft noch zu: der Push geht raus (Nachholung).

## AK5 — Abo-Ende

- Je Fall genau **ein** Push mit `url: '/settings/pakete'` (`PUSH_TARGETS.aboStatus`), Dedupe-Key `:ended`:
  - `status: 'grace_expired'` (Kulanzfrist abgelaufen),
  - `status: 'cancelled'` mit `currentPeriodEnd` abgelaufen (innerhalb 7 Tage) — Play EXPIRED/zurückgebucht und bezahlte Laufzeit abgelaufen,
  - `status: 'cancelled'` mit `currentPeriodEnd` in der Zukunft: kein Push (läuft noch),
  - `currentPeriodEnd` mehr als 7 Tage her: kein Push (Rückstands-Schutz).

## AK6 — Texte (§7.3 push-konzept.md)

- `ABO_PUSH_TEXTE` je Ereignis (`rechnung`, `zahlung_fehlgeschlagen`, `kulanz_erinnerung`, `abo_ende`) × `de`/`en`: Titel und Text nicht leer, de ≠ en; kein werblicher Satz (keine Rabatt-/Angebot-/Deal-/Prozent-Floskeln).
- Versandtext folgt `spracheVon(user.sprache)`: en-Nutzer erhalten den englischen, de-Nutzer den deutschen Text.

## AK7 — Anker `/settings/pakete#rechnungen` (#2848-Muster)

- Hash-Navigation auf `/app/settings/pakete#rechnungen`: Pakete-Tab ist aktiv, das Rechnungen-`KolDetails` ist aufgeklappt (Inhalte sichtbar), die Sektion `id="rechnungen"` trägt den Fokus und liegt im sichtbaren Bereich (375 px), danach ist der Anker per `history.replaceState` aus der Adresse entfernt. `scrollIntoView` ohne Animation.
- Umsetzungsebene (Impl): `useDashboardAnchor`-Regex `karte-[a-z-]+` matcht `rechnungen` nicht — Hook erweitern oder Schwester-Hook (#2848-Muster: Fokus mit `HTMLElement.prototype.focus`, EIN `scrollIntoView` auto, replaceState).

## Push-Ziele (`server/src/logics/pushTargets.ts`)

- Neu: `aboInvoice: '/settings/pakete#rechnungen'`, `aboStatus: '/settings/pakete'`.
- Spiegel: der Anker `rechnungen` existiert als `id="rechnungen"` in `frontend/src/components/SubscriptionSection.tsx` (Muster `pushTargets.test.ts` #2851).

## Scheduler-Anbindung

- `runAboServicePush` wird in `server/src/index.ts` am stündlichen `startScheduler` registriert (PUSH_REMINDERS_ENABLED-Gate prüft der Scheduler selbst). Kein eigener Test: reine Verdrahtung (ADR 0001 — Konfigurations-/Registrierungs-Assertionen ohne Zähne).
