# Spec #1219 — Anzeigenamen selbst festlegen

Quelle: Issue #1219 (AK1–AK7) + Analyse-Block (Harness-Kommentar, stand 2026-09-05T02:15:42Z).
Kein KI-UX-Block (ux=nein). Rot-Tests: `server/src/express/profile.test.ts` (AK1–AK5),
`frontend/src/components/SettingsPage.test.tsx` (AK6), `frontend/e2e/profile-display-name.spec.ts` (AK7).

## Ziel

Der Nutzer kann seinen Anzeigenamen in **Einstellungen → Allgemein** selbst ändern. Der Name
gilt serverseitig (Tabelle `users.displayName`, Spalte existiert bereits — keine Migration),
wird in der Session nachgezogen und erscheint sofort in der Kopfzeile neben dem Avatar.
Wer nichts ändert, behält den bisherigen Namen.

## Server: neuer `profileRouter` (Vorbild `routes/geoConfig.ts`)

`server/src/express/routes/profile.ts`, gemountet in `express/index.ts` neben `geoConfigRouter`
(der Router liegt hinter dem globalen `requireAuth`; ohne Auth-Kontext gilt der Dev-Pass-Through
über denselben Auflöse-Pfad wie `resolveGeoUser` — die 401-AK gilt bei aktivem Auth-Kontext).

- **GET /profile** (AK1) → 200 mit `{ displayName, email, avatarUrl }` des angemeldeten Nutzers
  (`avatarUrl` wie im User-Datensatz, `null` erlaubt).
- **PUT /profile** (AK2) mit `{"displayName":"Anna"}` → 200; danach liefert `GET /auth/me`
  „Anna". Pflicht: `req.session.user.displayName` mitschreiben — `/auth/me` antwortet aus der
  Session (`auth.ts:234`), nicht aus der DB.
- **Validierung** (AK3): `displayName` nach `trim()`; leer (auch nur Whitespace) oder länger
  als 60 Zeichen → 400 mit **deutscher** Meldung, die das Wort „Anzeigename" enthält. Nichts
  wird persistiert. Grenzfall 60 Zeichen → 200.
- **Feldschutz** (AK4): PUT liest ausschließlich `displayName` aus dem Body (Destructuring wie
  `validateGeoConfig`); `email`, `passwordHash` und unbekannte Felder werden ignoriert —
  DB-Zeile bleibt in diesen Spalten unverändert.
- **Auth** (AK5): GET und PUT ohne Session → 401 (bei aktivem Auth-Kontext).

## Frontend

- `api.ts` erhält `getProfile()`/`updateProfile()` als Wrapper (Muster `getGeoConfig`/
  `updateGeoConfig`, `api.ts:713-722`); DTO aus `openapi.yml` → `client`-Paket.
- SettingsPage, Tab „Allgemein" (Index 0): `KolInputText _label="Anzeigename"` mit dem
  aktuellen Wert vorbelegt (aus `getProfile`), Speichern über `KolButton _label="Anzeigename
speichern"` → `updateProfile({ displayName })` und danach `onSaved()` — über die bestehende
  onSaved-Kette lädt Root den User neu (`checkAuth`), sodass die Kopfzeile (`App.tsx:664`,
  `KolAvatar _label={user.displayName}`) den neuen Namen zeigt (AK6).

## E2E (AK7)

Bei 375 px Viewport ist das Feld ohne horizontales Scrollen bedienbar
(`scrollWidth <= window.innerWidth`), und nach dem Speichern zeigt die Kopfzeile den neuen
Namen (`frontend/e2e/profile-display-name.spec.ts`, echtes Backend im Dev-Pass-Through).

## Rot-Begründung

`/profile` existiert heute nicht (404/SPA-Fallback) — AK1–AK5 sind rot, bis der Router
existiert. AK6 rot: kein Feld „Anzeigename" in SettingsPage. AK7 rot: kein Feld, kein
Speichern-Button, kein Namens-Update in der Kopfzeile.
