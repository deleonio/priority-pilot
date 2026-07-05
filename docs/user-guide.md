# Nutzerhandbuch — Priority Pilot

Priority Pilot hilft dir, die richtige Aufgabe zur richtigen Zeit zu erledigen. Dieses Handbuch erklärt alle Funktionen der Anwendung.

---

## Dashboard

Das Dashboard ist die Startseite von Priority Pilot. Es gibt dir einen schnellen Überblick über deinen aktuellen Arbeitsstand.

### Statusübersicht

Oben auf dem Dashboard siehst du Kennzahlen auf einen Blick: Gesamtanzahl der Aufgaben, Anzahl offener und erledigter Aufgaben sowie dein aktueller Punktestand.

### Nächster Task

Der Bereich „Nächster Task" zeigt die Aufgabe mit dem höchsten Wertbeitrag, bei der alle Vorgänger bereits erledigt sind. Das ist die Aufgabe, mit der du jetzt am produktivsten wärst.

### Top-5-Aufgaben nach Wert

Eine Liste der fünf Aufgaben mit dem höchsten berechneten Wertbeitrag. Der Wertbeitrag berücksichtigt sowohl die eigene Priorität einer Aufgabe als auch den gewichteten Beitrag aller abhängigen Aufgaben und die Säulen-Gewichtung.

### Anstehende Deadlines

Hier siehst du Aufgaben, deren Deadline in Kürze erreicht wird. So geraten wichtige Fristen nicht in Vergessenheit.

### Säulen-Übersicht (Meine Themen)

Das Widget „Meine Themen" zeigt für jede der fünf Lebensbalance-Säulen:

- die aktuelle Gewichtung in Prozent,
- wie viele Aufgaben auf diese Säule einzahlen,
- den anteiligen Wertbeitrag und den geschätzten Gesamtaufwand.

---

## Aufgaben verwalten

In der Aufgabentabelle verwaltest du alle deine Aufgaben. Du erreichst sie über den Navigationspunkt „Aufgaben".

### Aufgabe anlegen

Klicke auf „Neue Aufgabe". Es öffnet sich ein Formular mit folgenden Feldern:

| Feld                      | Beschreibung                                                               |
| ------------------------- | -------------------------------------------------------------------------- |
| **Titel**                 | Pflichtfeld. Kurzer, prägnanter Name der Aufgabe.                          |
| **Beschreibung**          | Optionale Erläuterung oder Kontext.                                        |
| **Priorität**             | Ganzzahl von 1 (niedrig) bis 5 (hoch). Beeinflusst den Wertbeitrag direkt. |
| **Geschätzter Aufwand**   | Voraussichtlicher Zeitaufwand (z. B. in Stunden).                          |
| **Tatsächlicher Aufwand** | Erfasster Aufwand nach Erledigung.                                         |
| **Deadline**              | Optionales Fälligkeitsdatum.                                               |
| **Status**                | `Open`, `In Bearbeitung` oder `Erledigt`.                                  |

Bestätige mit „Speichern". Die neue Aufgabe erscheint sofort in der Tabelle.

### Aufgabe bearbeiten

Klicke auf eine Aufgabe in der Tabelle, um sie zu öffnen. Ändere die gewünschten Felder und speichere.

### Aufgabe löschen

Öffne die Aufgabe und wähle „Löschen". Verknüpfte Abhängigkeiten werden dabei ebenfalls entfernt.

---

## KI-Schnellerfassung

Die KI-Schnellerfassung erlaubt es, Aufgaben per Freitext anzulegen, ohne das Formular manuell auszufüllen.

### Ablauf (zweistufig)

1. **Freitext eingeben:** Beschreibe deine Aufgabe in natürlicher Sprache, z. B.:
   `„Bis Freitag Bericht für Kunden fertigstellen, Priorität hoch, ca. 3 Stunden"`
