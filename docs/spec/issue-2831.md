# #2831 — Master-Schalter `BACKGROUND_JOBS_ENABLED` für Staging und E2E gegen die MariaDB-Kopie

## Ziel

Ein Default-on-Schalter `BACKGROUND_JOBS_ENABLED` schaltet **alle** Hintergrund-Jobs ab
(Scheduler-Timer, ereignisgetriebener Push-Versand, Startup-Einmaläufe mit Schreibzugriff),
damit ein Staging-Start gegen die MariaDB-Kopie weder Timer registriert noch Push verschickt
oder die Kopie verändert. Nur der exakte Wert `=false` deaktiviert (konsistent mit
`AUTO_DELETE_AFTER_DEADLINE_ENABLED`); unset und `=true` bedeuten „an“.

## Voraussetzungen

- Gate-Helfer `isBackgroundJobsEnabled()` in neuem Modul `server/src/logics/backgroundJobs.ts`
  (liest `process.env.BACKGROUND_JOBS_ENABLED`, `!== 'false'`) — bewusst in `logics/`, damit
  `push.ts` und `scheduler/index.ts` ihn importieren können, ohne einen Zyklus zu erzeugen.
- Scheduler-Starter nehmen injizierbare `setIntervalFn`/`clearIntervalFn` (bestehendes Muster,
  `scheduler/index.ts`); `startIntervalScheduler` wird über `mock.timers` geprüft.

## Schritte & erwartetes Ergebnis

1. **AK1 (Scheduler-Starter):** Mit `BACKGROUND_JOBS_ENABLED=false` registriert keiner der drei
   Starter (`startScheduler`, `startDeadlineAutoDeleteScheduler`, `startIntervalScheduler`)
   einen Timer — auch `startScheduler` nicht mit voller Push-Konfiguration (VAPID +
   `PUSH_REMINDERS_ENABLED=true`). Ohne Schalter laufen alle drei wie bisher (default-on).
   Der Serverstart (`server/src/index.ts`) loggt bei Deaktivierung **genau eine** eindeutige
   Zeile („Hintergrund-Jobs deaktiviert (BACKGROUND_JOBS_ENABLED=false).“) statt je Starter
   eine — die Verdrahtung bleibt dünn (if-Guards, kein eigener Test: Startup-Code).
2. **AK2 (Push-Versand):** `sendPushToUser` kehrt mit `=false` **vor** jedem DB-Zugriff, jeder
   VAPID/FCM-Konfigurationsprüfung und jedem Netzwerkzugriff mit `{sent: 0, removed: 0}`
   zurück — Subscriptions bleiben unangetastet. Über den gemeinsamen Nenner sind damit auch
   alle ereignisgetriebenen Aufrufer abgedeckt (Task erledigt, Meilenstein, Serien-Generierung,
   Test-Push aus der UI, FCM).
3. **AK3 (Startup-Einmaläufe):** Der Gate-Helfer steuert außerdem die Schreibzugriffe beim
   Start: `cleanupOrphanedGroupInvitations` (index.ts:346) und der `runSeriesAutoCreate`-
   Direktaufruf (index.ts:389) laufen mit `=false` nicht (if-Guard um beide Stellen).
4. **AK4 (Bestand):** Ohne Schalter identisches Verhalten — gesamte bestehende Suite grün,
   kein neues Gate greift (default-on-Semantik; gesichert durch die „ohne Schalter“-Tests).
5. **AK5 (E2E gegen MariaDB, kein Test — ADR 0001):** Konfigurationsarbeit der Impl-Phase:
   neuer Job in `.github/workflows/ci-mariadb.yml` (mariadb:11-Service + Playwright, Trigger
   `push:main` + `workflow_dispatch`), `frontend/playwright.config.ts` reicht `DB_DIALECT`/`MARIADB_*`
   per Env durch (statt fest `DATABASE_STORAGE: ':memory:'`), Staging-Kommando gegen die Kopie
   (Kopie neu erzeugen, dann ohne `DB_RESET`) in `docs/deployment.md`. Beleg = grün gelaufener
   Job bzw. das dokumentierte Kommando.

## Testfälle

- **TF1 (AK1):** `server/src/scheduler/index.test.ts` — je Starter der No-Op-Nachweis bei
  `=false` (injizierte Timer-Fns bzw. `mock.timers` für `startIntervalScheduler`) plus
  default-on-Guard für `startIntervalScheduler` (die Starter-Gates der anderen beiden sind
  bereits über die Bestands-Tests #355/#523 gesichert).
- **TF2 (AK2):** `server/src/logics/push.test.ts` — `=false` + Seed-Subscription +
  Erfolgs-Sender-Mock → `{sent: 0, removed: 0}`, Mock nie angerufen, Subscription bleibt.
- **TF3 (AK3/Gate-Semantik):** neu `server/src/logics/backgroundJobs.test.ts` — Helper:
  unset/`=true` → an, `=false` → aus.
- **TF4 (AK4):** kein eigener Test — kanonisches Gate (`pnpm test` unverändert grün).
- **TF5 (AK5):** kein Test — Workflow/Config-Doku (ADR 0001); siehe AK5.
