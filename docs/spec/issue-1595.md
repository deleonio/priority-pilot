# Spec: Issue #1595 — Gespeicherte Orte ohne Namen, mit Dedup und Adresssuche in den Einstellungen

Quelle: Harness-Marker-Kommentar zu Issue #1595 (KI-ANALYSE + KI-UX, Stand 2026-09-21T18:46:54Z).

## Ziel

Ein gespeicherter Ort („Standort-Favorit") hat nur noch eine Adresse, kein Namensfeld mehr. Das
Anlegen aus der Aufgabe funktioniert auch für lange Nominatim-Adressen (> 60 Zeichen), Fehler beim
Anlegen werden im Aufgabenformular sichtbar, doppelte Adressen werden serverseitig zusammengeführt,
und die Einstellungen-Seite bekommt dieselbe Adresssuche wie das Aufgabenformular.

## AK1 — Speichern langer Adressen ohne Neuladen sichtbar

**Precondition:** Angemeldeter Nutzer mit `location_reminders`-Feature, Aufgabenformular offen,
Adressvorschlag mit einer Adresse > 60 Zeichen (z. B. lange Nominatim-`display_name`).

**Schritte:** Klick auf den Stern in der Trefferzeile → `POST /place-favorites` mit dieser Adresse →
Wechsel zu Einstellungen → Standort → „Meine Orte" (ohne Seiten-Neuladen).

**Erwartung:** `POST` antwortet `201`; der Ort erscheint danach über `GET /place-favorites` und in der
Einstellungen-Karte, ohne dass der Server die Adresse auf 60 Zeichen kappt (Grenze bleibt bei 255).

## AK2 — Sichtbarer Fehler statt stillem Schlucken

**Precondition:** `api.createPlaceFavorite` schlägt fehl (403 durch `requirePlanFeature`, oder 500).

**Erwartung:** Das Aufgabenformular zeigt eine sichtbare Fehlermeldung (`KolAlert`/`role="alert"`);
der bisher leere `catch`-Block in `TaskForm.tsx` existiert nicht mehr. Die Aufgabe bleibt bedienbar.

## AK3 — Kein Namensfeld mehr

**Precondition:** Gespeicherter Ort existiert.

**Erwartung:** Die API-Antwort (`GET`/`POST /place-favorites`) enthält kein `name`-Feld mehr.
`PATCH /place-favorites/:id` existiert nicht mehr (404 für jede Anfrage — Route entfernt). Die
Einstellungen-Karte zeigt kein Namensfeld und keinen Knopf „Favorit umbenennen".

## AK4 — Dedup gleicher Adressen

**Precondition:** Ein Ort mit einer Adresse ist bereits gespeichert.

**Erwartung:** Ein zweiter `POST` mit derselben Adresse (getrimmt, Groß-/Kleinschreibung ignoriert)
legt keinen zweiten Eintrag an — `GET /place-favorites` enthält die Adresse weiterhin genau einmal.
Die Trefferzeile im Adressfeld zeigt für eine bereits gespeicherte Adresse den Zustand „bereits
gespeichert" statt eines erneuten Speichern-Angebots.

## AK5 — Adresssuche in den Einstellungen

**Precondition:** Einstellungen → Standort offen.

**Erwartung:** Das Adressfeld verwendet `AddressAutocomplete` (dieselbe Komponente wie im
Aufgabenformular): ab drei Zeichen erscheinen Vorschläge, Tastaturbedienung (Pfeiltasten + Enter)
funktioniert, die Auswahl übernimmt Adresse UND Koordinaten in den anzulegenden Ort.

## AK6 — Löschen über Bestätigungsdialog

**Precondition:** Gespeicherter Ort existiert, Nutzer klickt „Löschen".

**Erwartung:** `ConfirmDeleteDialog` öffnet sich. „Abbrechen" lässt den Eintrag stehen. Bestätigung
entfernt ihn aus der Liste und aus der Favoritenliste der Adressfelder von Aufgabe und Serie.

## AK7 — Touch-Ziele bei 375 px

**Erwartung:** Bei 375 px Viewport-Breite sind Adressfeld, Anlegen-Aktion, Löschen und
Dialog-Knöpfe des Abschnitts mindestens 44 px hoch und liegen vollständig innerhalb des Viewports
(Bounding-Box-Prüfung, nicht `scrollWidth` — die App-Shell clippt mit `overflow-x: hidden`).

## Test-Pflege

`frontend/e2e/issue-1342-place-favorites.spec.ts` prüft heute den Umbenennen-Weg (AK3 entfernt ihn)
und verwendet eine 49 Zeichen kurze Adresse (AK1 verlangt eine Adresse > 60 Zeichen als Regressionsfall).
Der Umbenennen-Schritt entfällt, die Testadresse wird durch eine lange Adresse ersetzt.
