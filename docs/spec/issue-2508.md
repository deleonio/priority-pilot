# Issue 2508 — E2E-Specs unabhängig von Daten anderer Specs im selben Shard machen

## Ziel

Jede E2E-Spec unter `frontend/e2e/`, die per API Daten anlegt oder ändert, arbeitet mit Daten, die
nur ihr gehören. Das Ergebnis einer Spec hängt nicht davon ab, welche Specs vorher im selben Shard
liefen; eine geänderte Shard-Zuteilung (CI: `--shard=N/8`) macht keine fremde Spec rot.

## Ursache (verifiziert)

Die zentrale Fixture `frontend/e2e/fixtures.ts` mockt nur `GET /auth/me` (fixer
`AUTHENTICATED_USER`, `id: 1`) und erzeugt **keine** Server-Session. Alle API-Schreibzugriffe
laufen damit in den Pass-Through-Modus von `ownerScope(undefined)`
(`server/src/logics/ownerScope.ts`) — alle Specs eines Shards teilen sich denselben Datenbestand
der Shard-DB.

## Lösungsweg (zentral, wie im Issue angeregt)

1. Fixture registriert je Test eine eigene Session (Mechanik `registerOwnSession`,
   `frontend/e2e/helpers.ts:325`) und mockt `/auth/me` mit den Daten dieser Session — reale
   id/email, `plan`/`entitlements` weiterhin aus `AUTHENTICATED_USER` (Pro-Pfad #1525/#1335
   bleibt erhalten).
2. Plan-Mirror `pp-plan-<id>` mit der echten User-ID säen (statt fix `pp-plan-1`).
3. Fixture-Option `ownSession: false` als dokumentierter Fluchtweg für Specs mit bewusster
   Pass-Through-Abhängigkeit. Direkt-Import-Specs (`login.spec.ts`, `userinfo.spec.ts`,
   `issue-1982-warteliste.spec.ts`) bleiben unberührt; spec-eigene `page.route('**/auth/me')`
   gewinnen weiterhin (Registrierungsreihenfolge, Header `fixtures.ts`).
4. Präferenz-Seeds auf `seedAccountPreferences` (`frontend/e2e/helpers.ts:336`,
   session-gesichert) umstellen — mit Session überschreibt der Kontostands-Abgleich reine
   localStorage-Seeds. Betroffen u. a. `issue-1574-saeulen-confirm`, `keyboard-shortcuts`,
   `issue-763`, `issue-1555-saeulen-hinweis`.

## Voraussetzungen

- E2E-Umgebung wie in `frontend/playwright.config.ts`: echtes Backend, frische In-Memory-DB,
  workers=1, `fullyParallel: false` (Tests innerhalb einer Spec laufen in Deklarationsreihenfolge).
- `POST /auth/register` existiert nur unter `NODE_ENV=test`
  (`server/src/express/routes/auth.ts:56`).

## Schritte (Isolations-Probe, AK1)

1. Test A legt einen Task mit unverwechselbarem Titel an (`POST /api/v1/tasks`) — Simulierung
   einer fremden Shard-Nachbar-Spec, die vorher im selben Shard lief.
2. Test B legt über die zentrale Fixture einen eigenen Task an und liest `GET /api/v1/tasks`.

## Erwartetes Ergebnis

- Test B sieht in der Taskliste seine eigenen Daten — den Task aus Test A nicht (AK1).
- Die Probe ist **rot vor dem Fixture-Umbau** (beide Tests laufen in denselben
  Pass-Through-Bestand) und **grün danach** (Session je Test).
- AK2–AK4 sind Lauf-Nachweise der Impl-Phase (betroffene Specs grün; Shard-Läufe N=1–8 und
  invertierte Reihenfolge grün; lokaler Komplettlauf `pnpm --filter frontend test:e2e` grün),
  belegt per Kommando-Ausgabe in der PR-Beschreibung. Dazu Audit-Liste der verbleibenden
  Schreib-Specs ohne Session (Soll: nur dokumentierte `ownSession: false`-Ausnahmen).
