## Erledigt
- Draft-PR #1236 auf `ai/harness/1221` übernommen (Spec-Mode, rote Tests aus Spec-Phase vorhanden, siehe `issue-1221-spec.md`).
- `openapi.yml:1392-1434` — `patch` auf `/groups/{id}/members/{userId}` ergänzt (`operationId: updateGroupMemberRole`, Request `GroupMemberRoleUpdate`, Responses 200/400/403/404/409); Schema `GroupMemberRoleUpdate` neben `GroupMember` (~Zeile 1745).
- `server/src/express/routes/groups.ts` — gemeinsame Prüffunktion `isLastRemainingAdmin(groupId, target)` + Konstante `LAST_ADMIN_MESSAGE` extrahiert (ersetzt die inline Prüfung in der DELETE-Route), neue PATCH-Route (401→404→403→400→404-Ziel→409→200), nutzt dieselbe Prüffunktion wie DELETE.
- `frontend/src/api.ts` — `api.updateGroupMemberRole({ id, userId, role })` ergänzt (Vorbild `removeGroupMember`), nutzt `client.PATCH('/groups/{id}/members/{userId}', …)`.
- `frontend/src/components/GroupDetail.tsx` — `handleRoleChange` (Fehlerpfad wie `handleRemove`, 409 landet im bestehenden `KolAlert`) + neuer `KolButton _variant="secondary"` je Mitgliedszeile mit Ziel-Label ("<Name> zum Administrator machen" / "<Name> zur Mitgliedschaft zurückstufen"), nur wenn `ownRole === 'admin'`.
- `pnpm --filter client generate` gelaufen (schema.d.ts ist gitignored, lokal generiert — kein Commit nötig).
- Backend: alle 15 Tests in `server/src/express/groups-invitations.api.test.ts` grün (`cd server && NODE_ENV=test DATABASE_STORAGE=:memory: node --import tsx --test src/express/groups-invitations.api.test.ts`) — **WICHTIG: nur grün, wenn cwd=`server/` ist**, von Repo-Root aus schlägt Login/Setup fehl (401 statt 201/200 bei `createGroup`/`test-login`) — ungeklärte Pfad-/Config-Abhängigkeit, kein Regressions-Bug, s. Fallstricke.
- Frontend Unit: `frontend/src/components/GroupDetail.test.tsx` 10/10 grün (`npx vitest run src/components/GroupDetail.test.tsx` im `frontend`-Verzeichnis).
- AK8 (fehlte aus der Spec-Phase) nachgezogen: neuer e2e-Test in `frontend/e2e/groups.spec.ts` ("Mitgliederzeile mit Rollen-Button bleibt bei 375px ohne horizontalen Überlauf (#1221 AK8)") — Bounding-Box-Assertion auf `.group-members`-Zeile, Muster aus der bestehenden AK8/AK12-Tests kopiert. Grün (`npx playwright test e2e/groups.spec.ts`, 7/7).
- **Test-Pflege (dokumentationspflichtig im PR-Body):** `frontend/e2e/groups-invitations.spec.ts:101,113` — `getByText('Ines Eingeladen')` auf `{ exact: true }` umgestellt: der neue Rollen-Button trägt den Namen ebenfalls im Label ("Ines Eingeladen zum Administrator machen") → Strict-Mode-Kollision, keine Verhaltensänderung des Tests, nur Locator-Präzisierung wegen der neuen UI. Beleg: vor dem Fix beide betroffenen Assertions rot mit "resolved to 2 elements", nach dem Fix grün. Voller Lauf `npx playwright test e2e/groups-invitations.spec.ts` 3/3 grün.
- `npx playwright test e2e/groups-foreign-task.spec.ts` gegengeprüft (2/2 grün, keine Kollision — pending Invitees haben noch keinen Rollen-Button, nur Mitglieder).

## Relevante Stellen
- `server/src/express/routes/groups.ts` — `isLastRemainingAdmin` + `LAST_ADMIN_MESSAGE` (neu, vor der PATCH-Route), PATCH-Route, DELETE-Route nutzt jetzt dieselbe Funktion.
- `openapi.yml:1392-1434,~1745-1751` — PATCH-Operation + `GroupMemberRoleUpdate`-Schema.
- `frontend/src/api.ts` — `updateGroupMemberRole` (nach `removeGroupMember`).
- `frontend/src/components/GroupDetail.tsx` — `handleRoleChange`, Rollen-Button in der Mitgliederzeile.
- `frontend/e2e/groups.spec.ts` — neuer AK8-Test ans Ende der `describe`-Datei angehängt.
- `frontend/e2e/groups-invitations.spec.ts:101,113` — Test-Pflege (exact:true).

## Annahmen
- `updateGroupMemberRole`-Signatur `{ id, userId, role }` wie im Spec-Mock vorgesehen — übernommen unverändert.
- Rollen-Button-Variante `secondary` (nicht `primary`/`danger`) — UX-Block empfahl keinen bestimmten Variant-Wert, „Button statt generischem Switch" war die einzige bindende Vorgabe.

## Verworfen
- Kein eigener Bestätigungsdialog für den Rollenwechsel — UX-Block (#1221) hat das explizit verworfen (reversibel, kein Datenverlust).
- Keine Änderung an `docs/spec/issue-1221.md` — Vertrag stimmte mit der Umsetzung überein, kein Anpassungsbedarf.

## Offen
- Gate-Runner-Agent läuft im Hintergrund (format/prettier/lint/knip/test) — Ergebnis noch ausstehend beim Schreiben dieser Notiz.

## Nächster Schritt
- Gate-Ergebnis abwarten; bei Grün: committen (inkl. dieser Notiz), pushen, PR #1236 aus Draft nehmen (`gh pr ready 1236`) + Beschreibung um Implementierungs-Zusammenfassung, Test-Pflege-Abschnitt und Testergebnisse ergänzen.

## Fallstricke
- Backend-API-Tests (`groups-invitations.api.test.ts`) laufen nur grün mit cwd=`server/` — von Repo-Root aus liefert `createGroup`/Setup 401 statt 201 (login "erfolgreich", aber Folge-Request unauthentifiziert). Betrifft ALLE Tests der Datei, nicht nur die neuen — kein von dieser Änderung verursachter Regressions-Bug, sondern ein Lauf-Artefakt/Pfadproblem des Testrunners. Für Gate-Läufe daher `cd server && pnpm test` (bzw. das Root-`pnpm -r test`, das ohnehin je Workspace ausführt) nutzen, nicht `node --test` von der Repo-Wurzel aus.
- Neue Buttons je Mitgliedszeile heißen "<Name> zum Administrator machen"/"<Name> zur Mitgliedschaft zurückstufen" — jeder e2e-Test, der bisher lose auf den Mitgliedsnamen matcht (`getByText(name)` ohne `exact:true`), kollidiert jetzt im Strict-Mode. Zwei Stellen bereits gefixt (s. o.); falls weitere e2e-Dateien Mitgliedsnamen referenzieren, dieselbe Falle prüfen.
