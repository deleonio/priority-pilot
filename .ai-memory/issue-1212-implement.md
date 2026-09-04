# Issue 1212 — Implementierung (Phase 4), Stand 2026-09-04

**ERGEBNIS: VERDICT needs-review.** Spec-Modus: Draft-PR #1215 (Branch `ai/harness/1212`)
aufgegriffen, rote Spec-Tests unverändert grün gemacht, Gate lokal komplett grün, PR aus dem
Draft geholt.

## Erledigt

- `server/src/models/groupInvitation.ts` (neu): eigener Autoincrement-PK, kein Unique auf
  `(groupId, invitedUserId)` — Re-Invite nach `declined` bleibt möglich; Registrierung in
  `server/src/models/index.ts:15,79`.
- `server/src/express/routes/users.ts` (neu): `GET /users/search` — volle E-Mail (Exact-Match)
  oder `displayName`-Fragment ab 3 Zeichen (`Op.like`), DTO nur `{id, displayName}`; kurze
  Anfragen/Nulltreffer → 200 `[]`. Registriert in `server/src/express/index.ts:236`.
- `server/src/express/routes/groups.ts` (angehängt ab dem #1211-Block): `GET /groups/:id/members`,
  `GET|POST /groups/:id/invitations`, `GET /invitations`, `POST /invitations/:id/accept|decline`,
  `DELETE /groups/:id/members/:userId` inkl. Letzter-Admin-Guard (409) und 403/404-Trennung.
- `openapi.yml`: 7 neue Pfade + Schemas `UserSearchHit`, `GroupMember`, `GroupInvitation`,
  `GroupInvitationInput`, `ReceivedInvitation`, `InvitationResult`; `client/src/schema.d.ts` per
  `pnpm --filter client generate` regeneriert (nicht handgeschrieben), Typ-Aliase in
  `client/src/index.ts:30-35`.
- Frontend: `frontend/src/components/GroupDetail.tsx` (neu, AK11), 8 API-Methoden in
  `frontend/src/api.ts` (ab Z. 320), Integration in `GroupsSection.tsx` (Karte klickbar →
  Detail aufklappen; Abschnitt „Einladungen" mit Annehmen/Ablehnen).
- Gate lokal grün: `pnpm format`, `pnpm exec prettier --check .` (0), `pnpm lint` (0),
  `pnpm knip` (0), `pnpm --filter server test` (EXIT=0), `pnpm --filter frontend test`
  (52 Dateien / 527 Tests grün).

## Relevante Stellen

- `server/src/express/routes/groups.ts` — `findMembership` (Z. 55) trägt auch alle neuen
  :id-Routen; die neuen Handler hängen darunter.
- `server/src/express/routes/users.ts:37` — `isFullEmail`-Weiche entscheidet Exact-Match vs.
  Namensfragment.
- `frontend/src/components/GroupDetail.tsx:56` — Suche erst ab 3 Zeichen bzw. bei `@`.

## Annahmen

- `resolveGeoUser` (geoConfig.ts) ist auch für die neuen Routen die richtige Nutzer-Auflösung
  (Muster aus #1211 übernommen).
- SQLite-`LIKE` ist für ASCII case-insensitive → Namensfragment-Suche trifft unabhängig von
  Groß-/Kleinschreibung (Tests bestätigen das).

## Verworfen

- Handgeschriebene Typen für die neuen Endpunkte im Frontend — Vertragstypen kommen aus
  `openapi.yml` über `pnpm --filter client generate` (Regel: generierte Dateien nie editieren).
- Eigener Router für `/invitations` — die Routen hängen ohne Pfad-Präfix am `groupsRouter`,
  gehören fachlich zum selben Vertrag.

## Offen

- `pnpm --filter frontend test:e2e` NICHT gelaufen (Zeitbudget; braucht laufendes Backend).
  `frontend/e2e/groups-invitations.spec.ts` (Spec-Phase) ist damit unverifiziert — im PR-Body
  vermerkt.
- Kein Playwright-MCP-Check bei 375/1280px an der laufenden Instanz (Zeitbudget).

## Nächster Schritt

- Review-Phase: Kreuzverhör des PR #1215; danach ggf. Fixup — zuerst den e2e-Lauf nachholen.

## Fallstricke

- AK4-Vertrag: 403 für Nicht-Admin-Mitglied, 404 für Nicht-Mitglied — bewusst anders als das
  #1211-Muster (dort einheitlich 404); nicht „vereinheitlichen".
- `GET /groups/:id/invitations` liefert nur `pending`; accept/decline setzen `status`, sie
  löschen die Zeile nicht (Vertrag: „taucht nicht mehr in GET /invitations auf").
- Letzter-Admin-Guard prüft `count(role='admin') <= 1` VOR dem Löschen; greift auch beim
  Selbst-Austritt eines Alleinadmins.
