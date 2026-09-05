# Issue 1238 — Implement (Phase 4), Stand 2026-09-05

## Erledigt
- Spec-Modus: Branch `ai/harness/1238` (Draft-PR #1241) uebernommen, rote Tests gelaufen.
- `server/src/logics/oauthUser.ts` NEU: `upsertOAuthUser({email, displayName, avatarUrl}) -> {id, email, displayName, avatarUrl}` — findOrCreate (`passwordHash: '__oauth__'`), Bestandsnutzer-Sync von displayName UND avatarUrl (nur bei Abweichung), Rueckgabe aus der DB-Instanz.
- `server/src/express/index.ts` Verify-Callback (~Z.168-181) auf `upsertOAuthUser` umgestellt; `done()`-Payload-Form beibehalten, `isEmailAllowed`-Gate unangetastet. Import `User` entfernt (seither ungenutzt), Import `upsertOAuthUser` ergaenzt.
- Gate komplett gruen: `pnpm format` ok, `prettier --check .` 0, `pnpm lint` 0, `pnpm knip` 0, `pnpm test` — server 849 tests / 0 fail, frontend 274 / 0 fail.
- Tests: `server/src/logics/oauth-user.test.ts` 3/3 gruen (AK1/AK2-Fallback/AK4), `server/src/express/profile-group-members.test.ts` gruen (AK3-Regression).
- Kein `--no-verify` noetig: knip faehrt nach dem Commit des Moduls sauber durch (Spec-Fallstrick betraf nur den Rot-Zustand).

## Relevante Stellen
- `server/src/logics/oauthUser.ts` — extrahierte Logik; Rueckgabe = DB-Zeile (AK2-Kern).
- `server/src/express/index.ts:170-181` — Strategie-Verify nutzt jetzt die Funktion; `/auth/google/silent` zieht denselben Pfad.
- `server/src/logics/oauth-user.test.ts` — Spec-Vertrag (unveraendert, Trennung der Zuständigkeiten gewahrt).
- `server/src/express/profile-group-members.test.ts` — AK3Regression, heute gruen (bestehendes Live-Lese-Verhalten).

## Annahmen
- `user.update()` aktualisiert die Instanz inline → Rueckgabe nach Sync korrekt (Sequelize-Standard).
- done()-Verdrahtung bleibt review-sichtbar ohne eigenen Automattest (Spec-Notiz, kein echter OAuth-Flow im Test-Setup).

## Verworfen
- Test-Aenderungen — Spec-Tests sind Vertrag; nichts angepasst.
- Frontend-Aenderungen — GroupDetail liest live, kein Cache (Triage), nichts zu tun.

## Offen
- -

## Naechster Schritt
- PR #1241 review-ready (`gh pr ready`) + Body um Implementierungszusammenfassung/Gate-Ergebnisse erweitern; danach Kreuzverhoer-Runden.

## Fallstricke
- `User`-Import in `index.ts` nach der Extraktion ungenutzt → lint/knip faellt sonst rot; mit entfernt.
- Gate-Aufrufe im `server/`-Unterverzeichnis laufen (kein vitest, sondern `node --import tsx --test` mit NODE_ENV=test, DATABASE_STORAGE=:memory:).
