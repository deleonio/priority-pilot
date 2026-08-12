# User Journeys – Priority Pilot

**Stand:** 2026-08-12  
**Ziel:** Reale Nutzerabläufe als Spezifikation für Test-Neuaufbau (Epic #563, Issue #565)

Diese Journeys beschreiben **von außen sichtbares Verhalten** der laufenden Priority Pilot App. Sie sind die referenzierbare Quelle für neue Tests, implementierungsagnostisch und auf reale Abläufe fokussiert.

---

## Journey 1: Aufgabe erstellen

### Ziel

Neue Aufgabe in das System aufnehmen, mit allen relevanten Metadaten (Priorität, Aufwand, Deadline, Beschreibung, Säulen).

### Vorbedingung

- Nutzer ist angemeldet
- Dashboard oder Aufgaben-Tab ist geöffnet

### Schritte

1. **Aufgaben anlegen auslösen**
   - Klick auf **„Neuen Task anlegen"** in der Kopfzeile (Plus-Icon)
   - Dialog „Schnellerfassung" öffnet sich

2. **Option A: KI-gestützte Erfassung**
   - Text eingeben: _„Bis Freitag den Kundenbericht fertigstellen, hohe Priorität, etwa ein halber Tag"_
   - Klick auf **„Verarbeiten und weiter"** (primärer Button; sendet den erfassten Text an die KI)
   - Die KI belegt Titel, Beschreibung, Priorität, Aufwand und Deadline vor; das Formular öffnet sich mit diesen Werten

3. **Option B: Manuelle Erfassung**
   - Textfeld überspringen mit **„Überspringen"**
   - Leeres Formular erscheint

4. **Aufgaben-Metadaten erfassen**
   - **Titel** (Pflichtfeld): _„Kundenbericht Q3 fertigstellen"_
   - **Priorität**: Schieberegler auf **4** (1–5, Standard 3)
   - **Geschätzter Aufwand**: Schieberegler auf **0,5** Tage (0,1–1)
   - **Deadline** (optional): _2026-08-15_ wählen
   - **Beschreibung** (optional): _„Finanzkennzahlen und Prognose für Q3"_
   - **Säulen** (optional): Säule „Wirksamkeit" mit **Anteil 100%** und **Konfidenz 80%** zuordnen

5. **Aufgabe speichern**
   - Klick auf **„Anlegen"**
   - Dialog schließt sich
   - Aufgabe erscheint im Aufgaben-Baum oder in der Aufgaben-Liste

### Erwartetes Ergebnis

- Aufgabe ist persistent gespeichert
- Aufgabe erscheint in der Aufgaben-Liste mit dem erfassten Titel
- Aufgabe hat den Status „Open"
- Metadaten (Priorität, Aufwand, Deadline, Beschreibung, Säulen) sind korrekt gespeichert
- Aufgabe ist im Aufgabenwald sichtbar (sofern nicht durch Abhängigkeiten blockiert)

---

## Journey 2: Abhängigkeit hinzufügen

### Ziel

Zwei Aufgaben so verknüpfen, dass eine Aufgabe vom Erledigen der anderen abhängt.

### Vorbedingung

- Zwei Aufgaben existieren im System
- Nutzer ist im Aufgaben-Tab

### Schritte

1. **Vorgänger-Editor öffnen**
   - Für die abhängige Aufgabe das **„…"-Menü** (Weitere Aktionen) klicken
   - **„Abhängigkeiten"** auswählen
   - Dialog „Abhängigkeiten" öffnet sich

2. **Vorgänger auswählen**
   - Im Bereich **„Vorgänger hinzufügen"** eine Aufgabe aus der Liste auswählen
   - Auswahlliste zeigt alle vorhandenen Aufgaben (außer bereits verknüpfte)

3. **Kantengewicht setzen**
   - Gewicht über einen **Schieberegler** einstellen: **0,7** (Bereich 0,1–1,0, Schritt 0,1, Standard 1,0)
   - Werte außerhalb 0,1–1,0 werden beim Hinzufügen blockiert (Meldung „Das Gewicht muss eine Zahl zwischen 0,1 und 1 sein.")
   - Das Gewicht steuert, wie stark diese Abhängigkeit in die Wertberechnung eingeht (siehe Journey 4)

4. **Abhängigkeit bestätigen**
   - Klick auf **„Hinzufügen"**
   - Vorgänger erscheint in der Liste **„Aktuelle Vorgänger"**

### Erwartetes Ergebnis

- Abhängigkeit ist persistent gespeichert
- Vorgänger-Aufgabe erscheint in der Liste der aktuellen Vorgänger
- Im Aufgaben-Baum ist die abhängige Aufgabe eingerückt unter dem Vorgänger sichtbar
- Die abhängige Aufgabe lässt sich erst erledigen, wenn der Vorgänger „Done" ist
- Zyklische Abhängigkeiten werden mit einem Hinweis abgelehnt (z. B. A → B → A)

---

## Journey 3: Kantengewicht ändern

### Ziel

Das Gewicht einer bestehenden Abhängigkeit anpassen, um die Priorisierungslogik zu steuern.

### Vorbedingung

- Eine Abhängigkeit zwischen zwei Aufgaben existiert bereits
- Nutzer ist im Vorgänger-Editor der abhängigen Aufgabe

### Schritte

1. **Vorgänger-Editor öffnen**
   - Für die abhängige Aufgabe das **„…"-Menü** klicken
   - **„Abhängigkeiten"** auswählen
   - Dialog „Abhängigkeiten" öffnet sich

2. **Bestehende Abhängigkeit anzeigen**
   - Im Bereich **„Aktuelle Vorgänger"** die relevante Abhängigkeit identifizieren
   - Der aktuelle Gewichtswert ist angezeigt

3. **Gewicht ändern**
   - **ENTFERNEN**: Klick auf **„Entfernen"** neben der Abhängigkeit
   - **NEU HINZUFÜGEN**: Aufgabe erneut auswählen mit neuem Gewicht (z. B. **0,9** statt **0,7**)
   - Klick auf **„Hinzufügen"**

### Erwartetes Ergebnis

- Das neue Gewicht ist persistent gespeichert
- Der Wert der abhängigen Aufgabe im Aufgabenwald hat sich entsprechend angepasst (höheres Gewicht → höherer Wertbeitrag)
- Die Änderung wirkt sich sofort auf die Priorisierung aus (neue Sortierung im Aufgabenwald)

---

## Journey 4: Prio-Berechnung auslösen

### Ziel

Die automatische Priorisierungsberechnung auslösen, die den Wertbeitrag und die nächste sinnvolle Aufgabe ermittelt.

### Vorbedingung

- Mindestens eine Aufgabe mit Priorität existiert
- Optionale Abhängigkeiten und Säulen-Zuordnungen sind konfiguriert

### Schritte

1. **Aufgabenwald anzeigen**
   - Tab **„Aufgabenwald"** auswählen
   - Der Aufgabenwald zeigt die Aufgaben als Baumstruktur, sortiert nach Wert

2. **Wertberechnung beobachten**
   - Jede Aufgabe zeigt **Priorität**, **Wert** und **Gesamtaufwand** (inklusive aller Abhängigkeiten)
   - Der Wert wird automatisch aus:
     - Eigener Priorität
     - Gewichteten Werten der abhängigen Aufgaben
     - Säulen-Faktor (sofern zugeordnet)
       berechnet

3. **Nächste Aufgabe ermitteln**
   - Im Dashboard den Bereich **„Nächste Aufgabe"** betrachten
   - Zeigt die wichtigste Aufgabe, deren Vorgänger alle erledigt sind
   - Steht nichts an, erscheint ein Hinweis (alles erledigt oder blockiert)

### Erwartetes Ergebnis

- Aufgabenwald ist nach Wertbeitrag sortiert (wichtigste Aufgabe oben)
- Die „Nächste Aufgabe" im Dashboard zeigt die Aufgabe mit höchster Priorität, deren Abhängigkeiten alle erledigt sind
- Wertberechnung berücksichtigt:
  - Rekursive Abhängigkeiten mit Kantengewichten
  - Säulen-Gewichtung (multiplikativer Faktor)
  - Transitiven Aufwand inklusive aller Abhängigkeiten
- Bei Änderungen an Aufgaben, Abhängigkeiten oder Säulen-Gewichtung aktualisiert sich die Berechnung automatisch

### Konkretes Beispiel (beobachtbar)

_Wert-Berechnung als beobachtbarer Effekt – ohne interne Formel:_

- **Blocker-Effekt:** Eine Aufgabe, von der andere, wichtige Aufgaben abhängen, erhält einen höheren Wert und rückt im Aufgabenwald weiter nach oben – sie ist ein Engpass für wertvolle Arbeit.
- **Säulen-Effekt:** Eine zugeordnete Säule mit hohem Gewicht hebt den Wert (Aufgabe rückt nach oben); eine niedrig gewichtete Säule senkt ihn (Aufgabe rückt nach unten). Ohne zugeordnete Säule bleibt der Wert unbeeinflusst.
- **Kantengewicht:** Ein höheres Gewicht an einer Abhängigkeit verstärkt den jeweiligen Effekt auf die Sortierung.

> **Hinweis:** Der exakte Zahlenwert ist Implementierungsdetail und nicht Teil dieser Spezifikation. Tests leiten daraus die **Sortierreihenfolge** ab (wichtigste Aufgabe oben), nicht eine bestimmte Zahl.

**Beispiel-Szenario:** Aufgabe C (Priorität 3) wird zum Vorgänger von zwei Aufgaben, darunter Aufgabe A (Priorität 5). _Beobachtung:_ C rückt im Aufgabenwald nach oben, weil nun eine sehr wichtige Aufgabe (A) auf C wartet.

---

## Randfälle & Fehler

| Situation                                  | Erwartetes Verhalten                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------- |
| Keine Aufgaben vorhanden / Filter leer     | Hinweis: „Keine Aufgaben gefunden. Passen Sie ggf. die Filter an."                    |
| Aufgabe ohne Vorgänger                     | Im Abhängigkeits-Dialog: „Dieser Task hat keine Vorgänger."                           |
| Keine weiteren Tasks als Vorgänger wählbar | Hinweis: „Kein weiterer Task verfügbar, der als Vorgänger hinzugefügt werden könnte." |
| Zyklische Abhängigkeit (z. B. A → B → A)   | Wird zurückgewiesen (HTTP 409): „… Es würde ein Zyklus entstehen."                    |
| Titel fehlt beim Anlegen                   | „Bitte einen Titel angeben."                                                          |
| Titel länger als 30 Zeichen                | „Titel darf maximal 30 Zeichen haben." (Eingabe wird blockiert)                       |
| Kantengewicht außerhalb 0,1–1              | „Das Gewicht muss eine Zahl zwischen 0,1 und 1 sein."                                 |
| Priorität keine Ganzzahl zwischen 1 und 5  | „Priorität muss eine Ganzzahl zwischen 1 und 5 sein."                                 |
| Geschätzter Aufwand außerhalb 0,1–1        | „Geschätzter Aufwand muss eine Zahl zwischen 0,1 und 1 sein."                         |

---

## Hinweise zur Nutzung

- **Format:** Diese Journeys verwenden ein informelles „Given/When/Then"-Format, sind aber keine strikten BDD-Spezifikationen.
- **Implementierung:** Journeys sind implementierungsagnostisch – sie beschreiben das beobachtbare Verhalten, nicht den technischen Pfad dahinter.
- **Test-Strategie:** Aus diesen Journeys werden Tests abgeleitet, die:
  - **ausführbar** sind (jede Journey kann durchgespielt werden)
  - **mutationsresistent** sind (prüfen Verhalten, nicht Implementierungsdetails)
  - **ergebnisorientiert** sind (validieren das Ergebnis, nicht nur Schritte)
- **Änderungen:** Bei Änderungen an der App müssen diese Journeys aktualisiert werden, damit Tests weiterhin gültig bleiben.

---

## Versionierung

- **v1.0** (2026-08-12): Initialefassung für Issue #565. Vier Kern-Workflows dokumentiert.
- **v1.1** (2026-08-12): Review-Findings adressiert – konkretes Wert-Berechnungsbeispiel (Journey 4), Kantengewicht-UI spezifiziert (Schieberegler), neue Sektion „Randfälle & Fehler".
