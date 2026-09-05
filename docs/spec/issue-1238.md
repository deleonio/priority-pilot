# Spec #1238 — Gruppenmitgliederliste zeigt veralteten Profilnamen

## Ziel

Der bei Google (OAuth) geänderte Profilname erreicht die Datenbank nie: Der Verify-Callback in
`server/src/express/index.ts:164-184` übernimmt beim Bestandsnutzer nur `avatarUrl` (Z. 177-179),
nie `displayName`, und füttert die Session (Z. 180) mit der Google-Profil-Variable statt mit der
DB-Zeile. Folge: `GET /groups/:id/members` (DB-Live-Lese über `User`, `routes/groups.ts:251-257`)
zeigt unbegrenzt den alten Namen, während `/auth/me` nach dem stillen Re-Login den neuen zeigt.

## Verhalten (Soll)

Die Verify-Logik wird in eine testbare Funktion extrahiert
(`server/src/logics/oauthUser.ts`, Aufrufort bleibt die GoogleStrategy-Registrierung in
`index.ts`; der silent-Login nutzt denselben Pfad):

```
upsertOAuthUser({ email, displayName, avatarUrl }) -> { id, email, displayName, avatarUrl }
```

- **AK1** — Bestandsnutzer + geänderter Google-Profilname: `users.displayName` wird in der
  DB-Zeile aktualisiert (gleiches Muster wie der bestehende avatarUrl-Sync `index.ts:177-179`).
- **AK2** — Der Rückgabewert (Basis für den Session-Nutzer in `done()`) ist identisch mit der
  DB-Zeile: `/auth/me` und `GET /groups/:id/members` zeigen denselben Namen; keine Aufspaltung
  Google-Variable vs. DB mehr.
- **AK3** — Regressionsschutz: Namensänderung über `PUT /profile` wirkt unverändert sofort auf
  `GET /groups/:id/members` (Mitgliederliste liest live aus `users`).
- **AK4** — Guard: unbekannte E-Mail → Nutzer wird mit dem Google-Profilnamen (und Avatar)
  angelegt; Rückgabewert = DB-Zeile.

## Vorbedingung

E-Mail ist erlaubt (`isEmailAllowed` — bleibt im Callback vor dem Upsert); `group_members`
bleibt ohne Namens-Spalte; `PUT /profile` (#1219), Passwort-Login und Session-Regenerate sind
unangetastet; Avatar-Sync läuft unverändert weiter.

## Schritte (AK3-Vertrag)

1. Nutzer registriert sich und legt eine Gruppe an (er ist damit Mitglied).
2. Derselbe Nutzer ändert seinen Namen über `PUT /profile` (DB + Session werden gezogen).
3. `GET /groups/:id/members` wird abgerufen.

## Erwartetes Ergebnis

- Nach Schritt 2/3 liefert die Mitgliederliste für die eigene `userId` den neuen Namen —
  ohne erneuten Login.
- Nach (stillem) Google-Login gilt dasselbe für einen in Google geänderten Namen: DB-Zeile,
  Session (`/auth/me`) und Mitgliederliste tragen denselben aktuellen Namen.
