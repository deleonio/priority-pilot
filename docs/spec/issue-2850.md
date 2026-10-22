# Spec #2850 — Push-Nachrichten nach Themen ein- und ausschalten

## Ziel

Unter dem Push-Hauptschalter stehen fünf Gruppenschalter (Karte „Benachrichtigungen“, Einstellungen → Allgemein):
„Aufgaben und Erinnerungen“ (Default an), „Fürsorge“ (an, bestehender Schalter `carePushEnabled`),
„Erfolge und Rückblicke“ (an), „Gruppen“ (an), „Tipps und Angebote“ (Default **aus**).
Jede ausgeschaltete Gruppe stoppt ihre Push-Arten; Geo-Push, Test-Push und Abo-/Rechnungsnachrichten
bleiben unangetastet.

## Server

- Vier neue Boolean-Spalten an `users`: `taskPushEnabled` (1), `successPushEnabled` (1),
  `groupPushEnabled` (1), `tipPushEnabled` (0) — Migration mit Startup-Wiring; die vier
  `users`-Alt-Schema-Fixtures in `migrate.test.ts` werden in Phase 4 gepflegt.
- Neue Route `GET/PUT /api/v1/push-groups` (Muster `/care-config`): DTO = die vier Flags,
  Default-Fallback, PUT wehrt Nicht-Booleans mit 400 ohne Persistenz, Datenisolation je Nutzer.
  `carePushEnabled` bleibt unverändert bei `/care-config`.

## Gating (AK3)

- `taskPushEnabled === false` → kein Versand in `dueTaskReminders`, `dailyTopTasks`,
  `taskCreatedNotification`, `taskCompletedNotification`, `seriesGeneratedNotification`.
- `successPushEnabled === false` → kein Versand in `milestoneNotification`, `monthlyRecapPush`.
- `carePushEnabled`: Verhalten wie heute (`carePush.ts`). „Gruppen“/„Tipps“ gaten noch keinen
  Sender — Persistenz + UI genügen (#2844 dockt an).
- Kein Gating: Geo-Push (`geo-background-job`), Test-Push (`/push/test`), Abo-/Rechnungsmail.

## Frontend

- Fünf `.settings-switch-row`-Zeilen unter dem Hauptschalter (`KolInputCheckbox _variant="switch"`),
  sofortiges Speichern je Änderung (PUT /push-groups bzw. bestehendes /care-config für Fürsorge).
  Zeilen rendern immer (wie Fürsorge heute) — Spec-Entscheid, damit AK2/AK5 ohne echtes Push-Abo
  prüfbar bleiben; bei Hauptschalter aus `_disabled` + Begründungs-Hint (KI-UX).
- i18n de/en: die fünf Labels; der bisherige Label „Fürsorge-Hinweise“ wird zu „Fürsorge“ (§5).

## E2E

- 375 px: fünf Schalter sichtbar, Bounding-Box-Prüfung (kein Element ragt über den Viewport,
  `scrollWidth` ungeeignet — App-Shell clippt `overflow-x: hidden`); Toggle überlebt den Reload
  (Beweis über GET /push-groups).

## AK-Abdeckung

| AK  | Test                                                                            |
| --- | ------------------------------------------------------------------------------- |
| AK1 | `SettingsPage.test.tsx` „#2850: Push-Gruppenschalter“                           |
| AK2 | `server/src/express/push-groups.test.ts` (neu) + E2E-Reload                     |
| AK3 | je ein Gate-Test in den 7 Trigger-Testdateien                                   |
| AK4 | `geo-background-job.test.ts` Negativtest (Gruppen aus → Geo-Push sendet weiter) |
| AK5 | `frontend/e2e/issue-2850-push-groups.spec.ts` (neu)                             |
