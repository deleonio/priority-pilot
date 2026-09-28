# Spec: Fürsorge-Push bei vernachlässigten oder überlasteten Säulen (#1794)

## Ziel

Nutzer mit mindestens einer **defizitären oder überlasteten Säule** (`bewerteCareDefizit`, #1790)
erhalten **höchstens einen Fürsorge-Push pro Kalendertag** (Nutzer-Zeitzone) — warm in der Tonalität
(`docs/fuersorge-tonalitaet.md`), nie zwischen 21:00 und 08:00 Uhr ihrer Zeitzone, gebündelt zu
**einer** Nachricht (Web-Push **und** FCM) über `sendPushToUser`. Der eigene Schalter
„Fürsorge-Hinweise" stoppt ausschließlich diesen Push; Frist-Erinnerungen (`kind: 'due-task'`) und
der Push-Hauptschalter bleiben unberührt.

## Voraussetzungen

- #1790 liefert `bewerteCareDefizit(saeulen, tasks, jetzt)` samt `CARE_FENSTER_TAGE`/`UEBERLAST_ANTEIL` — Import, keine kopierten Schwellen.
- `careSuggestionData.ts` liefert `CARE_SPRACHEN` (zehn Sprachen) als Katalog-Muster.
- `sendPushToUser(userId, payload, send?)` erreicht Web-Push-Subscriptions und FCM-Token desselben Nutzers in einem Aufruf (`logics/push.ts`).
- Scheduler-Verdrahtung (`startScheduler` in `server/index.ts`) — bewusst ohne Test (Wiring, ADR 0001).

## Vertrag `server/src/logics/carePush.ts` (neu)

- `runCarePush(now?: Date, send?: PushSender): Promise<{ usersNotified: number }>` — Scheduler-Trigger nach Muster `dueTaskReminders.ts`/`geo-background-job.ts`, Sender injizierbar.
- Je Nutzer (Opt-out via `User.carePushEnabled`): Säulen + erledigte Aufgaben (Erledigt-Zeitpunkt = `ScoreEntry.zeitpunkt`, Muster `routes/scores.ts:248-266`) laden und `bewerteCareDefizit` auswerten.
- **Betroffen** = mindestens eine Säule `defizitaer` oder `ueberlast`. **Situation** `'ueberlast'`, wenn mindestens eine Säule überlastet ist, sonst `'defizit'`. Genannte Säule: freie Impl-Entscheidung unter den betroffenen (kanonische Id 1–5 → Säulen-Text, abweichende Id → generischer Fallback).
- **Ruhezeit (AK2):** kein Versand, wenn die lokale Uhrzeit in `[21:00:00, 08:00:00)` liegt (21:00 blockiert, 08:00 erlaubt) — Stunden in der Nutzer-Zeitzone (`Intl.DateTimeFormat` mit `timeZone`, Muster `logics/streak.ts:40`).
- **Dedup (AK1):** `NotificationLog` mit `kind: 'care-push'`, `dedupeKey: '<userId>:<lokalesISO-Datum>'` (z. B. `1:2026-07-07`), `sentAt: now`; Eintrag nur, wenn `sent > 0`. Ein wiederholter Lauf am selben lokalen Kalendertag sendet nichts.
- **Zeitzone (AK8):** `User.zeitzone` (IANA). Ungültige oder fehlende Zeitzone fällt auf `'UTC'` zurück, ohne den Lauf zu brechen. Liegt die Scheduler-Stunde dauerhaft in der Ruhezeit, erhält der Nutzer an solchen Tagen bewusst keinen Fürsorge-Push (keine Nachholung).
- **Payload (AK5/AK6):** `{ title, body, url: '/' }` (Dashboard) je Nutzer **eine** gebündelte Nachricht — auch bei mehreren betroffenen Säulen; Textsprache Default `'de'` (solange keine App-Sprache persistiert ist, siehe Offene Fragen im PR).
- **Textkatalog (AK6):** `CARE_PUSH_TEXTE` (Muster `careSuggestionData.ts`) — je Situation `'defizit' | 'ueberlast'` und kanonischer Säulen-Id 1–5 Einträge in **allen zehn** `CARE_SPRACHEN`, keine Leerstrings; `pushTextFuer(situation, saeuleId, sprache)` liefert den Säulen-Text bzw. den generischen Fallback für unbekannte Säulen-Ids. Tonalität nach `docs/fuersorge-tonalitaet.md` (warm, nicht belehrend, maximal zwei Sätze, keine Emojis) — inhaltliche Ton-Prüfung manuell/visuell, nicht maschinell.

## Vertrag API (AK7/AK8) — `PUT/GET /care-config` (Muster `geoConfig.ts`)

- `GET /care-config` → `{ carePushEnabled: boolean, zeitzone: string }`; Defaults `true` / `'UTC'`, solange nichts gespeichert ist.
- `PUT /care-config` speichert `{ carePushEnabled, zeitzone }` **nur für den eigenen Account** (Datenisolation); `carePushEnabled` muss boolean sein, `zeitzone` ein gültiger IANA-Name (gültigkeitsprüfung z. B. über `Intl.DateTimeFormat`-Probe) — Verstöße → `400` ohne Persistenz.
- `User` erhält die Spalten `carePushEnabled` (boolean, Default `true`) und `zeitzone` (string, nullable).

## UI (AK7) — `SettingsPage.tsx`

- Switch „Fürsorge-Hinweise" (`KolInputCheckbox _variant="switch"`) in der Karte „Benachrichtigungen" (tab-0), **unterhalb** des Push-Hauptschalters, in einer eigenen `.settings-switch-row` (#971-Muster), mit `_hint` zur Abgrenzung (betrifft nur Fürsorge-Hinweise, Frist-Erinnerungen bleiben an).
- Zustand aus `GET /care-config`, Toggle ruft sofort `api.updateCareConfig` (kein Speichern-Button), `_disabled` während des PUT, Fehlschlag als `KolAlert` in derselben Switch-Zeile (#971/`pushFailed`-Muster). Kein Toast als einziger Ort.

## AK → Testfälle

| AK  | TF  | Test                                                                                                                                                                                        |
| --- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AK1 | TF1 | `carePush.test.ts` — Defizit → genau ein Push (Payload `url:'/'`, Log-Zeile), zweiter Lauf am selben lokalen Tag → 0, Folgetag → 1; nur überlastete Säule (ohne Defizit) löst ebenfalls aus |
| AK2 | TF2 | 22:30 und 07:59 Nutzer-tz → kein Versand; 08:00 → Versand                                                                                                                                   |
| AK3 | TF3 | ausgewogene Säulen → kein Versand, kein NotificationLog-Eintrag                                                                                                                             |
| AK4 | TF4 | Schalter aus → kein Fürsorge-Push; `runDueTaskReminders` sendet für denselben Nutzer unverändert                                                                                            |
| AK5 | TF5 | PushSubscription + FcmToken desselben Nutzers → beide Kanäle erhalten die Payload (Web-Push injiziert, FCM über `FCM_SERVICE_ACCOUNT_FILE` + fetch-Stub)                                    |
| AK6 | TF6 | Katalog: je Situation (Defizit/Überlast) × zehn `CARE_SPRACHEN` × Säulen 1–5 Titel/Text ohne Leerstring; `pushTextFuer` greift für unbekannte Säule auf den Fallback zurück                 |
| AK7 | TF7 | `care-config.test.ts` (Defaults, PUT/GET, 400 bei Unfug, Datenisolation, 401) + `SettingsPage.test.tsx` (Switch rendert, Toggle → PUT, PUT-Fehler → Alert)                                  |
| AK8 | TF8 | Lauf mit ungültiger/fehlender Zeitzone bricht nicht und fällt auf UTC zurück (19:30 UTC → Versand); API-Seite: 400 bei ungültiger Zeitzone                                                  |
| AK7 | TF8 | E2E 375px: Schalter sichtbar/bedienbar, Toggle überlebt den Reload (serverseitig)                                                                                                           |

Scheduler-Registrierung (`server/index.ts`) bleibt unverdrahtungs-getestet (ADR 0001: kein Config/Wiring-Test).
