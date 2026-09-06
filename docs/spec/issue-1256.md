# #1256 — Eigener Anzeigename übersteht den Google-Login

## Ziel

Der über `PUT /profile` selbst gesetzte Anzeigename (`users.displayName`, #1219) bleibt
dauerhaft erhalten — auch wenn jeder Google-Login (inkl. stiller Re-Login über dieselbe
GoogleStrategy-Verify) ein abweichendes Google-Profil liefert. Nutzer **ohne** eigenen Namen
folgen weiterhin dem aktuellen Google-Profilnamen; der Avatar-Sync (`avatarUrl`, #1238)
bleibt von der Schutzlogik unberührt.

Mechanismus: neue Spalte `users.displayNameCustom` (`BOOLEAN NOT NULL DEFAULT 0`).
`PUT /profile` setzt sie zusammen mit dem Namen auf `1`; `upsertOAuthUser`
(`server/src/logics/oauthUser.ts`) überschreibt `displayName` bei Bestandsnutzern nur noch,
wenn die Spalte `0` ist. Neuanlagen über OAuth starten mit Google-Name (E-Mail-Fallback)
und Flag `0`.

## Voraussetzungen

- `upsertOAuthUser` liefert die DB-Zeile zurück (Basis für Session/`/auth/me` und
  `GET /groups/:id/members` über `displayNameOf`, `routes/groups.ts`) — unverändert.
- `POST /auth/register` setzt `displayName = email` — die Flag wird NUR von `PUT /profile`
  gesetzt (registrierte Nutzer gelten bis zur ersten eigenen Namensspeicherung als
  „ohne eigenen Namen“).
- E-Mail-Fallback (`displayName ?? email`) bleibt für Neuanlagen identisch.

## Schritte & erwartetes Ergebnis

1. **AK1 (Schutz greift):** Nutzer hat per `PUT /profile` einen eigenen Namen gespeichert
   (Flag `1`); erneuter `upsertOAuthUser` mit abweichendem Google-Namen lässt
   `users.displayName` unverändert. Rückgabewert bleibt die DB-Zeile (Session-Basis).
2. **AK2 (Live-Lese konsistent):** `GET /groups/:id/members` (Live-Lese aus `users`) zeigt
   nach diesem Login weiterhin den eigenen Namen.
3. **AK3 (Sync ohne eigenen Namen):** Bestandsnutzer mit Flag `0` bekommt bei geändertem
   Google-Namen weiterhin den aktuellen Namen nachgezogen; Neuanlage über OAuth startet
   mit Google-Name (E-Mail-Fallback bei `null`) und Flag `0`.
4. **AK4 (Avatar unberührt):** Ein geändertes Google-Profilbild wird bei jedem Login
   übernommen — auch bei Flag `1`.
5. **AK5 (Migration idempotent):** Bestehende `users`-Tabelle ohne `displayNameCustom`
   erhält die Spalte per `ALTER TABLE … ADD COLUMN … NOT NULL DEFAULT 0` vor
   `sequelize.sync()` (Muster `migrateUsersAvatarUrl`, verdrahtet im Migrations-Array in
   `server/src/index.ts`); frische DB (keine Tabelle) und erneuter Lauf sind No-ops.

## Bekanntes Migrationsverhalten

Konten, die vor diesem Fix einen eigenen Namen gespeichert haben, migrieren mit Flag `0`
— beim ersten Login nach Deploy wird ihr Name ein letztes Mal vom Google-Profil
überschrieben, danach greift der Schutz; Betroffene speichern einmal neu.

## Testfälle

- TF1 (AK1, node:test): `server/src/logics/oauth-user.test.ts` — Flag `1` + abweichender
  Google-Name: `displayName` unverändert, Rückgabe == DB-Zeile.
- TF2 (AK3, ebenda): Flag `0` + geänderter Google-Name: Name wird nachgezogen (Umstellung
  des bisherigen #1238-AK1-Tests auf die Flag-Logik); Neuanlage: Google-Name + Flag `0`.
- TF3 (AK4, ebenda): Flag `1` + geänderter `avatarUrl`: Bild wird übernommen.
- TF4 (AK2, API-Test): `server/src/express/profile-group-members.test.ts` — nach
  `PUT /profile` und `upsertOAuthUser` zeigt `GET /groups/:id/members` den eigenen Namen.
- TF5 (AK1, API-Test): `server/src/express/profile.test.ts` — `PUT /profile` setzt
  `displayNameCustom = 1` (DB-Assert).
- TF6 (AK5, node:test): `server/src/logics/migrate.test.ts` — Spalte fehlt → `ADD COLUMN`
  mit Default `0`; Spalte vorhanden → No-op (idempotent); keine Tabelle → No-op.
