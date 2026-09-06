# Issue 1250 — Spec (rote Tests), Stand 2026-09-06

## Erledigt
- Spec `docs/spec/issue-1250.md` erstellt (AK1–AK7 als Ziel/Voraussetzung/Schritte-Ergebnis-Vertrag).
- Rote Tests als Erweiterung (neue describe-Blöcke, #1213/#1222-Blöcke unangetastet):
  - `server/src/express/tasks-created-by.test.ts` — 6 Tests: AK1 self-leave+Rejoin, AK1 Admin-Entfernung, AK2 Gruppenlöschung, AK3 Eigentümer-Sicht, AK4 zwei Gruppen, AK6 Bestand; AK1-Test deckelt zusätzlich AK7 (GET /tasks/:id → 404 für Erstellerin).
  - `server/src/express/series-created-by.test.ts` — 4 Tests: AK5 Mitgliedschaftszyklus (mit AK7-Deckel GET /series/:id 404 + AK3-Analogon), AK5 Admin-Entfernung+Gruppenlöschung kombiniert, AK4-Analogon, AK6 Bestandsserie.
- Rot-Verifikation (scoped, `node --import tsx --test` je Datei, NODE_ENV=test, :memory:):
  - tasks: 12 tests, 9 pass, **3 fail** — AK1×2 + AK2, alle an der Assertion „nach Austritt/Entfernung/Löschung nicht mehr sichtbar" (erwartetes Rot: `createdById`-Zweig ist aktuell bedingungslos).
  - series: 12 tests, 10 pass, **2 fail** — AK5-Zyklus + AK5 Entfernung/Löschung, gleiche Assertionsignatur.
- AK3/AK4/AK6-Tests laufen bewusst grün (Regressionguards des unveränderten Verhaltens; Mutation: Zweig komplett entfernen → AK4-Tests werden rot, haben Biss).

## Relevante Stellen
- `server/src/express/routes/tasks.ts:167-172` — `taskReadScope`: `{ [Op.or]: [{ userId }, { createdById: requesterId }] }` — HIER gehört die Gruppenbindung rein (Impl).
- `server/src/express/routes/series.ts:158-160` — `seriesReadScope`, identisches Muster.
- `server/src/express/routes/tasks.ts:477-485` — POST-Empfängerprüfung (GroupMember-Abfrage) als Implementierungsmuster.
- `server/src/express/routes/groups.ts:524-560` — DELETE /groups/:id/members/:userId (self-leave + Admin-Entfernung; letzten-Admin-Schutz 409).
- `server/src/express/routes/groups.ts:214` — DELETE /groups/:id (Admin, 204).
- Test-Infra: `seedGroupWithTwoAdmins` in beiden Testdateien — Alice UND Bob als Admin, sonst self-leave Alices am letzten-Admin-Schutz (409) scheitert.

## Annahmen
- Wiedereintritt am Modell geseedet (GroupMember.create) statt Einladungs-API — Mitgliedschaft ist Test-Eingabe, nicht SUT; Analyse-TF1 verlangt nur „Rejoin → wieder drin".
- AK7 nur probenhaltend gepinnt (GET :id 404 der Erstellerin in je einem Test); PATCH/DELETE 404 + /tasks/nearby sind durch #1213-Tests (`tasks-created-by.test.ts` AK5-Test) bzw. ownerScope bereits abgedeckt (Dedup).

## Verworfen
- Eigene neue Testdatei — Analyse sagt explizit „Erweiterung" der beiden bestehenden #1213/#1222-Dateien (Infrastruktur vorhanden).
- Rejoin über Einladungs-API — 3 zusätzliche Requests für einen Zustand, der am Modell exakt deterministisch gesetzt werden kann.

## Offen
- -

## Nächster Schritt
- Impl-Phase: Gruppenbindung in beide Read-Scopes (Op.in-Unterabfrage oder vorgeladene Member-IDs nach POST-Muster), dann sind alle 5 roten Tests grün.

## Fallstricke
- Zweig darf NICHT `createdById` nullen (AK3) — nur Sichtbarkeit der Liste binden.
- Pass-Through (`userId === undefined` → `{}`) und `requesterId === null` (`{ userId }`) unverändert lassen.
- Schreib-Scope (`findOwnTask`, Series-PATCH/DELETE) und `/tasks/nearby` nicht anfassen (AK7).
- AK6: NULL-`createdById` darf niemals über den neuen Gruppenpfad sichtbar werden — nur über `userId`-Zweig.
