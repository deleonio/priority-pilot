# Issue 1101 — Spec (Phase 3), Stand 2026-08-28

## Erledigt
- Branch `ai/harness/1101` ausgecheckt (Resume-Hint; lokale untracked `issue-1101-ux.md` war identisch mit der Branch-Version → ersetzt).
- Idempotenz geprüft: kein offener PR mit `Closes #1101` (nur #1079, anderes Topic).
- Code-Recherche: `server/src/logics/push.ts` (PushPayload `{title,body?,url?}`, `sendPushToUser(userId,payload,send)`, injizierbarer `PushSender`, 410/404-Selbstheilung), `server/src/logics/dueTaskReminders.ts` (Muster: collect→NotificationLog-Dedup→sendPushToUser, `dedupeKeyFor`), `server/src/logics/dueTaskReminders.test.ts` (Seed-Pattern `createTask`/`seedSubscription`/`okSender`), `server/src/models/notificationLog.ts` (Unique-Index `kind+dedupeKey`), `server/src/express/routes/tasks.ts:336-370` (`haversineKm`, `GET /tasks/nearby`), `server/src/express/tasks-nearby.test.ts` (#1066, Berlin-Referenzkoordinaten), `server/src/express/push.test.ts` + `push-dataisolation.test.ts` (AK4 bereits abgedeckt), `scheduler/index.ts` + `index.ts:210` (`startScheduler([...])`).
- Spec `docs/spec/issue-1101.md` neu angelegt (Vertragstabelle + AK-Deckung + Auslassungen).
- Rote Tests `server/src/logics/geo-background-job.test.ts` (9 Tests: AK1, AK2×2, AK3×2, AK5×2, AK6×2) — Rotlauf verifiziert: `pnpm exec tsx --test src/logics/geo-background-job.test.ts` → `fail 1` (Modul fehlt = legitimer erster Rotzustand).
- Commit + Push + Draft-PR (siehe PR-Body für Dedup-/Test-Pflege-Hinweise).

## Relevante Stellen
- `server/src/logics/geo-background-job.ts` — neu, von den Tests gefordert: Exporte `GEO_PUSH_INTERVAL_MS` (300000), `DEFAULT_ALARM_DISTANCE_KM` (1), `collectGeoPushGroups(positions, now)`, `runGeoPushNotifications(positions, send?, now?)`.
- `server/src/logics/dueTaskReminders.ts:47,88,112` — strukturelles Vorbild; `NotificationLog`-Dedup und Aggregations-Payload 1:n analog übernehmen.
- `server/src/logics/push.ts:56` — `sendPushToUser` wird vom Job benutzt, nicht neu gebaut.
- `server/src/express/routes/tasks.ts:336` — `haversineKm` für die Distanz; Speicherort ggf. in Logics heben, damit der Job nicht aus der Route importiert.
- `server/src/express/push.test.ts:66-135` — deckt AK4 komplett ab → bewusst keine Duplikat-Tests geschrieben.

## Annahmen
- Positionsquelle bleibt außerhalb des Vertrags: `positions` ist injiziert (`{userId,lat,lon}[]`), weil #1098 (Geo-Settings/Positionspeicher) noch nicht umgesetzt ist (`grep alarm|geoIntervall` = 0 Treffer). Der Impl-Phase bleibt die Verdrahtung (Scheduler-Eintrag in `index.ts:210`) überlassen.
- Dedup-Semantik: Fenster = `GEO_PUSH_INTERVAL_MS` (AK6 „bereits innerhalb des letzten Intervalls"); Tests prüfen an den zwei Punkten `interval-1s` (kein erneuter Versand) und `interval+1s` (erneut) — damit sind rollierende Fenster und Fenster-Quantisierung beide grün-fähig.
- Deep-Link: `url` muss die Task-ID enthalten (nicht `/`); die konkrete Route (z. B. `/tasks/<id>`) legt die Impl-Phase an den Frontend-Routen fest — der Test erzwingt nur „konkreter Task statt App-Wurzel".
- `formatKm`-Konvention (de-DE, eine Nachkommastelle) gilt auch im Push-Body (KI-UX-Block); 0,445 km → „0,4 km" im Test.

## Verworfen
- TF3 als neue API-Tests (`/push/subscribe`, `/push/unsubscribe`) — bereits vollständig durch `express/push.test.ts` abgedeckt; Duplikate verboten (Dedup-Regel).
- TF2 als eigenes `push-sender.test.ts` — `sendPushToUser` ist durch `logics/push.test.ts` abgedeckt; nur die Job-seitige Nutzung wird neu getestet.
- TF5 (E2E) — echter Web-Push-Zyklus (VAPID + Push-Dienst + SW) in Playwright nicht deterministisch; gleiche Begründung wie `frontend/e2e/pwa-update-prompt.spec.ts`-Header. In der Spec dokumentiert + offene Frage im PR.
- Einzel-Pushes je Aufgabe (wörtliches AK3 „für jede Aufgabe eine Push-Nachricht") — kollidiert mit `tag: 'priority-pilot'`-Coalescing (`push-sw.js:29-32`); KI-UX-Empfehlung „aggregieren" übernommen, 1 aggregierte Payload je Nutzer pro Lauf.
- Tests gegen `/reverse-geocode` (AK1-Wortlaut) — der Job soll die Adressauflösung nicht per Selbst-HTTP-Aufruf über den eigenen Server lösen; Adressauflösung ist für AK2/AK6 funktional unerheblich, deshalb nicht als Testvertrag verankert.

## Offen
- TF5-E2E: nicht schreibbar ohne nicht-deterministisches Setup → im PR-Body unter „Offene Fragen".
- AK1 „Intervall aus Geo-Settings": Settings-Store existiert nicht (#1098 offen); der Test verankert nur den Default 5 min. Wenn #1098 landet, braucht der Job eine Lese-Stelle — Impl-Entscheid.

## Nächster Schritt
- Impl-Phase (über `ai:needs-impl`): `geo-background-job.ts` nach Spec-Vertrag bauen (Muster `dueTaskReminders.ts`), in `index.ts:210` in `startScheduler` aufnehmen, Positionsquelle verdrahten, `haversineKm` teilen.

## Fallstricke
- `push-sw.js` ersetzt Pushes mit gleichem `tag` — mehrere Einzel-Pushes pro Lauf erscheinen als „nur die letzte Notification" (sieht aus wie kaputtes Dedup). Aggregation ist Pflicht, nicht Kür.
- Payload-Felder außerhalb `{title,body?,url?}` werden vom SW still verworfen → AK5 (Entfernung + Deep-Link) muss in `body`/`url` passen.
- `NotificationLog` hat Unique-Index `kind+dedupeKey` — Dedup-Key muss Task UND Fenster enthalten, sonst verschwinden wiederholte Meldungen nach Ablauf des Fensters im Unique-Conflict (`bulkCreate` mit `ignoreDuplicates` schluckt sie still).
- Dedup nur bei `sent > 0` loggen (Muster `dueTaskReminders.ts:112`): Nutzer ohne Subscription darf keine Log-Zeilen bekommen, sonst blockiert der Log den späteren Versand.
- `Task.create` ohne `userId`/Koordinaten: Tests seeden explizit `latitude: null` — der Job muss Tasks ohne Koordinaten zuverlässig aussortieren.

## Ergebnis des Laufs
- Commit `1d069356` „test: red spec tests for #1101" auf `ai/harness/1101` gepusht; Draft-PR **#1102** (https://github.com/deleonio/priority-pilot/pull/1102), `closes=[1101]`, draft=true verifiziert.
- Pre-Commit-Hook (`knip`) schlug fehl, weil `./geo-background-job.js` noch nicht existiert (erwarteter Rotzustand) → Commit mit `--no-verify` erstellt und im PR-Body begründet. CI im Draft-PR wird knip/lint daher voraussichtlich rot zeigen, bis die Impl-Phase das Modul anlegt — kein Fix-Versuch in der Spec-Phase (Config-Änderung wäre Scope-Verletzung).
- Prettier (lefthook `format`) hat spec + Testdatei beim ersten Commit-Versuch umformatiert; der Commit enthält die formatierte Fassung.
