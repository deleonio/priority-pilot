# Issue 1959 — Admin: Abo sperren/stornieren (Spec)

## Ziel

Admins sehen in der Nutzerverwaltung je Nutzer den Abo-Status und können nach expliziter
Bestätigung (1) ein Abo **sperren** — der Zugriff auf das bezahlte Paket stoppt sofort — oder
(2) ein Abo **stornieren** — die Kündigung wird beim Zahlungsdienstleister ausgelöst, das Paket
läuft bis zum Ende des bezahlten Zeitraums weiter.

## Vorbereitung

- Admin-Session (Rolle `admin`); Ziel-Nutzer mit PayPal-Abo (Status `active`, Paket `plus`).
- KI-UX-Block (Harness-Kommentar): Bestätigung nach `docs/ux-pattern-sequential-confirmation.md`
  (ein Ja/Nein-Schritt je Aktion, verbindliches Fokus-Management), Async-Zustände, Sperr-Status
  als Text-Badge, Aktionen voll breit bei 375px.

## Festgelegte Entwurfsentscheidungen (Spec-Arbeit laut Analyse)

| Entscheidung                                     | Wert                                                                                                                                                                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routen (neu, `requireRole('admin')`)             | `POST /admin/users/:id/subscription/lock`, `POST /admin/users/:id/subscription/cancel`                                                                                                                                     |
| Sperr-Status                                     | `locked` (Subscription.status)                                                                                                                                                                                             |
| Einordnung `locked`                              | **nicht** in `OPEN_SUBSCRIPTION_STATUSES` — die Sperre wirkt nur aufs bestehende Abo (`User.plan = free` via `syncUserPlan`); ein neuer Abschluss schaltet wieder frei („bezahlt = Zugang"), Konto-Löschung bleibt möglich |
| DTO                                              | `AdminUser.subscriptionStatus: string \| null` (`null` = kein Abo) in `GET /admin/users` und den Antworten beider Routen                                                                                                   |
| Storno-Ziel                                      | offenes Abo (`active`/`approval_pending`); Provider-Aufruf `cancel(externalSubscriptionId)`; Wirksamkeit **nur** über Webhook `BILLING.SUBSCRIPTION.CANCELLED` (ADR 0013)                                                  |
| Google-Play-Abo (`provider: 'google'`)           | `409` mit Hinweis — serverseitig nicht kündbar; Sperren bleibt möglich                                                                                                                                                     |
| Bereits gekündigt (`cancelled` mit Restlaufzeit) | `409` „bereits gekündigt", kein Provider-Aufruf                                                                                                                                                                            |
| Kein Abo (lock/cancel)                           | `404` „Kein Abo gefunden."                                                                                                                                                                                                 |
| PayPal 4xx / 5xx beim Storno                     | `409` / `502` (Spiegel der Selbstkündigung, #2048)                                                                                                                                                                         |
| Client-Methoden                                  | `api.lockUserSubscription({ id })`, `api.cancelUserSubscription({ id })`                                                                                                                                                   |
| UI-Beschriftung                                  | Zeilen-Aktionen „Abo sperren" / „Abo stornieren"; Bestätigungs-Buttons „Jetzt sperren" / „Jetzt stornieren" (Muster „Jetzt neu berechnen"), „Abbrechen" ohne Request                                                       |
| Entsperrung                                      | außerhalb des Scopes (weder AK noch Messgröße)                                                                                                                                                                             |

## Schritte und erwartetes Ergebnis

### AK1 — Sperren

`POST /admin/users/:id/subscription/lock` (nur `admin`) setzt `Subscription.status = 'locked'`
und stuft über `syncUserPlan(sub, 'free')` sofort auf `free` — alle Guards lesen `User.plan`
(`planGuard`, `apiTokenAuth`). Antwort 200 mit DTO (`plan: 'free'`,
`subscriptionStatus: 'locked'`). Kein Provider-Aufruf. Der Sperr-Status bleibt in
`GET /admin/users` sichtbar (Badge „Gesperrt" in der Nutzerzeile).

### AK2 — Stornieren

`POST /admin/users/:id/subscription/cancel` ruft `cancel(externalSubscriptionId)` beim Provider;
unmittelbar danach bleibt der Status `active` (keine Vorwegnahme des Webhooks). Das Webhook-
Ereignis `BILLING.SUBSCRIPTION.CANCELLED` setzt `status = 'cancelled'`, das Paket läuft bis
`currentPeriodEnd` weiter (`User.plan` unverändert).

### AK3 — Autorisierung

Member/Test erhalten auf beiden Routen 403. Die eigene Selbstkündigung
(`POST /billing/subscriptions/cancel`) bleibt unverändert nutzbar.

### AK4 — Bestätigung (UI)

Je Nutzerzeile zwei Aktionen („Abo sperren", „Abo stornieren"). Jede öffnet einen
Ja/Nein-Bestätigungsdialog: **Abbrechen setzt keinen Request ab** und schließt den Dialog
(Fokus zurück auf den auslösenden Button — verbindliches Pattern); Bestätigen führt die Aktion
aus und aktualisiert die Zeile. Bei 375px voll breite Aktionen, kein horizontaler Überlauf.

## Testzuordnung

| AK  | Test                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AK1 | `server/src/express/admin-subscriptions.test.ts` (Lock-API, DTO, Zweitabschluss unblockiert), `AdminUsersSection.test.tsx` („Gesperrt"-Badge)           |
| AK2 | `admin-subscriptions.test.ts` (Provider-Aufruf, Webhook-Nachlauf, 409/404/Google/4xx/5xx)                                                               |
| AK3 | `admin-subscriptions.test.ts` (403 member/tester, Selbstkündigung intakt)                                                                               |
| AK4 | `AdminUsersSection.test.tsx` (Dialog, Abbrechen ohne Request), `frontend/e2e/admin-users-subscription.spec.ts` (375px, Fokus-Restore, Bestätigen wirkt) |
