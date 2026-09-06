# Spec #1252 — Aufgabe/Serie an ein Gruppenmitglied übergeben (Bearbeiten-Formular)

## Ziel

Der Eigentümer einer Aufgabe oder Serie kann sie im Bearbeiten-Formular an ein Gruppenmitglied
übergeben (`PATCH /tasks/:id` bzw. `PATCH /series/:id` mit optionalem `userId`). Die Aufgabe
erscheint danach in der Liste des Empfängers; der bisherige Eigentümer sieht sie mit
„Für:"-Kennzeichen und kann sie nicht mehr ändern.

## Voraussetzungen

- Übergebender und Empfänger teilen mindestens eine Gruppe (`GroupMember`), sonst 403 — gleiche
  Prüfung wie `POST /tasks` (#1213).
- Schreib-Scope bleibt `ownerScope` (`findOwnTask`/`findSeriesWithPillars`): nur der Eigentümer
  kann übergeben; Ersteller ohne Eigentum erhalten 404 (bereits durch #1213/#1222-Tests gesichert).
- Ohne Feld `userId` (oder mit der eigenen ID) ändert sich am bisherigen PATCH-Ablauf nichts.

## Ablauf / erwartetes Verhalten

### Task-Übergabe (`PATCH /tasks/:id`)

- **AK1** Der PATCH-Body akzeptiert ein optionales `userId`. Ohne das Feld bleibt der Eigentümer
  unverändert — auch wenn gleichzeitig andere Felder geändert werden.
- **AK2** `userId` keine Ganzzahl → 400 („userId muss eine Ganzzahl sein."). `userId` eines Kontos
  ohne gemeinsame Gruppe → 403 („Der Empfänger teilt keine Gruppe mit dir."), ohne Teil-Änderung:
  im selben Request gesendete Feldänderungen dürfen NICHT durchkommen.
- **AK3** Nur der Eigentümer übergibt: der Schreib-Scope bleibt `ownerScope`. Ersteller ohne
  Eigentum erhalten 404 (deckungsgleich mit dem bestehenden Vertrag aus #1213-AK5,
  `tasks-created-by.test.ts` — kein neuer Test, Dedup).
- **AK4** Nach der Übergabe gilt: `userId` = Empfänger, `createdById` = übergebender Eigentümer.
  Die Aufgabe erscheint in `GET /tasks` des Empfängers (ohne Kennzeichen); der bisherige
  Eigentümer sieht sie über den Ersteller-Zweig des Lese-Scopes mit `forUserId`/`forUserName`
  („Für:"-Kennzeichen = abgegeben).
- **AK5** Titel, Beschreibung, Checkliste, Frist (deadline) und Aufwand (estimatedEffort) bleiben
  durch die Übergabe unverändert — die Übergabe schreibt nur Eigentumsfelder.
- **AK6** Säulen-Beiträge zeigen nach der Übergabe auf KEINE Säule des vorherigen Eigentümers:
  Beiträge werden anhand gleichen Säulen-Namens auf das Empfänger-Konto übernommen ODER
  verworfen (wie #1249; die Wahl ist der Implementierung überlassen — getestet wird die
  Invariante, konsistent für Tasks und Serien).
- **AK7** Hängt die Aufgabe an Aufgaben (Dependency-Kanten in beide Richtungen), die der neue
  Eigentümer nicht sieht (weder Eigentümer noch Ersteller mit aktueller Gruppenmitgliedschaft),
  lehnt der Server die Übergabe mit einer eindeutigen 4xx-Meldung ab; die Transaktion wird
  vollständig zurückgerollt (keine halb übergebene Aufgabe).

### Serien-Übergabe (`PATCH /series/:id`)

- **AK8** Gleiches Verhalten wie Tasks (optionales `userId`, 400/403-Spiegel, `createdById` =
  Übergebender, „Für:"-Kennzeichen für den bisherigen Eigentümer). Bereits erzeugte Instanzen
  bleiben Eigentum des bisherigen Eigentümers — der Eigentümer wird NICHT kaskadiert
  (`applyToInstances`-Pfad berührt `userId` nicht). Säulen-Invariante wie AK6 (SeriesPillar).

### Formular (Frontend)

- **AK9** Die Empfängerauswahl erscheint im Bearbeiten-Formular (Task UND Serie) nur, wenn der
  Nutzer in mindestens einer Gruppe ist — ohne Gruppe unveränderter Flow. Sie ist mit dem
  eigenen Konto vorbelegt (sichtbarer Default „keine Abgabe"); erst das Speichern mit fremdem
  Empfänger übernimmt die `userId` in den `updateTask`/`updateSeries`-Payload. Eine Auswahl
  allein übergibt nichts (eine Primäraktion: Speichern).
- **AK10** Bei 375 px (und 320 px als Randfall) ist die Auswahl ohne horizontales Scrollen
  bedienbar — per Bounding-Box (`element.x + element.width <= viewport.width`); `scrollWidth`
  ist in der App-Shell strukturell geclipt (Erfahrung 2026-08-24).

## UX-Anforderungen (KI-UX-Block, eingeflossen)

- Kein zweiter primärer „Übertragen"-Button — die Übergabe passiert über den bestehenden
  Speichern-Button.
- „Für:"-Kennzeichen = bestehendes Badge (`TaskTree.tsx`, `SeriesTab.tsx`), kein neues Design.
- API-Fehler (403/4xx) inline im Formular als `KolAlert _type="error"` (Toast ist ein
  Anti-Pattern).

## Offene Impl-Entscheidungen (bewusst der Umsetzung überlassen)

- Säulen-Beiträge bei der Übergabe: übernehmen (gleicher Name) oder verwerfen — AK6 testet nur
  die Invariante „keine Säule des vorherigen Eigentümers", konsistent Task/Serie.
- Konkreter Fehlercode für den Abhängigkeitskonflikt (AK7): jede eindeutige 4xx mit
  verständlicher Meldung erfüllt das Kriterium.
- Push-Benachrichtigung an den Empfänger nach Übergabe (`notifyTaskCreated` als Vorbild):
  reine Erweiterung, kein AK.

## Testfälle → Dateien

| AK                      | Test                  | Datei                                                         |
| ----------------------- | --------------------- | ------------------------------------------------------------- |
| AK1, AK2, AK4, AK5, AK7 | API-Tests (node:test) | `server/src/express/tasks-handover.test.ts` (neu)             |
| AK6 (Task-Invariante)   | API-Test              | `server/src/express/tasks-handover.test.ts`                   |
| AK6 (Serie), AK8        | API-Tests             | `server/src/express/series-handover.test.ts` (neu)            |
| AK3                     | Dedup                 | `tasks-created-by.test.ts` (bestehend, Ersteller-PATCH → 404) |
| AK9                     | Vitest                | `frontend/src/components/TaskForm.test.tsx` (neuer Block)     |
| AK10                    | E2E                   | `frontend/e2e/issue-1252-handover.spec.ts` (neu)              |
