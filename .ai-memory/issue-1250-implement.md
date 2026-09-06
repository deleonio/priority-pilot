# Issue 1250 — Implement (Grün), Stand 2026-09-06

## Erledigt
- Beide Read-Scopes an die aktuelle Gruppenmitgliedschaft gebunden (nur diese 2 Dateien geändert, +53/−15):
  - `server/src/express/routes/tasks.ts` — neuer Export `loadSharedUserIds(requesterId)` (2 GroupMember-Queries nach POST-Muster tasks.ts:477-485, dedupliziert via Set); `taskReadScope` jetzt `async`: `{ userId } OR { createdById: requesterId, userId: { [Op.in]: sharedUserIds } }`. Aufrufstelle GET /tasks mit `await`.
  - `server/src/express/routes/series.ts` — `seriesReadScope` identisch async umgebaut; importiert `loadSharedUserIds` aus `./tasks.js` (Präzedenz: `serializeTask`/`loadUserNames` Import dort); Aufrufstelle GET /series mit `await`.
- Rot→Grün verifiziert: `tasks-created-by.test.ts` 12/12 pass (vorher 3 fail), `series-created-by.test.ts` 9/9 pass (vorher 2 fail; 12→9 weil Spec-Notiz suite-zählte anders — Datei hat 2 Suiten, alle grün, 0 fail).
- Gate komplett grün vor Push: `pnpm format` ✓, `prettier --check .` ✓, `pnpm lint` ✓ (server+frontend), `pnpm knip` exit 0 (nur Config-Hints = bekannter Zustand), server-Suite 882 pass/0 fail/1 skip (Redis-session-skip mit return, MEMORY 2026-08-25), Root-`pnpm test` exit 0 (274 pass).
- e2e gesprungen: server-only, kein UI-Verhalten, keine openapi.yml-Änderung (api.d.ts unverändert) — im PR-Body dokumentiert.

## Relevante Stellen
- `server/src/express/routes/tasks.ts:160-198` — `loadSharedUserIds` + neuer `taskReadScope` (async).
- `server/src/express/routes/tasks.ts:~415` — GET /tasks Aufruf mit `await taskReadScope(...)`.
- `server/src/express/routes/series.ts:148-171` — `seriesReadScope` (async), Import Zeile 11.
- `server/src/express/routes/series.ts:~395` — GET /series Aufruf mit `await`.

## Annahmen
- Leere `sharedUserIds` → Sequelize `[Op.in]: []` = `IN (NULL)` = nichts sichtbar — durch AK2-Test (Gruppenlöschung, requester in 0 Gruppen) grün bestätigt.
- Requesters eigene ID in `sharedUserIds` ist harmlos (eigene Tasks laufen über `{ userId }`-Zweig) — bewusst kein `Op.ne`-Filter, entspricht POST-Muster.
- GET /tasks/:id + GET /series/:id (owner-only) unverändert — AK7 bleibt Status quo.

## Verworfen
- Eigene Hilfsdatei/logics-Modul für `loadSharedUserIds` — Export aus tasks.ts folgt bestehendem Import-Muster von series.ts, weniger Dateien.
- Änderungen an `groups.ts` (Exit-Wege), Schreib-Scopes, `/tasks/nearby` — Abfragezeit-Bindung deckt laut Analyse alle Szenarien ab.

## Offen
- -

## Nächster Schritt
- Push + `gh pr ready 1261` + PR-Body erweitern (Impl-Zusammenfassung, Gate-Resultate); danach Kreuzverhör-Phase.

## Fallstricke
- Pass-Through (`userId === undefined` → `{}`) und `requesterId === null` (`{ userId }`) unverändert — Dev/E2E hängt daran; Änderungen dort brechen #1213/#1222-Tests.
- `taskReadScope`/`seriesReadScope` haben je GENAU eine Aufrufstelle (grep verifiziert) — weitere Nutzungen müssten `await` lernen.
- `createdById` wird NICHT genullt (AK3) — nur Sichtbarkeit der Listen.
