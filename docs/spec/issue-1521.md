# #1521 — Aufgabe an eine ganze Gruppe zuweisen — Erlediger bekommt die Gutschrift

## Ziel

Eine Aufgabe kann statt an eine Einzelperson an eine ganze Gruppe adressiert werden
(`Task.groupId`). Sie erscheint dann bei allen Mitgliedern als offene Aufgabe; wer sie zuerst
erledigt, „claimt" sie (`Task.userId` wird auf den Erlediger gesetzt), verschwindet danach für
die übrigen Mitglieder, und Punkte + Säulen-Anteile stehen ausschließlich beim Erlediger.

## Voraussetzungen

- Alice, Bob und Anna sind Mitglieder derselben Gruppe G; Carol teilt keine Gruppe mit ihnen.
- Alle drei besitzen dieselben fünf Säulen-Namen (`SEED_PILLARS`, seit #1573 fix und pro Nutzer
  gleich benannt) — Voraussetzung für die Säulen-Umverrechnung (AK5).
- Bestandsverhalten für Aufgaben ohne `groupId` (Einzel-Empfänger/-Eigentümer, #1213/#1252) bleibt
  unverändert (AK9, Regressionsschutz).

## Schritte & erwartetes Ergebnis

1. **AK1 (Empfänger-Auswahl):** Im Aufgabenformular stehen neben Personen auch die Gruppen des
   Nutzers als Option (Präfix „Gruppe: "). Beim Speichern wird die Aufgabe mit `groupId` der
   gewählten Gruppe und **ohne** Einzel-Empfänger angelegt (`buildRecipientOptions` liefert dafür
   unterscheidbare Options-Values, z. B. `group:<id>`, neben den bestehenden Personen-Values).
2. **AK2 (Sichtbarkeit):** `POST /tasks` mit `groupId = G` legt eine Aufgabe an, die `GET /tasks`
   jedem Mitglied von G liefert (auch ohne Ersteller-/Eigentümerrolle) — einem Nicht-Mitglied
   dagegen nicht.
3. **AK3 (Claim durch ein beliebiges Mitglied):** Jedes Mitglied kann die Gruppen-Aufgabe per
   `PATCH /tasks/:id` auf `Done` setzen. Danach liefert `GET /tasks` sie den übrigen Mitgliedern
   nicht mehr als offene Aufgabe.
4. **AK4 (Score-Idempotenz):** Nach dem Erledigen existiert genau ein `ScoreEntry` zur Aufgabe,
   und die Punkte zählen für das erledigende Mitglied. Ein zweiter `PATCH … Done` — auch durch ein
   anderes Mitglied — erzeugt keinen zweiten Eintrag und verschiebt die Gutschrift nicht.
5. **AK5 (Säulen-Umverrechnung):** Die Säulen-Anteile der Aufgabe werden beim Erledigen auf die
   gleichnamigen Säulen des erledigenden Mitglieds umgehängt; die Säulen-Zuordnung der übrigen
   Mitglieder bleibt unverändert.
6. **AK6/AK7 (UI):** Das Gruppendetail listet offene Gruppen-Aufgaben, erledigte verschwinden dort;
   Dashboard/Aufgabenliste kennzeichnen eine Gruppen-Aufgabe mit dem Gruppennamen im „Für:"-Kennzeichen
   statt einem Personennamen.
7. **AK8 (375px):** Gruppen-Option in der Empfänger-Auswahl und die Gruppen-Kennzeichnung sind bei
   375px Viewport vollständig sichtbar (Bounding-Box `x + width <= viewportWidth`, keine `scrollWidth`-
   Prüfung — die App-Shell clippt mit `overflow-x: hidden`).
8. **AK9 (Regression):** Aufgaben ohne `groupId` verhalten sich unverändert (Sichtbarkeit, Score,
   Säulen-Verrechnung wie vor diesem Ticket).

## UI-Vertrag (neu, für die e2e-Tests)

Da AK6/AK7 einen bisher nicht existierenden Anzeige-Fall betreffen, legt dieser Vertrag zwei
stabile Anker fest, gegen die die e2e-Tests greifen (Implementierungsdetail bleibt Phase 4
überlassen, nur die Testbarkeit ist hier fixiert):

- Gruppendetail: die offenen Gruppen-Aufgaben stehen in einem Container `data-testid="group-open-tasks"`,
  je Eintrag mit dem Task-Titel als Text.
- Aufgabenliste/Dashboard: eine Gruppen-Aufgabe trägt zusätzlich zum bestehenden Zeilen-Markup ein
  Element `data-testid="group-task-badge"` mit dem Text `Für: <Gruppenname>`.

## Testfälle

- AK1 → `frontend/src/lib/recipientOptions.test.ts` (Erweiterung): `buildRecipientOptions` mit
  einem neuen `groups`-Parameter liefert zusätzliche Gruppen-Optionen mit Präfix und `group:<id>`-Value,
  Personen-Optionen bleiben unverändert.
- AK2–AK5, AK9 → neuer Server-Test `server/src/express/issue-1521-group-task.api.test.ts`
  (eigene Datei statt Erweiterung von `groups-tasks.api.test.ts`/`score.test.ts`/`pillars.test.ts` —
  begründet im PR-Body unter „Test-Pflege-Bedarf": eigenständiger End-to-End-Vertrag mit eigenem
  Seeding, geringeres Kollisionsrisiko mit den bestehenden #1223/#1252-Suiten in denselben Dateien).
- AK6–AK8 → neue e2e-Spec `frontend/e2e/issue-1521-gruppen-aufgabe.spec.ts`.

Rot, bis `Task.groupId` existiert und die zugehörige Scope-/Claim-/Umverrechnungslogik implementiert
ist (aktuell: `groupId` wird von `POST /tasks` und dem Task-Modell ignoriert). Kein Produktivcode in
diesem Schritt.
