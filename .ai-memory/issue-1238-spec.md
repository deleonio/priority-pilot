# Issue 1238 — Spec (Phase 3), Stand 2026-09-05

## Erledigt
- Harness-Branch `ai/harness/1238` fortgeführt (nur Triage-Commit 7a5b1346 vorhanden, kein Resume-State).
- Spec `docs/spec/issue-1238.md` neu angelegt (AK1–AK4, Extraktions-Vertrag `upsertOAuthUser`).
- Rote Tests: `server/src/logics/oauth-user.test.ts` (TF1: AK1+AK2 Bestandsnutzer Name/Avatar-Sync + Rückgabe==DB-Zeile; TF1b: `displayName ?? email`-Fallback-Konsistenz; TF3: AK4-Neuanlage) — rot via fehlendem Modul `server/src/logics/oauthUser.ts` (legitimer Erst-Rot-Zustand, verifiziert ERR_MODULE_NOT_FOUND).
- Regressionsschutz AK3: `server/src/express/profile-group-members.test.ts` (PUT /profile → sofort in GET /groups/:id/members) — heute grün (bestehendes Verhalten), im PR-Body unter dem Hinweis dokumentiert.
- Dedup geprüft: `profile.test.ts` (#1219) deckt PUT /profile → /auth/me + DB, NICHT die Mitgliederliste; `groups-*.test.ts` testen keine displayName-Sync-Thematik; OAuth-Sync selbst ist nirgends getestet (auth-avatar.test.ts läuft über `/auth/test-login`, NICHT über den GoogleStrategy-Pfad).

## Relevante Stellen
- `server/src/express/index.ts:164-184` — Verify-Callback: Z. 177-179 nur avatarUrl-Sync, Z. 180 Session aus Google-Variablen statt DB-Zeile. Impl: Logik nach `server/src/logics/oauthUser.ts` extrahieren, Strategie-Registrierung bleibt; `/auth/google/silent` nutzt denselben Pfad.
- `server/src/express/routes/groups.ts:236,251-257` — Mitgliederliste liest Namen live via `displayNameOf`/`User.findAll` → deshalb genügt der DB-Sync (AK1), `group_members` bleibt ohne Namens-Spalte.
- `server/src/express/routes/auth.ts:258-295` — `/auth/test-login` ist ein SEPARATER Pfad (findOrCreate ohne avatar-Sync-Logik) → OAuth-Sync nur über die extrahierte Funktion testbar.
- `server/src/test/helpers.ts:55-70,102` — `server.json` liefert rohe `Response` (`.json()` selbst aufrufen); `registerOn` für AK3-Test.

## Annahmen
- Funktionsname/Signatur `upsertOAuthUser({email, displayName, avatarUrl}) -> {id, email, displayName, avatarUrl}` frei wählbar seitens Impl — Tests fixieren den Vertrag; Umbenennung = Test-Import anpassen.
- Der Mock/direkte Aufruf der Funktion deckt AK2 inhaltlich ab; die echte `done()`-Verdrahtung in `index.ts` ist review-sichtbar, aber nicht automatisiert testbar (kein echter OAuth-Flow im Test-Setup).

## Verworfen
- Test über `/auth/test-login` — geht am Strategie-Pfad vorbei (separater findOrCreate), würde den Bug nicht fassen.
- HTTP-Test des echten GoogleStrategy-Callbacks — erfordert OAuth-Mocking von passport-google verifying; Aufwand unverhältnismäßig, Extraktions-Seam ist vom Analyse-Block vorgegeben.
- assertions zu "avatar wird auf null gesetzt wenn Profil kein Foto hat" — Randbedingung, nicht AK; Verhalten bleibt unverändert.

## Offen
- -

## Nächster Schritt
- Impl-Phase: `server/src/logics/oauthUser.ts` bauen (Tests grün), Verify-Callback in `index.ts` auf die Funktion umstellen (Z. 173-180 ersetzen), avatarUrl-Sync unverändert lassen.

## Fallstricke
- AK2 ist ZWEI Assertions: DB-Sync UND Rückgabe aus der DB-Zeile. Wer nur synced und weiter die Google-Variable returned, bleibt rot (genau der gemeldete Bug-Split).
- `displayName ?? email`-Fallback (index.ts:170) muss in Zeile und Rückgabe identisch gelten — TF1b fixiert das.
- `server.json()` liefert Response, nicht Body — Body-Asserts brauchen `await res.json()` (sonst tsc-Fehler/undefined).
- `npx tsc --noEmit` in `server/` scheitert stand-alone an fehlendem generiertem `../api`-Modul (OpenAPI-Client) — kein Fehler der Spec-Tests; über Repo-Testskript (mit Generate-Step) laufen lassen.
