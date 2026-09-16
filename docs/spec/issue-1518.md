# Serien-Aufgaben: nur die aktuelle Instanz in Liste, Signalen, Standort und Push – Issue 1518

**Stand:** 2026-09-16  
**Ziel:** Je Serie zählt an den Lesestellen des Alltags genau eine Instanz; die Generierung hält je Serie höchstens fünf offene Instanzen vor; die Listenzeile kennzeichnet die Instanz mit einem Serien-Icon samt Screenreader-Text.

Diese Spezifikation beschreibt das beobachtbare Verhalten. Ausgangslage: Eine Serie legt je Termin eine eigene Aufgabe an (`seriesId`, `seriesOccurrence`, Snapshot von Titel, Priorität, Adresse und Koordinaten). Ohne Zusammenfassung füllen diese Wiederholungen Aufgabenliste, Dashboard-Signale, „In der Nähe“ und Push-Nachrichten und verdrängen andere Aufgaben.

---

## Auswahlregel (gilt an allen Lesestellen gleich)

Je `seriesId` genau eine Instanz:

1. Die **früheste offene Instanz mit Deadline ab heute** (heute = aktueller Kalendertag, UTC-Mitternacht wie bei der Generierung).
2. Gibt es keine solche, die **jüngste vergangene offene Instanz** (größte vergangene Deadline).
3. Offen heißt `status != 'Done'`. Erledigte Instanzen sind nie Repräsentant.
4. Aufgaben ohne `seriesId` – auch von der Serie abgekoppelte mit gesetztem `originSeriesId` – bleiben eigenständig und werden nicht gruppiert.
5. Die Reihenfolge der übrigen Aufgaben bleibt erhalten; nur die nicht gewählten Instanzen fallen weg.

Wird die gezeigte Instanz erledigt oder gelöscht, rückt beim nächsten Laden die nächste Instanz derselben Serie nach.

---

## Journey 1: Aufgabenliste und Dashboard-Signale

### Ziel

Der Nutzer sieht je Serie eine Zeile bzw. einen Eintrag, nicht fünf.

### Vorbedingung

- Eine tägliche Serie ist angelegt und materialisiert (fünf offene Instanzen, Deadlines heute bis heute+4)
- Daneben existieren mindestens zwei weitere offene Einzelaufgaben

### Schritte

1. **Tab „Aufgaben“ öffnen**
   - Die Liste (`GET /forest`) enthält die Serie als **genau eine Zeile**: die Instanz mit Deadline heute
   - Die Zeile trägt ein Serien-Icon (`fa-repeat`) mit dem Screenreader-Text **„Serienaufgabe“**; das Text-Badge „Serie“ existiert nicht mehr
   - Bei 375px Breite bleibt die Zeile innerhalb des Viewports (Bounding-Box), das Icon ist sichtbar
   - Das Badge „geändert“ für Ausnahme-Instanzen bleibt unverändert

2. **Dashboard prüfen**
   - Kachel „Nächste Aufgabe“ (`GET /next`) und Liste „Was ist jetzt dran?“ (`GET /suggestions`) enthalten je Serie höchstens einen Eintrag – dieselbe Instanz wie in der Liste
   - „Was ist jetzt dran?“ nennt bei mindestens drei infrage kommenden Aufgaben drei verschiedene Aufgaben
   - Widget „Wichtigste Tasks“ (aus `GET /forest`) enthält je Serie höchstens einen Eintrag
   - Karte „In der Nähe“ (`GET /tasks/nearby`) listet je Serie höchstens einen Eintrag; bei fünf nahen Instanzen bleibt genau einer
   - MCP-Werkzeug `next_task` liefert dieselbe Auswahl wie „Nächste Aufgabe“

3. **Gezeigte Instanz erledigen oder löschen**
   - Beim nächsten Laden erscheint die folgende Instanz derselben Serie (Deadline heute+1)

### Erwartetes Ergebnis

- Genau eine Zeile bzw. ein Eintrag je Serie an allen genannten Stellen, ausgewählt nach der Auswahlregel
- Die Zeile ist per Icon und Screenreader-Text als Serienaufgabe erkennbar
- `GET /tasks` liefert weiterhin alle Instanzen (Lookup, Zähl-Kacheln, Erledigt-Liste); Tab „Wald“ (`GET /graph`) und Tab „Serien“ zeigen weiterhin alle vorhandenen Instanzen bzw. Serien