2. **KI parst den Text:** Im ersten Schritt extrahiert die KI Titel, Priorität, Aufwand und Deadline aus dem Text. Im zweiten Schritt klassifiziert sie die Aufgabe automatisch den passenden Lebensbalance-Säulen zu.
3. **Vorschau prüfen:** Die erkannten Felder werden als Vorschau angezeigt. Du kannst sie vor dem Speichern noch anpassen.

Bestätige mit „Übernehmen", um die Aufgabe anzulegen.

> **Hinweis:** Für die KI-Schnellerfassung und die automatische Säulen-Klassifikation muss der Server mit einem gültigen `MISTRAL_API_KEY` gestartet worden sein. Fehlt der Key, antwortet der Endpunkt mit einem Fehler.

---

## Abhängigkeiten

Aufgaben können voneinander abhängen. Eine Abhängigkeit bedeutet: Aufgabe B kann erst sinnvoll begonnen werden, wenn Aufgabe A erledigt ist.

### Vorgänger setzen

Öffne eine Aufgabe und wechsle zum Reiter „Abhängigkeiten". Wähle aus der Liste eine oder mehrere Vorgänger-Aufgaben aus und klicke „Hinzufügen".

### Gewicht konfigurieren

Jede Abhängigkeit trägt ein **Gewicht** (Standard: 1,0). Das Gewicht gibt an, wie stark der Vorgänger zum Wertbeitrag des Nachfolgers beiträgt. Ein höheres Gewicht erhöht den berechneten Wert des Vorgängers entsprechend.

### Zykluserkennung

Priority Pilot erkennt automatisch zyklische Abhängigkeiten (z. B. A → B → A) und lehnt sie mit einem Hinweis ab. So bleibt der Abhängigkeitsgraph immer azyklisch.

---

## Säulen

Die fünf Lebensbalance-Säulen strukturieren, in welche Lebensbereiche eine Aufgabe einzahlt:

| Säule                  | Bedeutung                                     |
| ---------------------- | --------------------------------------------- |
| **Körper**             | Physische Gesundheit, Bewegung, Ernährung     |
| **Beziehungen**        | Familie, Freundschaften, soziale Verbindungen |
| **Sinn**               | Bedeutung, Werte, persönliches Wachstum       |
| **Mentale Gesundheit** | Wohlbefinden, Stressabbau, Erholung           |
| **Wirksamkeit**        | Beruf, Projekte, produktive Leistung          |

### Beitrag je Aufgabe (Anteil %, Konfidenz %)

Im Aufgabenformular kannst du für jede Säule angeben:

- **Anteil (%):** Wie viel Prozent des Aufgaben-Investments auf diese Säule entfallen. Die Anteile aller Säulen einer Aufgabe summieren sich auf 100 %.
- **Konfidenz (%):** Wie sicher du dir bist, dass die Aufgabe wirklich auf diese Säule einzahlt (0 % = unsicher, 100 % = sehr sicher).

### KI-Klassifizierung

Bei der KI-Schnellerfassung klassifiziert die KI automatisch, welche Säulen zur neuen Aufgabe passen, und schlägt Anteile und Konfidenzwerte vor.

### Säulen-Berater (Aktivitäten-Ratgeber)

Der Säulen-Berater (Glühbirnen-Symbol im Header) ist ein kleiner KI-Ratgeber: Er schlägt dir konkrete Aktivitäten vor und zeigt, auf welche Säulen sie einzahlen würden — samt kurzer Begründung. Als Grundlage dienen die Kurzbeschreibungen der Säulen aus den Einstellungen.

