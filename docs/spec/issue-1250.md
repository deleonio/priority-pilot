# #1250 — Lesezugriff des Erstellers endet mit der Gruppenmitgliedschaft

## Ziel

Der `createdById`-Zweig der Lese-Scopes (`taskReadScope` in `server/src/express/routes/tasks.ts`,
`seriesReadScope` in `server/src/express/routes/series.ts`) zeigt fremde Aufgaben/Serien dem
Ersteller nur, solange Ersteller und Eigentümer **aktuell** mindestens eine Gruppe teilen.
Austritt (selbst oder Admin-Entfernung), Gruppenlöschung und Wiedereintritt wirken sofort auf
die Listen (`GET /tasks`, `GET /series`).

## Voraussetzungen

- Alice (Erstellerin, Gruppen-Admin) und Bob (Eigentümer, Gruppen-Mitglied) teilen eine Gruppe;
  Alice hat für Bob eine Aufgabe/Serie angelegt (`POST` mit `userId`, #1213/#1222).
- Mitgliedschaftsquelle ist `group_members` zum Abfragezeitpunkt (kein Snapshot).

## Schritte & erwartetes Ergebnis

1. **AK1 (Mitgliedschaft bindet):** `GET /tasks` von Alice enthält die Aufgabe, solange die
   Mitgliedschaft besteht. Nach Alices Austritt (self-leave oder Admin-Entfernung über
   `DELETE /groups/:id/members/:userId`) fehlt sie; nach Wiedereintritt ist sie wieder da.
2. **AK2 (Gruppenlöschung):** Nach `DELETE /groups/:id` (Admin) fehlt die Aufgabe in Alices Liste.
3. **AK3 (Eigentümer unberührt):** `GET /tasks` von Bob enthält die Aufgabe in allen Fällen mit
   `createdById`/`createdByName` der Erstellerin (kein Nullen des Erstellers).
4. **AK4 (mind. eine verbleibende Gruppe):** Teilen A und B zwei Gruppen und A verlässt eine,
   bleibt die Aufgabe sichtbar.
5. **AK5 (Serien):** AK1–AK4 gelten entsprechend für `GET /series`.
6. **AK6 (Bestand):** Aufgaben/Serien ohne `createdById` (NULL) laufen weiter allein über den
   `userId`-Zweig — nur der Eigentümer sieht sie, unabhängig von Gruppen.
7. **AK7 (Schreib-/Detail-Scope unverändert):** `GET /tasks/:id`, `GET /series/:id` bleiben
   owner-only (404 für die Erstellerin), PATCH/DELETE bleiben `ownerScope`, `/tasks/nearby`
   bleibt Eigentümer-only.

## Testfälle

Rot als Erweiterung der #1213/#1222-Spec-Tests (`server/src/express/tasks-created-by.test.ts`,
`server/src/express/series-created-by.test.ts`), Rollen und Seeding analog. Wiedereintritt wird
am Modell geseedet (Mitgliedschaft ist Eingabe, nicht SUT); Leave/Löschung über die echte API.