---

## Journey 2: Push-Nachrichten

### Ziel

Kein Push nennt dieselbe Serie mehrfach.

### Vorbedingung

- Nutzer mit Push-Subscription; eine Serie mit fünf offenen Instanzen (fällig bzw. in der Nähe) und zwei weitere Aufgaben

### Schritte

1. **06:00-Push „Deine wichtigsten Aufgaben“** (`collectDailyTopTasks`): nennt drei verschiedene Aufgaben, keine doppelt – bei einer Serie mit fünf Instanzen höchster Priorität also die Serie einmal plus die zwei anderen Aufgaben
2. **Push „Fällige Aufgaben“** (`collectDueTaskReminders`): je Serie höchstens eine Instanz
3. **Push „Aufgaben in der Nähe“** (`collectGeoPushGroups`): bei fünf nahen Instanzen derselben Serie meldet der Push „1 Aufgabe in der Nähe“ statt einer Sammelmeldung über alle Instanzen

### Erwartetes Ergebnis

- Je Serie höchstens eine Instanz je Push; das NotificationLog-Dedup bleibt unverändert (es sieht nur noch die gewählte Instanz)

---

## Journey 3: Generierung

### Ziel

Eine Serie hält höchstens fünf offene Instanzen vor.

### Schritte

1. **Tägliche Serie anlegen und generieren** (`POST /series/{id}/generate` mit `until` = heute+30 bzw. „Serien generieren“ im Serien-Tab)
   - Es entstehen genau fünf offene Instanzen (Deadlines heute bis heute+4)
2. **Erneut generieren** mit demselben Fenster
   - Es entsteht keine sechste Instanz
3. **Eine Instanz erledigen, erneut generieren**
   - Genau eine weitere Instanz entsteht (wieder fünf offene)

### Erwartetes Ergebnis

- Die Fünfer-Grenze zählt offene Instanzen (`status != 'Done'`) je Serie; der 30-Tage-Horizont bleibt als Obergrenze bestehen (wöchentliche/monatliche Serien ändern sich dadurch nicht)
- Bereits vorhandene Instanzen über der Fünfer-Grenze werden nicht gelöscht; sie verschwinden über die Auswahlregel aus den Lesestellen

---

## UX-Beratung (Phase UX, Kurzfassung)

- **Interaktion:** Eine Zeile je Serie; Erledigen/Löschen lässt die nächste Instanz nachrücken (bestehender Reload). Das Icon ist rein informativ, kein Klick-Ziel – wie das Geo-Badge.
- **Mobile-First:** Der Icon-Chip ersetzt das Text-Badge und spart Breite in der Badge-Zeile bei 375px; Nachweis per Bounding-Box wie in `frontend/e2e/issue-1465-pillar-badge.spec.ts`.
- **A11y/BITV:** `<span role="img" aria-label="Serienaufgabe">` mit `<i class="fa-solid fa-repeat" aria-hidden="true">`; die Bedeutung transportiert der Screenreader-Text, nie Farbe oder Icon allein (WCAG 1.4.1). `data-testid` und `aria-label` liegen auf demselben Element.
- **KoliBri:** Bewusst kein `KolBadge`/`KolIcon` – deren Label läge im Shadow-DOM (Repo-Präzedenz `GeoBadge.tsx`, `PillarMissingBadge.tsx`, #1465).
- **Design-Sprache:** Derselbe Icon-Chip-Stil wie `.geo-badge`/`.pillar-missing-badge` (muted Tokens, kein zweiter Badge-Stil); Icon `fa-repeat` wird bereits für Serien in der Erledigt-Liste verwendet.
- **Offene UX-Fragen:** keine.

---

## Hinweise zur Nutzung

- **Implementierung:** Eine zentrale Auswahlfunktion (`selectSeriesRepresentatives` in `server/src/logics/series.ts`), an allen Lesestellen angewendet; keine API-Änderung an `GET /tasks` (die Aufgabenliste liest `GET /forest`)
- **Test-Strategie:** Unit-Tests für Auswahlregel, Wald, Signale, drei Push-Collector und Generierungsgrenze; API-Test für „In der Nähe“; Vitest für das Icon-Badge; E2E bei 375px für Liste, Icon und unveränderten Graph
