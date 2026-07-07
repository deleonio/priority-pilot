# Lösungsplan — #355 PWA Push-Nachrichten: fachlicher Trigger

> Stand: 2026-07-07 · Ticket: [#355](https://github.com/deleonio/priority-pilot/issues/355)
> Basiert auf der KI-Analyse im Issue-Body und dem tatsächlichen Code-Stand (`main`).

## 1. Ausgangslage — was bereits erledigt ist

Die **Web-Push-Opt-in-Infrastruktur** aus #355 ist **schon umgesetzt und gemergt**
(PR #365, Commits `a24e5b6` „feat(push): Web-Push-Opt-in-Infrastruktur" und `ef6e53d`
„fix(push): Datenisolation + Race Condition"). Konkret vorhanden auf `main`:

| Baustein | Datei | Status |
| --- | --- | --- |
| Sequelize-Modell `push_subscriptions` (pro Nutzer, `userId`-Isolation, Unique-`endpoint`) | `server/src/models/pushSubscription.ts` | ✅ |
| Modell-Registrierung | `server/src/models/index.ts` | ✅ |
| Router `GET /push/vapid-public-key`, `POST /push/subscribe`, `POST /push/unsubscribe` (hinter `requireAuth`) | `server/src/express/routes/push.ts` | ✅ |
| Router-Verdrahtung | `server/src/express/index.ts` | ✅ |
| Versand-Helfer `sendPushToUser(userId, payload, send?)` inkl. Selbstheilung bei `404/410` | `server/src/logics/push.ts` | ✅ |
| VAPID-Env (`VAPID_PUBLIC_KEY/_PRIVATE_KEY/_SUBJECT`), Doku + Startup-Log | `server/.env.example`, `server/src/env-startup-log.ts` | ✅ |
| `web-push@3.6.7` + Typen als Dependency | `server/package.json` | ✅ |
| OpenAPI-Contract der Push-Endpunkte | `openapi.yml` (Z. 542–614, 1364–1419) | ✅ |
| Frontend-Lib + Hook `usePushSubscription()` | `frontend/src/lib/push.ts` | ✅ |
| Toggle in der SettingsPage | `frontend/src/components/SettingsPage.tsx` | ✅ |
| Service Worker `push`/`notificationclick` | `frontend/public/push-sw.js` | ✅ |
| Workbox-Einbindung `importScripts: ['/push-sw.js']` | `frontend/vite.config.ts` | ✅ |
| Backend-Tests (API, Datenisolation, Versand-Helfer) | `server/src/express/push*.test.ts`, `server/src/logics/push.test.ts` | ✅ |
| Frontend-Lib-Test | `frontend/src/lib/push.test.ts` | ✅ |

**Damit sind zwei der drei offenen Fragen aus der Analyse bereits durch den gemergten Code
beantwortet:**

- **Zustell-Scope „pro Nutzer"** — umgesetzt: `sendPushToUser` filtert über `ownerScope(userId)`;
  es gibt **keinen** client-aufrufbaren „send an alle"-Endpunkt (bewusst, Sicherheit).
- **Architektur-Korrekturen** — umgesetzt: SQLite/Sequelize (kein PostgreSQL), Pfade `lib/` +
  `express/routes/`, `openapi.yml`-Contract, `web-push` als Dependency.

## 2. Was noch fehlt — der einzige offene Scope

`sendPushToUser(...)` ist **fertig, hat aber keinen Aufrufer**. Der Doc-Kommentar in
`server/src/logics/push.ts` hält das explizit fest:

> „Fachliche Trigger (fällige Aufgaben, „vernachlässigte Säule" #337) rufen später
> `sendPushToUser` auf; diese PR liefert die Opt-in-Infrastruktur **ohne automatischen Trigger**."

Der verbleibende Scope von #355 ist also **allein der fachliche Trigger**: _wann_ und _wodurch_
entsteht ein Push. Zwei fehlende Bausteine:

1. **Ein server-interner Scheduler** — im Repo existiert **kein** Cron/Scheduler
   (`grep` nach `cron|scheduler|setInterval` in `server/src` → leer). Pushes sind zeitbasiert und
   müssen auch feuern, wenn die App **nicht** geöffnet ist → ein server-seitiger Auslöser ist neu zu bauen.
2. **Mindestens eine fachliche Regel**, die pro Nutzer eine Payload erzeugt und `sendPushToUser` aufruft.

## 3. Empfohlener Trigger — Entscheidungsvorlage

Die Analyse nennt drei Kandidaten (fällige Aufgaben, „vernachlässigte Säule" #337, Zeitplan/manuell).
Bewertung gegen den realen Code:

| Kandidat | Datengrundlage im Code | Bewertung |
| --- | --- | --- |
| **Fällige Aufgaben** | `Task.deadline` (nullable `DATE`), `status ∈ {Open, In process, Done}`, `userId`-Isolation — alles vorhanden | ✅ **Empfohlen als MVP** — grün, rein aus Bestandsdaten ableitbar |
| „Vernachlässigte Säule" (#337) | **Kein** wiederverwendbarer `neglected`-Helfer mehr im Server. #337 ist zwar geschlossen, doch `pillarAttention.ts`/`calculatePillarAttention` existieren aktuell **nicht**; `pillarAdvisor.ts` ist inzwischen ein **LLM-basierter** Aktivitäten-Berater | 🟡 Folgeschritt — bräuchte erst wieder ein deterministisches Unterversorgungs-Signal |
| Rein manuell | — | 🔴 widerspricht dem PWA-Ziel (Erinnerungen ohne offene App) |

**Empfehlung:** Als ersten, prüfbaren Trigger die **fällige-Aufgaben-Erinnerung** umsetzen
(täglicher server-interner Lauf). Die „vernachlässigte Säule" bleibt ein sauber abgetrennter
Folgeschritt, sobald ein deterministisches Attention-Signal (Neuauflage von #337) wieder existiert.

> **Diese Trigger-Wahl ist die einzige noch offene Produkt-Entscheidung.** Der übrige Plan hängt
> nicht davon ab — Scheduler und Dedup-Log sind für jeden Trigger identisch.

### Verhalten des empfohlenen Triggers (fällige Aufgaben)

- **Auswahl:** je Nutzer alle Tasks mit `status != 'Done'` und `deadline` innerhalb der nächsten 24 h
  **oder** bereits überfällig (`deadline <= now + 24h`).
- **Bündelung:** **eine** zusammenfassende Nachricht pro Nutzer pro Lauf
  (`{ title: 'Fällige Aufgaben', body: 'Du hast N fällige/überfällige Aufgaben.', url: '/' }`) —
  nicht eine Notification je Task (Anti-Spam).
- **Deduplizierung:** ein Task löst **höchstens einmal pro fälligem Termin** eine Erinnerung aus
  (siehe Dedup-Log unten), damit der tägliche Lauf nicht denselben überfälligen Task wiederholt meldet.
- **Zustellung:** `sendPushToUser(userId, payload)` — pro Nutzer, mit vorhandener Selbstheilung.

## 4. Neue Architektur-Bausteine

### 4.1 Server-interner Scheduler (dependency-frei)

Passend zum minimalistischen Projekt-Stil (natives `process.loadEnvFile()` statt `dotenv`) **ohne**
neue Dependency: ein kleiner In-Process-Scheduler auf `setInterval`-Basis.

- Neue Datei `server/src/scheduler/index.ts`:
  - `startScheduler(): () => void` — startet einen `setInterval` (z. B. alle 15 min prüfen), ruft die
    Trigger-Logik, wenn das tägliche Zeitfenster erreicht ist; gibt eine `stop()`-Funktion zurück
    (`clearInterval`) für Tests/Shutdown.
  - Läuft **nur**, wenn `isPushConfigured()` **und** `PUSH_REMINDERS_ENABLED` gesetzt ist — sonst No-Op
    (kein stiller Nebenlauf ohne VAPID-Keys, kein Rauschen in Tests).
- Verdrahtung in `server/src/index.ts` `main()` **nach** `launchServer()` (ganz am Ende, analog zu den
  übrigen Startup-Schritten).
- Env-Neuzugänge (Muster wie VAPID): `PUSH_REMINDERS_ENABLED` (default aus),
  `PUSH_REMINDERS_HOUR` (Std. lokale Zeit, default z. B. 8). In `server/.env.example` dokumentieren
  und in `server/src/env-startup-log.ts` (unmaskiert, kein Secret) listen.

> Kein `node-cron`/`node-schedule` nötig. Falls später mehrere Cron-Ausdrücke gebraucht werden, kann
> die Dependency-Frage im Folgeschritt neu bewertet werden — für einen täglichen Lauf ist `setInterval`
> ausreichend und testbar.

### 4.2 Dedup-Log (verhindert Wiederholungen)

Kleines, generisches Modell `server/src/models/notificationLog.ts` (registriert in
`server/src/models/index.ts`), damit der tägliche Lauf idempotent bleibt und der Ansatz auf spätere
Trigger-Arten erweiterbar ist:

- Spalten: `userId` (INTEGER, nullable — Isolation wie bei `push_subscriptions`), `kind`
  (STRING, z. B. `'due-task'`), `dedupeKey` (STRING, z. B. `taskId:deadlineISO`), `sentAt` (DATE).
- Unique-Index auf `(kind, dedupeKey)` → dieselbe Erinnerung wird nie doppelt erzeugt; neue Tabelle ⇒
  `sequelize.sync()` legt sie an, **keine** Migration in `logics/migrate.ts` nötig.

## 5. Zerlegung in PRs (blocked-by-Kette)

Wie in der Analyse empfohlen: nicht ein Sammel-PR. Schnitt entlang der Bausteine, sequenziell verkettet:

1. **PR-A — Scheduler-Infrastruktur** (`server/src/scheduler/`, Env, Verdrahtung, No-Op-Gate) + Tests.
   Liefert das Gerüst ohne fachliche Regel. → 🟢
2. **PR-B — Dedup-Log + Trigger „fällige Aufgaben"** (Modell `notificationLog`, Logik
   `collectDueTaskReminders()`, Verdrahtung in den Scheduler) + Tests. Baut auf PR-A auf. → 🟢
3. **PR-C — (optional) Trigger „vernachlässigte Säule"** — erst nach Neuauflage eines deterministischen
   Attention-Signals (#337-Nachfolge). Nutzt denselben Scheduler + Dedup-Log. → 🟡 (blockiert durch
   Attention-Signal)

Für die native GitHub-Zerlegung: PR-B `blocked-by` PR-A, PR-C `blocked-by` PR-B — passend zum
sequenziellen Sub-Issue-Muster des Repos (`claude-issue-unblock.yml`).

## 6. Datei-genauer Umsetzungsplan

### PR-A — Scheduler-Infrastruktur

- **Neu** `server/src/scheduler/index.ts` — `startScheduler()`/`stop()`, Gate über `isPushConfigured()`
  + `PUSH_REMINDERS_ENABLED`, tägliches Zeitfenster über `PUSH_REMINDERS_HOUR`. Registrierung der
  Trigger-Callbacks als injizierbare Liste (Vorbild: injizierter `PushSender` in `logics/push.ts`),
  damit PR-B seinen Callback andockt und Tests ohne echten Timer laufen.
- **Neu** `server/src/scheduler/index.test.ts` — `node:test`: (a) No-Op ohne Konfiguration,
  (b) Callback wird im Zeitfenster genau einmal gerufen (Zeit/Interval injiziert, kein realer `setInterval`),
  (c) `stop()` beendet sauber.
- **Ändern** `server/src/index.ts` — `startScheduler()` am Ende von `main()` aufrufen.
- **Ändern** `server/.env.example` (Doku `PUSH_REMINDERS_ENABLED`, `PUSH_REMINDERS_HOUR`) und
  `server/src/env-startup-log.ts` (beide unmaskiert listen).

### PR-B — Dedup-Log + Trigger „fällige Aufgaben"

- **Neu** `server/src/models/notificationLog.ts` — Modell wie in 4.2.
- **Ändern** `server/src/models/index.ts` — `NotificationLog` importieren + re-exportieren (ohne Assoziation,
  Vorbild `PushSubscription`).
- **Neu** `server/src/logics/dueTaskReminders.ts` — `collectDueTaskReminders(now): Map<userId, Payload>`:
  Tasks mit `status != 'Done'` und `deadline <= now + 24h`, gruppiert nach `userId`, gegen `NotificationLog`
  gefiltert (nur noch nicht gemeldete `dedupeKey`s), Rückgabe je Nutzer eine gebündelte Payload; plus
  `runDueTaskReminders(send = sendPushToUser)` das versendet **und** die `NotificationLog`-Einträge schreibt.
- **Neu** `server/src/logics/dueTaskReminders.test.ts` — In-Memory-DB (`resetDb()`): fällig/nicht fällig,
  `Done` ausgeschlossen, Datenisolation (Nutzer A bekommt nur seine Tasks), Dedup (zweiter Lauf sendet nicht
  erneut), Bündelung (eine Payload für N Tasks). Der Versand wird als Mock injiziert.
- **Ändern** `server/src/scheduler/index.ts` — `runDueTaskReminders` als Trigger-Callback registrieren.

### PR-C — „vernachlässigte Säule" (optional, später)

- Setzt ein deterministisches Unterversorgungs-Signal voraus (Neuauflage von #337). Danach analog zu PR-B:
  `collectNeglectedPillarReminders()` + Callback-Registrierung + Tests. Kein neuer Scheduler/Dedup-Code nötig.

## 7. Akzeptanzkriterien & Testfälle

Testebene wie im Repo üblich (`node:test`, In-Memory-SQLite, Dateien neben dem Code):

- **AK-A1 (Scheduler-Gate):** _Given_ VAPID **nicht** konfiguriert **oder** `PUSH_REMINDERS_ENABLED`
  aus, _When_ `startScheduler()`, _Then_ kein Callback läuft (No-Op). → `scheduler/index.test.ts`.
- **AK-A2 (Scheduler feuert):** _Given_ konfiguriert + aktiviert, _When_ das tägliche Zeitfenster erreicht
  wird, _Then_ der registrierte Callback läuft **genau einmal** (kein Doppel-Feuern im selben Fenster).
- **AK-B1 (Auswahl):** _Given_ Nutzer mit Task `deadline = now + 2h`, `status = Open`, _When_
  `collectDueTaskReminders(now)`, _Then_ enthält seine Payload; ein Task mit `deadline = now + 3 Tage`
  oder `status = Done` ist **nicht** enthalten. → `dueTaskReminders.test.ts`.
- **AK-B2 (Datenisolation):** _Given_ Nutzer A und B mit je eigenem fälligen Task, _Then_ A's Payload
  enthält nie B's Task (Vorbild `pillars-dataisolation`).
- **AK-B3 (Bündelung):** _Given_ ein Nutzer mit 3 fälligen Tasks, _Then_ genau **eine** Payload
  (`body` nennt die Anzahl), nicht drei.
- **AK-B4 (Dedup/Idempotenz):** _Given_ ein überfälliger Task, _When_ `runDueTaskReminders` **zweimal**
  läuft, _Then_ wird **nur beim ersten Mal** gesendet (zweiter Lauf: `sent = 0`), da der `NotificationLog`
  den `dedupeKey` sperrt.
- **AK-B5 (Versand-Kontrakt):** _Given_ ein fälliger Task, _Then_ ruft `runDueTaskReminders`
  `sendPushToUser(userId, { title, body, url })` mit genau dem vom Service Worker erwarteten Payload-Shape auf.
- **AK-C (später):** analog für „vernachlässigte Säule", sobald das Attention-Signal existiert.

**Definition of Done je PR:** `pnpm format`, `pnpm --filter priority-pilot lint`,
`pnpm --filter priority-pilot test` grün; Ergebnisse in der PR-Beschreibung dokumentiert
(AGENTS.md, TDD-Strategie Stufe 2).

## 8. Risiken & offene Punkte

- **Produkt-Entscheidung (einzige echte Blockade):** Trigger-Wahl bestätigen — „fällige Aufgaben" als MVP
  (Empfehlung) vs. zusätzlich/stattdessen „vernachlässigte Säule". Letzteres verschiebt sich, bis ein
  deterministisches Attention-Signal wieder existiert.
- **Zeitzonen:** `PUSH_REMINDERS_HOUR` ist server-lokal. Für nutzerspezifische Zeitzonen wäre ein
  `timezone`-Feld nötig — bewusst **out of scope** des MVP (dokumentieren).
- **Skalierung:** In-Process-`setInterval` passt zum Single-Instance-Deployment (siehe `docs/deployment.md`).
  Bei künftigem Multi-Instance-Betrieb müsste der Lauf über einen Lock/Leader entkoppelt werden — heute
  nicht relevant, als Annahme festhalten.
- **Kein „send an alle"-Endpunkt:** bleibt bewusst weg (Sicherheit); der Versand ist ausschließlich
  server-intern durch den Trigger.
