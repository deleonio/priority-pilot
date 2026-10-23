# Spec #2515 — Aufgabenwald (`/forest`) mit Gruppen-Lese-Scope

## Ziel

Der Aufgaben-Tab (und die daraus gespeisten Dashboard-Bereiche, `frontend/src/lib/forest.ts`
→ „Wichtigste Tasks") zeigt dem Ersteller dieselben Aufgaben wie die Aufgabenliste — inklusive
„Für: …"-Kennzeichen. Heute filtert der Root-Fetch in `buildTaskForest`
(`server/src/logics/tree.ts:135`) nur auf `{ userId }`; der Lese-Scope der Aufgabenliste
(`taskReadScope`, `server/src/express/routes/tasks.ts:312`) kennt zusätzlich als Ersteller
abgegebene Aufgaben und unclaimte Gruppen-Aufgaben eigener Gruppen. Genau dieser Unterschied
wird geschlossen.

## Voraussetzungen

- Nutzer A (Ersteller), Nutzer B (Empfänger), gemeinsame Gruppe; Nutzer C ohne gemeinsame Gruppe.
- Der `/forest`-Endpunkt (`server/src/express/index.ts:469`) löst den Requester auf wie
  `serializeTasksFor`/`resolveGeoUser` und ruft `buildTaskForest` mit dem Lese-Scope.
- `taskReadScope` ist aus `routes/tasks.ts` exportiert (oder in ein geteiltes Modul gehoben) —
  Implementierungsentscheid, vertraglich ist nur das Verhalten unten.

## Schritte und erwartetes Ergebnis

### AK1 — Unclaimte Gruppen-Aufgabe

- **Schritt:** A legt eine Aufgabe für seine Gruppe an (unclaimed: `groupId` gesetzt, `userId` null)
  und ruft `GET /forest` als A auf; der Aufgaben-Tab rendert den Wald.
- **Erwartet:** Die Aufgabe ist als Knoten enthalten; der Aufgaben-Tab zeigt sie mit dem
  „Für: <Gruppenname>"-Badge (`group-task-badge`).

### AK2 — Übergebene Aufgabe

- **Schritt:** A übergibt eine Aufgabe an B (gemeinsame Gruppe: `userId` = B, `createdById` = A)
  und ruft `GET /forest` als A auf.
- **Erwartet:** Die Aufgabe ist als Knoten enthalten; der Aufgaben-Tab zeigt sie mit
  „Für: <Name B>". Schreib-Aktionen bleiben für A ausgeblendet (Bestand, #1213/#1213-AK5-Muster).

### AK3 — Gruppenaustritt entzieht die Sicht

- **Schritt:** A verlässt die Gruppe und ruft `GET /forest` erneut auf.
- **Erwartet:** Die übergebene Aufgabe und jede unclaimte Gruppen-Aufgabe der Gruppe sind
  verschwunden — gleiche aktive-Mitgliedschafts-Basis wie die Liste (#1250).

### AK4 — Ohne gemeinsame Gruppe unsichtbar

- **Schritt:** C (keine gemeinsame Gruppe) ruft `GET /forest` und `GET /tasks` auf.
- **Erwartet:** Die Aufgabe erscheint in keinem der beiden Ergebnisse. Der `/tasks`-Halbteil ist
  durch `tasks-created-by.test.ts` (Drittkonto-Assertionen) bereits abgedeckt — neu ist der
  `/forest`-Halbteil.

### AK5 — E2E-Specs mit eigener Session

- **Schritt:** Die Specs `groups-foreign-task.spec.ts`, `issue-1252-handover.spec.ts` und
  `issue-1521-gruppen-aufgabe.spec.ts` laufen ohne `test.use({ ownSession: false })` — also mit
  echter Session je Test statt Pass-Through-Bestand.
- **Erwartet:** Alle drei bleiben grün; die bestehende 375-px-Badge-Prüfung
  (groups-foreign-task AK8) bleibt grün. Die Spez-Tests des Spec-PRs entfernen dazu die drei
  `ownSession: false`-Zeilen — sie sind damit rot, bis der Lese-Scope umgesetzt ist.

## Abgrenzung (unverändert)

- `GET /graph` (`buildTaskGraph`) und `findNextImportantTask` bleiben eigentümer-gefiltert.
- DTO `TaskTreeNode` unverändert — Provenance-Kennzeichen kommen wie heute über die
  `/tasks`-Anreicherung; kein OpenAPI/Client-Regenerate.
- Ohne Session (Pass-Through) bleibt alles sichtbar (`requesterId === null`-Zweig).
- Schreib-Scope `findOwnTask` bleibt Eigentümer-only (PATCH/DELETE fremder Tasks → 404).
- Serien-Repräsentanten-Auswahl (`selectSeriesRepresentatives`) darf fremde Instanzen nicht
  wegfiltern — Aufgabe mit `seriesId` bleibt als Repräsentant sichtbar (MitTEST in TF1).

## Testfälle

- **TF1** (`server/src/express/forest-read-scope.test.ts`, Muster `tasks-created-by.test.ts`):
  A/B + gemeinsame Gruppe; Übergabe-Aufgabe in `GET /forest` des Erstellers (AK2), nach
  Gruppenaustritt nicht mehr (AK3), C ohne Gruppe sieht sie nicht (AK4); Aufgabe mit `seriesId`
  bleibt als Repräsentant sichtbar.
- **TF2** (gleiche Datei): unclaimte Gruppen-Aufgabe in `GET /forest` des anlegenden Mitglieds
  sichtbar (AK1).
- **TF3** (E2E): die drei genannten Specs mit eigener Session — Aufgaben-Tab zeigt Gruppen-/
  übergebene Aufgabe mit Badge (AK1/AK2/AK5).
