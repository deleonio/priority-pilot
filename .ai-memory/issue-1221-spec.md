## Erledigt
- Spec `docs/spec/issue-1221.md` geschrieben (API-Vertrag PATCH /groups/{id}/members/{userId}, Frontend-Vertrag GroupDetail).
- Rote Backend-Tests AK1–AK6 in `server/src/express/groups-invitations.api.test.ts` (neue `describe('Rolle eines Gruppenmitglieds ändern (#1221)')`, ans Ende angehängt) — verifiziert rot (`NODE_ENV=test DATABASE_STORAGE=:memory: node --import tsx --test src/express/groups-invitations.api.test.ts`): AK1/2/3/4/6 rot (Route fehlt), AK5 grün (bereits durch bestehende `findMembership`-404-Logik gedeckt — kein Fehler, sondern Vorwegnahme).
- Rote Frontend-Tests AK7 in `frontend/src/components/GroupDetail.test.tsx` (neue `describe('GroupDetail — Rolle ändern (#1221 AK7)')`) — verifiziert: 3 von 4 Tests rot (Button existiert nicht), 4. Test ("Mitglied sieht keinen Button") ist grün, weil noch gar kein Rollen-Button existiert — bleibt als Regressionsschutz stehen.
- `api.updateGroupMemberRole` in den Test-Mocks (`vi.mock('../api', ...)`) ergänzt — im echten Client (`frontend/src/api.ts`) noch NICHT implementiert (Impl-Phase).
- AK8 (375px e2e) bewusst NICHT geschrieben — Zeitlimit des Laufs erreicht, siehe Nächster Schritt.

## Relevante Stellen
- `server/src/express/routes/groups.ts:437-474` — DELETE-Route mit der letzte-Admin-Prüfung (462-468); PATCH-Route muss dieselbe Prüffunktion nutzen (Extraktion ist Impl-Aufgabe).
- `server/src/express/groups-invitations.api.test.ts:283-` — neue AK1–AK6-Tests, nutzen dieselben Helper (`createGroup`, `invite`, `ownUserId`) wie der bestehende Block.
- `frontend/src/components/GroupDetail.tsx:110-118` — Mitgliederzeile; hier kommt der neue Rollen-Button rein (Label „<Name> zum Administrator machen" / „<Name> zur Mitgliedschaft zurückstufen").
- `frontend/src/api.ts:365` — `removeGroupMember` als Vorbild für die neue `updateGroupMemberRole`-Methode (PATCH-Client).
- `openapi.yml:1378` — `/groups/{id}/members/{userId}` (bisher nur DELETE); PATCH-Operation fehlt noch (Impl-Aufgabe, NICHT in diesem Spec-PR geändert — Scope-Regel).
- `frontend/e2e/groups.spec.ts:9-11,136-152` — AK8-Präzedenz: Bounding-Box statt scrollWidth (App-Shell clippt overflow-x:hidden).

## Annahmen
- Button-Label-Muster aus dem KI-UX-Block übernommen wörtlich: „<Name> zum Administrator machen" / „<Name> zur Mitgliedschaft zurückstufen".
- `api.updateGroupMemberRole({ id, userId, role })` als Methodensignatur angenommen (analog zu `removeGroupMember({ id, userId })` plus `role`) — Impl-Phase kann den Namen übernehmen oder anpassen, Test müsste dann mitziehen (kein production code hier geschrieben).
- AK5-Fall (Nicht-Mitglied → 404) ist bereits durch die bestehende Reihenfolge in `findMembership` abgedeckt (Route existiert aber noch nicht, daher zählt der Test trotzdem als Teil des Vertrags — er bleibt rot, bis die Route existiert, dann grün ohne Zusatzaufwand).

## Verworfen
- Kein eigener AK5-Sonderfall-Test nötig, da identisch mit dem bestehenden DELETE-404-Muster — trotzdem als eigener Testfall geschrieben (Vertragsklarheit pro AK), nicht dedupliziert, weil er eine neue Route betrifft.
- Kein `openapi.yml`-Edit — Spec-PR-Scope verbietet Konfig-/Contract-Änderungen außerhalb von `docs/spec/*.md` und Tests.

## Offen
- **AK8 (375px, keine horizontale Scroll) fehlt** — Zeitlimit erreicht, bevor der e2e-Test geschrieben werden konnte. Braucht: Navigation zur Gruppendetailansicht (in `groups.spec.ts` bisher nicht verlinkt — nur die Kartenliste unter `/settings/gruppen` wird getestet, kein Klick auf eine Karte zur Detailansicht), zweites Mitglied per Einladung+Accept, dann Bounding-Box-Assertion auf den neuen Button analog zu `groups.spec.ts:138-152`.

## Nächster Schritt
- **Sofort (falls Folgelauf vor Draft-PR abbricht):** AK8-e2e-Test in `frontend/e2e/groups.spec.ts` ergänzen, dann committen/pushen/PR wie unten.
- **Danach (Impl-Phase):** PATCH-Route in `groups.ts` bauen, `openapi.yml` + `frontend/src/api.ts` (`updateGroupMemberRole`) ergänzen, `GroupDetail.tsx` um den Rollen-Button erweitern, letzte-Admin-Prüfung aus DELETE in gemeinsame Funktion extrahieren.

## Fallstricke
- AK5-Test setzt voraus, dass die Route registriert ist, BEVOR die 404-Prüfung greift — Express matched sonst gar keine Route (kommt als generisches 404 vom Router, nicht vom eigenen `sendError`). Kein Problem für den Vertrag, aber der Body könnte in der Impl-Phase kein JSON `{message}` enthalten, falls die Route falsch registriert wird — daran denken, wenn der Test nach Impl nicht grün wird.
- Zwei `describe`-Blöcke in `groups-invitations.api.test.ts` starten je einen eigenen Testserver (`before`/`after`) — funktioniert, aber macht die Datei langsamer; für Folge-ACs eher an bestehende Blöcke andocken statt neue Server-Instanzen zu öffnen, falls Performance ein Thema wird.
- Frontend-Testdatei mockt `api.updateGroupMemberRole` nur im Modul-Mock — falls die Impl-Phase eine andere Methode/Namensgebung wählt, muss der Mock (und die 3 zugehörigen Tests) mitgezogen werden.