Optional kannst du eine Frage oder deine Situation beschreiben (z. B. „Was kann ich am Wochenende für mich tun?"); der Berater richtet die Vorschläge dann danach aus. Ohne Frage bekommst du Vorschläge über alle Säulen hinweg. Die Beratung läuft — wie die KI-Schnellerfassung — über die Mistral-API und benötigt einen konfigurierten `MISTRAL_API_KEY`.

### Säulen-Gewichtung anpassen

Die globale Säulen-Gewichtung steuert, welche Lebensbereiche gerade Priorität haben sollen. Du erreichst sie über das Einstellungs-Symbol im Header oder über das Dashboard-Widget „Meine Themen".

Vergib jeder Säule einen Prozentsatz; die Summe muss 100 % ergeben. Bei Gleichverteilung (je 20 %) hat die Gewichtung keinen Einfluss auf die Reihenfolge. Erhöhst du z. B. „Körper" auf 40 %, steigen Aufgaben, die stark auf „Körper" einzahlen, im Wertbeitrag.

---

## Aufgabenwald

Der Aufgabenwald zeigt alle Aufgaben als Bäume, geordnet nach ihrem Wertbeitrag.

### Funktionsweise

- **Wurzeln** sind Aufgaben ohne weitere abhängige Aufgaben (die nichts voraussetzen) oder Aufgaben, die selbst keine Vorgänger haben und am wertvollsten sind.
- **Kindknoten** sind die Aufgaben, die von der übergeordneten Aufgabe abhängen.
- Jeder Knoten zeigt Titel, Status, Priorität und den berechneten Wertbeitrag.
- Die Bäume sind nach Wertbeitrag sortiert — die wichtigste Aufgabe steht ganz oben.

Der Aufgabenwald ist eine **Leseansicht**: Hier navigierst du durch Zusammenhänge und erkennst, welche Aufgaben den größten Hebel haben. Bearbeitungen nimmst du in der Aufgabentabelle vor.

---

## Serien

Mit Serien legst du wiederkehrende Aufgaben an. Eine Serie erzeugt automatisch neue Aufgabeninstanzen nach einem festgelegten Rhythmus.

### Serie anlegen

Wähle „Neue Serie" und fülle die Felder aus:

| Feld                  | Beschreibung                                                          |
| --------------------- | --------------------------------------------------------------------- |
| **Titel**             | Name der wiederkehrenden Aufgabe.                                     |
| **Rhythmus**          | Wie oft die Aufgabe wiederkehrt (täglich, wöchentlich, monatlich, …). |
| **Standardpriorität** | Priorität, die neue Instanzen automatisch erhalten.                   |

### Serien verwalten

In der Serien-Übersicht siehst du alle aktiven Serien. Du kannst Rhythmus und Standardpriorität nachträglich ändern.

### Ausnahmen

Einzelne Instanzen einer Serie lassen sich individuell anpassen oder überspringen, ohne die Serie selbst zu verändern.

---

## Punkte / Gamification

Priority Pilot belohnt das Erledigen von Aufgaben mit Punkten. Dein Gesamtpunktestand ist im Dashboard sichtbar.

### Berechnung

```
Punkte = Tatsächlicher Aufwand × Priorität
```

- **Tatsächlicher Aufwand:** Der erfasste Aufwand beim Abschließen der Aufgabe.
- **Priorität:** Der Wert 1–5, der beim Anlegen gesetzt wurde.

### Abzug bei Verspätung

Wird eine Aufgabe nach der gesetzten Deadline als erledigt markiert, wird ein Abzug berechnet. Pünktliches Erledigen zahlt sich also aus.

---

## Header-Aktionen

Die Kopfzeile der Anwendung enthält globale Aktionen, die jederzeit erreichbar sind.

| Aktion                | Beschreibung                                                                                                                     |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Aktualisieren**     | Lädt alle Daten neu vom Server. Nützlich, wenn du Priority Pilot auf mehreren Geräten nutzt.                                     |
| **Theme**             | Wechselt zwischen System-Theme, Hell und Dunkel. Die Einstellung wird im Browser gespeichert.                                    |
| **Säulen-Gewichtung** | Öffnet den Dialog zum Anpassen der globalen Säulen-Gewichtung (entspricht den Einstellungen im Dashboard-Widget „Meine Themen"). |
| **Abmelden**          | Beendet die aktuelle Sitzung und leitet zur Anmeldeseite weiter.                                                                 |
