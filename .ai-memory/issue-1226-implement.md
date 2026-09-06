# Issue 1226 — Implement (Phase 4), Stand 2026-09-06 (läuft)

## Erledigt
- Spec-Modus: Draft-PR **#1246** auf `ai/harness/1226` aufgegriffen; rote API-Tests sind GRÜN.
- NEU `server/src/models/groupInviteLink.ts` (token unique, expiresAt, revokedAt, createdByUserId); registriert in `server/src/models/index.ts:16,81`.
- NEU `server/src/express/routes/inviteLinks.ts` — öffentlicher Router: GET `/invite-links/:token` (Feldminimierung `{name, invitedByName}`, 404/410) + POST `/invite-links/:token/redeem` (Session-Selbstcheck 401, Mitglied in Transaktion, 409 auch bei anderweitiger Mitgliedschaft).
- `server/src/express/routes/groups.ts`: POST `/groups/:id/invite-links` (nur Admin, 201, `crypto.randomBytes(24)` hex = 48 Zeichen, TTL 7 Tage) + DELETE `/invite-links/:id` (Admin → 204 `revokedAt`; Mitglied 403, fremd/unbekannt 404).
- `server/src/express/index.ts:204` — `app.use(inviteLinksPublicRouter)` VOR `requireAuth` (:207).
- Testlauf: `NODE_ENV=test DATABASE_STORAGE=:memory: pnpm exec tsx --test src/express/groups-invite-links.api.test.ts` → 8 pass / 0 fail (im `server/`).

## Relevante Stellen
- `frontend/src/Root.tsx:145` (`/bahn`-Weiche) + `AuthenticatedApp` — `/gruppen/beitreten` muss NACH dem Auth-Check als eigene Weiche rendern (silent-Login-ReturnTo trägt path+query automatisch).
- `frontend/src/api.ts` (openapi-fetch `client`) — Join-Page braucht `GET /invite-links/{token}` + `POST /invite-links/{token}/redeem` ⇒ `openapi.yml` Pfade + Client-Typen regenerieren.
- `frontend/src/components/GroupDetail.tsx:182-209` — Admin-Bereich „Einladungen": Link erzeugen/kopieren/ungültig machen (Modal-Muster :212-236) — offen.
- `frontend/e2e/groups-invite-links.spec.ts` — AK5/AK6 erwarten Text „Gruppe beitreten"-Button, Erfolgstext /beigetreten/i, Gruppenname + Einladender sichtbar.

## Annahmen
- Token = 24 Random-Bytes hex (48 Zeichen ≥ 32 gefordert).
- Öffentlicher Router montet bare an `/` (baseUrl hat KEIN `/api`-Präfix in Tests, helpers.ts:131).
- Gruppe löschen cascade-verhält sich unkritisch (Link-Zeilen bleiben, GET liefert 410 via fehlender Gruppe).

## Verworfen
- -

## Offen
- Frontend FEHLT noch: GroupJoinPage, Root-Weiche, GroupDetail-Admin-UI, openapi.yml + Client-Typen → AK5/AK6 e2e noch rot.

## Nächster Schritt
- openapi.yml-Pfade ergänzen, Client-Typen generieren, `GroupJoinPage.tsx` + Root-Weiche, GroupDetail-Link-Verwaltung, dann voller Gate-Lauf + `gh pr ready 1246`.

## Fallstricke
- Server-Tests OHNE `NODE_ENV=test` → test-login-Route nicht registriert → alle 401 (sieht aus wie Auth-Bug, ist nur env).
- Checkout von main: untracked `.ai-memory/issue-1226-*.md` kollidieren → nach /tmp verschieben und zurück.
- redeem und GET im EINEN öffentlichen Router ok — redeem prüft Session selbst (resolveGeoUser → 401).
