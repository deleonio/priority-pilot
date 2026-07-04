# Nutzerhandbuch

Willkommen bei **Priority Pilot** – dem Werkzeug zur Aufgaben-Priorisierung. Dieses Handbuch
beschreibt systematisch alle Hauptfunktionen der Anwendung: das Dashboard, die Pflege von Aufgaben,
das Setzen von Abhängigkeiten, die Lebensbalance-Säulen sowie die In-App-Hilfe.

Priority Pilot beantwortet die Frage _„Woran sollte ich als Nächstes arbeiten?"_, wenn Aufgaben
voneinander abhängen und zugleich auf unterschiedliche Lebensbereiche einzahlen. Die Oberfläche ist
in drei Ansichten gegliedert (**Dashboard**, **Aufgaben**, **Aufgabenwald**), die oben über eine
Tab-Leiste erreichbar sind.

## Dashboard

Das Dashboard ist die Startansicht und liefert einen kompakten Überblick über deinen Fortschritt:

- **Statusübersicht:** Kennzahlen über alle Aufgaben – wie viele offen, in Arbeit und erledigt sind.
- **Nächster Task:** Die wichtigste Aufgabe, deren Abhängigkeiten (Vorgänger) bereits alle erledigt
  sind. So weißt du sofort, was als Nächstes sinnvoll umsetzbar ist.
- **Top-5-Aufgaben:** Die fünf wertvollsten Aufgaben, sortiert nach ihrem berechneten Wertbeitrag.
- **Deadlines:** Die anstehenden Fälligkeiten, damit terminkritische Aufgaben nicht untergehen.
- **Säulen-Übersicht:** Das Widget „Meine Themen" zeigt je Säule die Gewichtung sowie Anzahl,
  anteiligen Wert und Aufwand der einzahlenden Aufgaben. So siehst du auf einen Blick, wie sich
  deine Arbeit über die Lebensbereiche verteilt.

## Aufgaben

In der Ansicht **Aufgaben** pflegst du deine Tasks. Über den Button „Neuen Task anlegen" im Kopf
öffnest du das Formular; bestehende Aufgaben lassen sich in der Tabelle bearbeiten oder löschen.

Eine Aufgabe hat folgende Felder:

- **Titel:** Kurze, prägnante Bezeichnung der Aufgabe (Pflichtfeld).
- **Beschreibung:** Optionaler Freitext mit Details zur Aufgabe.
- **Priorität (1–5):** Eigene Wichtigkeit der Aufgabe. Sie fließt in die Wertberechnung ein.
- **Aufwand:** Geschätzter (und optional tatsächlicher) Aufwand zur Erledigung.
- **Deadline:** Optionales Fälligkeitsdatum. Anstehende Deadlines erscheinen im Dashboard.
- **Status:** Der Bearbeitungsstand (offen, in Arbeit, erledigt).

**Anlegen:** Über „Neuen Task anlegen" das Formular ausfüllen und speichern. **Bearbeiten:** In der
Tabelle die Zeile öffnen, Felder ändern und speichern. **Löschen:** Über die Löschen-Aktion der Zeile;
eine Sicherheitsabfrage verhindert versehentliches Entfernen.

### KI-Schnellerfassung

Über die Schnellerfassung kannst du eine Aufgabe in natürlicher Sprache eingeben. Die KI schlägt
Titel, Beschreibung und passende Säulen-Beiträge vor, die du vor dem Speichern anpassen kannst.

### Serien

Wiederkehrende Aufgaben lassen sich als Serie verwalten. Über „Serien verwalten" im Kopf legst du
Wiederholungen an, sodass regelmäßige Aufgaben nicht manuell neu erfasst werden müssen.

## Abhängigkeiten

Aufgaben können voneinander abhängen: Ein **Vorgänger** muss erledigt sein, bevor eine Aufgabe
sinnvoll bearbeitet werden kann. So entsteht ein gewichteter Abhängigkeitsgraph.

- **Vorgänger setzen:** Im Abhängigkeiten-Dialog einer Aufgabe wählst du die Aufgaben aus, von denen
  sie abhängt. Der Aufgabenwald bildet die entstehende Hierarchie als Baum ab.
- **Gewicht:** Jede Abhängigkeit trägt ein Gewicht, das angibt, wie stark eine Aufgabe zu einer
  anderen beiträgt. Das Gewicht beeinflusst den berechneten Wertbeitrag.
- **Zykluserkennung:** Zyklische Abhängigkeiten (A hängt von B, B hängt von A) werden erkannt und
  abgelehnt, damit der Abhängigkeitsgraph immer auflösbar bleibt.

## Säulen

Priority Pilot kennt fünf feste **Lebensbalance-Säulen**:

- **Körper**
- **Beziehungen**
- **Sinn**
- **Mentale Gesundheit**
- **Wirksamkeit**

**Beitrag je Aufgabe:** Jede Aufgabe verteilt ihren Investitions-Anteil zu 100 % auf ihre Säulen
(`share`), jeweils mit einer **Konfidenz** (`confidence`). So legst du fest, auf welche Lebensbereiche
eine Aufgabe einzahlt.

**Gewichtung:** Über die Säulen-Gewichtung (im Einstellungs-Menü rechts oben) verteilst du eine
prozentuale Gewichtung über die fünf Säulen (Summe 100 %). Sie skaliert den Wertbeitrag der Aufgaben
multiplikativ – so lenkst du die Priorisierung gezielt auf die Bereiche, die gerade wichtig sind. Bei
Gleichverteilung (je 20 %) bleibt die Gewichtung neutral.

**KI-Klassifizierung:** Auf Wunsch klassifiziert die KI eine Aufgabe automatisch, indem sie passende
Säulen-Beiträge vorschlägt. Die Vorschläge lassen sich vor dem Übernehmen prüfen und anpassen.

## Hilfe

Dieses Nutzerhandbuch ist auch direkt in der Anwendung verfügbar. Über den **Hilfe-Button** rechts
oben im Kopf (Fragezeichen-Symbol) öffnest du die In-App-Hilfeseite unter der Adresse `/hilfe`. Dort
wird der komplette Handbuch-Inhalt als formatierte Seite angezeigt. Mit dem Button „← Zurück" kehrst
du wieder zur Anwendung zurück.
