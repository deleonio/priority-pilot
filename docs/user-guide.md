# Priority Pilot – Nutzerhandbuch

Willkommen bei **Priority Pilot**. Die App beantwortet eine einzige Frage:
_„Woran sollte ich als Nächstes arbeiten?"_ – und zwar dann, wenn Aufgaben
voneinander abhängen und zugleich auf unterschiedliche Lebensbereiche einzahlen.

Zwei Ideen stecken dahinter:

- **Wertbeitrag statt Bauchgefühl.** Aus Priorität, Aufwand und den (gewichteten)
  Abhängigkeiten berechnet Priority Pilot pro Aufgabe einen Wert. Die wertvollsten
  Aufgaben und die sinnvolle nächste Aufgabe werden dadurch sichtbar.
- **Lebensbalance-Säulen.** Jede Aufgabe zahlt auf eine oder mehrere deiner persönlichen
  Lebens­bereiche ein. Die Säulen sind **nutzerdefiniert**: Du legst eigene Säulen an, benennst,
  gewichtest und löschst sie. Über eine Gewichtung steuerst du, welche Bereiche gerade
  wichtig sind – und siehst, ob deine Zeit dorthin fließt.

Dieses Handbuch erklärt alle Funktionen der Anwendung.

---

## Anmeldung

Priority Pilot ist ein persönliches Werkzeug – deine Daten sind an dein Konto
gebunden. Die Anmeldung erfolgt ausschließlich über **Google**:

- Auf der Startseite auf **„Login with Google"** klicken.
- Nach der Google-Anmeldung landest du direkt im Dashboard.

Der Zugang ist auf freigeschaltete E-Mail-Adressen beschränkt. Eine eigene Registrierung gibt
es nicht: Dein Konto wird bei der ersten erfolgreichen Anmeldung automatisch angelegt. Ist deine
Adresse nicht zugelassen, erscheint ein Anmeldefehler und es entsteht kein Konto – wende dich
dann an den Administrator. Wie der Betreiber Adressen freischaltet, steht in
[auth-setup.md](auth-setup.md).

Über die Kopfzeile kannst du dich jederzeit wieder **abmelden** (Icon ganz rechts).

---

## Überblick: Kopfzeile und Ansichten

Ganz oben findest du die **Kopf-Aktionen**:

- **Zum Dashboard** (Haus) – zurück zum Dashboard.
- **Suche** (Lupe) – durchsucht deine Aufgaben nach Titel und filtert nach Kategorie.
- **Neuen Task anlegen** (Plus) – der zentrale Einstieg für neue Aufgaben _und_ Serien.
- **Einstellungen** (Zahnrad) – Darstellung, Spracheingabe, Push, Standort, Säulen-Gewichtung, KI-Provider, Gruppen, Kategorien, Zugriff.
- **Hilfe** (Fragezeichen) – dieses Handbuch.
- **Abmelden** – beendet die Sitzung.

Rechts daneben siehst du dein Profilbild.

Die Kopfzeile ist auf allen Bildschirmgrößen einheitlich: Alle Icon-Buttons stehen direkt in der Leiste – ein zusätzliches Menü gibt es nicht.

Darunter wechselst du über eine **Tab-Leiste** zwischen den vier Hauptansichten:

1. **Dashboard** – Überblick und Empfehlungen
2. **Aufgaben** – deine Aufgaben anlegen und pflegen; ein Umschalter wechselt hier
   zwischen **offenen** und **erledigten** Aufgaben
3. **Serien** – wiederkehrende Aufgaben
4. **Wald** – die Aufgaben als Graph mit gewichteten Abhängigkeiten

---

## Dashboard

Das Dashboard ist die Startseite und reine Anzeige. Wenn ein Name hinterlegt ist,
begrüßt es dich mit **„Hallo {Name}!"**. Solange du noch keine Aufgaben hast, zeigt
die App stattdessen eine Karte mit dem Button **„Ersten Task anlegen"**. Von oben nach unten:

- **Meine Lebensbalance:** ein Herz zeigt, wie ausgeglichen sich dein erledigter
  Aufwand auf deine Säulen verteilt (erscheint erst, sobald du mindestens eine
  Säule angelegt hast).
- **Statuskacheln:** **Gesamt**, **Offen** und **Erledigt** – die Anzahl deiner
  Aufgaben auf einen Blick.
- **Nächste Aufgabe:** die Aufgabe mit der höchsten Priorität, deren Vorgänger alle
  erledigt sind.
  Über **„Erledigen"** schließt du sie in einem Dialog direkt ab. Steht nichts an,
  erscheint ein Hinweis (alles erledigt oder durch offene Vorgänger blockiert).
- **Was ist jetzt dran?** Eine nummerierte Vorschlagsliste mit höchstens fünf Einträgen,
  davon maximal zwei je Säule. Die bereits als „Nächste Aufgabe" angezeigte Aufgabe taucht
  hier nicht erneut auf.
- **In der Nähe:** offene Aufgaben mit Ortsbezug, aufsteigend nach Entfernung zu
  deiner aktuellen Position (höchstens zehn Einträge). Jeder Eintrag nennt Titel
  und Entfernung in Kilometern; im Kartentitel steht die eingestellte
  Anzeige-Entfernung. Die Karte erscheint nur, solange die Standort-Erfassung in
  den Einstellungen aktiviert ist – ist sie aus, fehlt die Karte ganz. Verweigert
  der Browser die Standort-Freigabe, bleibt die Karte stehen und zeigt stattdessen
  einen Hinweis.
- **Wichtigste Tasks:** die Top 5 nach berechnetem **Wert**.
- **Meine Themen:** je Säule ein Fortschrittsbalken, der den **tatsächlichen Anteil**
  (wohin dein Aufwand fließt) gegen die **Zielgewichtung** der Säule stellt. Darunter
  Anzahl der einzahlenden Aufgaben (offen/erledigt), anteiliger Wert und Aufwand.
- **Streak:** an wie vielen Tagen in Folge du zuletzt etwas erledigt hast, dazu deine
  Bestmarke.
- **Meilensteine:** die erreichten und noch offenen Stufen für Streak und Punkte
  (siehe „Erledigte Aufgaben und Punkte").
- **Tag geschafft:** ein kurzer Hinweis, der erscheint, wenn keine Aufgabe mehr offen ist
  und deine letzte Erledigung von heute stammt.
- **Gesamtguthaben:** dein Punktestand aus erledigten Aufgaben, aufgeschlüsselt je
  Säule (siehe „Erledigte Aufgaben und Punkte").
- **Anstehende Deadlines:** offene Aufgaben mit Fälligkeit, nach Datum sortiert.
  Ein farbiges Kennzeichen warnt vor **überfälligen** (rot) und **bald fälligen**
  (orange, heute bis in 3 Tagen) Aufgaben.

---

## Aufgaben verwalten

Im Tab **Aufgaben** stehen deine Aufgaben als **flache Liste der ausführbaren Blatt-Aufgaben**.
Das sind genau die Aufgaben, die **keine Unteraufgaben** haben – die Aufgaben,
die du jetzt tatsächlich erledigen kannst, ohne dass noch etwas davor erledigt werden muss.
Den Überblick über alle Abhängigkeiten findest du im Tab **Wald**.

Oben im Tab findest du drei Schalter und darunter die Filterzeile:

- einen **Umschalter „Erledigte Aufgaben anzeigen"**, der zwischen der Liste der offenen
  Aufgaben und der Tabelle der erledigten Aufgaben wechselt,
- einen **Schalter „Balance-Priorisierung"** – sortiert die offene Liste so um, dass Aufgaben
  nach oben rücken, die auf deine bislang vernachlässigten Säulen einzahlen. Das Prioritäts-
  Kennzeichen zeigt dann eine abgeleitete Stufe mit Tilde (`~P1` bis `~P5`) statt der eigentlichen
  Priorität; nach dem Ausschalten zeigt es wieder die gewohnten `P1` bis `P5`. Die Sortierung
  rechnet mit deinem aktuellen Stand: Hakst du eine Aufgabe ab, ordnet sich die Liste sofort neu.
  Deine Aufgaben selbst werden dabei nicht verändert, nur die Reihenfolge der Anzeige,
- einen **Schalter „Oberaufgaben anzeigen"** – nimmt zusätzlich die Aufgaben in die Liste auf,
  die selbst Unteraufgaben haben,
- ein **Suchfeld**, das die aktuelle Ansicht nach **Titel** filtert (Teiltreffer,
  Groß-/Kleinschreibung egal). Der Filter greift erst, wenn du **„Filtern"** klickst
  oder Enter drückst. Der Suchtext bleibt beim Umschalten bestehen; bei keinem Treffer
  erscheint ein Leerhinweis, und
- ein **Kategorie-Filter** daneben, sobald du Kategorien angelegt hast. Eine Auswahl wirkt
  sofort, ohne den Umweg über „Filtern".

Daneben öffnet die **Lupe in der Kopfzeile** ein Suchfenster: Gib einen Begriff ein
(optional per Sprache), wähle bei Bedarf eine **Kategorie** und starte die Suche – die App
wechselt dazu in den Aufgaben-Tab und übernimmt Begriff und Kategorie als Filter. Beide
stehen in der Adresszeile (`?q=` und `?cat=`), Lesezeichen und Zurück-Taste stellen sie
also wieder her.

Diktierst du die Anfrage und sind KI-Features aktiv, zerlegt die App sie vor der Suche:
Aus „offene Sachen zum Hausbau" wird der Suchbegriff „offene Sachen" plus die Kategorie
„Hausbau". Klappt das nicht, wird schlicht mit dem gesprochenen Text gesucht.

Rechts an jeder Zeile können **Kennzeichen** stehen:

- **Für: {Name}** bzw. **Erstellt von: {Name}** – bei Aufgaben, die du für ein
  Gruppenmitglied angelegt hast oder die jemand für dich angelegt hat (siehe „Gruppen").
- **Kategorie** – das farbige Kennzeichen mit dem Namen der Kategorie (siehe „Kategorien").
- **Serie** – die Aufgabe stammt aus einer Serie.
- **geändert** – eine Serien-Instanz, die du abweichend bearbeitet hast.
- **Fortschritt** als `erledigt/gesamt` – nur bei Aufgaben mit Unteraufgaben; zählt
  alle darunterliegenden Unteraufgaben mit.
- **Priorität** als `P1` bis `P5` – die Farbe stuft die Wichtigkeit ein: P1 blau,
  P2 und P3 orange, P4 und P5 rot.
- **Ortsbezug** (Globus) – die Aufgabe trägt einen Ortsbezug (Adresse oder
  Koordinaten). Das
  Kennzeichen erscheint auch in der Serien- und in der Erledigt-Liste.

### Aktionen je Aufgabe

Alle Aktionen liegen hinter einem **„Weitere Aktionen"-Menü** (Drei-Punkte-Button) am Zeilenende.
Im Menü findest du:

- **Erledigt / Wieder öffnen** – als erster Eintrag, schaltet den Status um.
  In dieser Liste stehen nur Aufgaben ohne Unteraufgaben, der Umschalter ist daher nie
  blockiert. Wieder öffnen ist jederzeit möglich – auch als schnelles Rückgängig direkt
  nach dem Erledigen.
- **Bearbeiten** (Stift) – öffnet das Aufgabenformular.
- **Abhängigkeiten** (Kette) – öffnet den Vorgänger-Editor.
- **Unteraufgabe anlegen** (Plus) – legt eine neue Aufgabe an, die automatisch als Vorgänger
  mit der aktuellen verknüpft wird.
- **Löschen** (Kreuz) – entfernt die Aufgabe nach Rückfrage.

Frisch erledigte Aufgaben bleiben für **5 Sekunden** „sticky" im offenen Baum (für ein
sofortiges Undo per „Wieder öffnen"). Danach lädt die Ansicht automatisch neu, und die
Aufgabe erscheint in der **Erledigt**-Ansicht.

---

## Aufgaben anlegen

Neue Aufgaben legst du immer über **„Neuen Task anlegen"** in der Kopfzeile an.
Der Ablauf ist zweistufig. Hast du die KI-Features in den Einstellungen
ausgeschaltet, entfällt der erste Schritt und das Formular öffnet sich direkt:

### Schritt 1 – Schnellerfassung

Beschreibe deine Aufgabe frei im Feld **„Beschreibe deinen Task"**, z. B.:
_„Bis Freitag den Kundenbericht fertigstellen, hohe Priorität, etwa ein halber Tag."_

Danach hast du drei Möglichkeiten:

- **Verarbeiten und weiter** – eine KI liest den Text und füllt Titel, Beschreibung,
  Priorität, Aufwand, Deadline, Adresse, Checkliste und Kategorie im Formular vor.
  Erkennt sie einen wiederkehrenden Termin, öffnet sich das Formular gleich im Serien-Modus.
- **Beraten lassen** – der Säulen-Berater antwortet im selben Dialog (siehe „Säulen-Berater").
- **Überspringen** – öffnet direkt das leere Formular; bereits eingegebener Text
  wandert in die Beschreibung.

### Schritt 2 – Formular

Im selben Dialog erscheint das Aufgabenformular. Felder:

- **Titel** (Pflichtfeld, max. 65 Zeichen) – kurzer, prägnanter Name. Ein Zähler am
  Feld zeigt die aktuelle Zeichenzahl.
- **Priorität** – Schieberegler, ganze Zahl von **1 bis 5** (Standard 3). Höher =
  wichtiger; fließt direkt in den Wert ein.
- **Geschätzter Aufwand in Tagen** – Schieberegler von **0,1 bis 1** (Standard 0,5).
- **Deadline (optional)** – Fälligkeitsdatum. Es zählt der reine Kalendertag,
  unabhängig von der Zeitzone.
- **Adresse (optional)** – ein Ortsbezug für die Aufgabe. Während der Eingabe
  schlägt die App passende Adressen vor; wählst du eine aus, werden die
  zugehörigen Koordinaten gespeichert und unter dem Feld angezeigt. Du kannst
  auch freien Text ohne Treffer übernehmen – dann liegen keine Koordinaten vor
  und die Aufgabe erscheint nicht in der „In der Nähe"-Liste. Ganz oben in der
  Vorschlagsliste stehen deine gespeicherten Orte (siehe „Gespeicherte Orte"),
  darunter die Suchtreffer. Am Stern neben einem Suchtreffer legst du ihn als
  gespeicherten Ort ab, ohne ihn damit auszuwählen. Mit **„Als Favorit speichern"**
  unter dem Feld sicherst du die Adresse, die gerade eingetragen ist – samt ihrer
  Koordinaten, falls sie aus einem Treffer stammt. Für Serien gilt das
  Adressfeld genauso.
- **Beschreibung (optional)** – weiterer Kontext, max. 3000 Zeichen.
- **Checkliste (optional)** – zerlege die Aufgabe in abhakbare Teilschritte.
  Einträge können hinzugefügt, abgehakt und entfernt werden.
- **Automatisches Löschen (optional)** – bei verpasster Deadline die Aufgabe nach 3 Tagen
  automatisch löschen (nur wählbar, wenn eine Deadline gesetzt ist; bei Serien immer
  wählbar, da das Startdatum als Fälligkeit dient).
- **Lektorat** – über einen Button neben Titel und Beschreibung kannst du die KI bitten,
  den Text zu verbessern (Kürzung, Smoothing, Rechtschreibung). Ein Diff-Dialog zeigt den
  Vergleich; du entscheidest, ob du den Vorschlag übernimmst.
- **Kategorie (optional)** – das Thema, zu dem die Aufgabe gehört (siehe „Kategorien").
  Höchstens eine je Aufgabe; sie ordnet nur, sie verändert die Priorisierung nicht.
- **Säulen (optional)** – auf welche Lebensbereiche die Aufgabe einzahlt
  (siehe „Lebensbalance-Säulen").
- **Empfänger** – für wen die Aufgabe bestimmt ist: dich selbst oder ein Mitglied
  einer deiner Gruppen (siehe „Gruppen"). Das Feld erscheint, solange du Mitglied
  mindestens einer Gruppe bist. Wählst du beim **Bearbeiten** ein fremdes Konto,
  übergibst du die Aufgabe mit dem Speichern – danach siehst du sie nur noch mit
  dem Kennzeichen „Für: {Name}". Ein Hinweis unter dem Feld sagt dir das vorher.

Speichern mit **„Anlegen"** (bzw. **„Bearbeiten"**), verwerfen mit **„Abbrechen"**.

> **Aufgabe oder Serie?** Beim Anlegen gibt es oben einen Schalter **„Serie"**.
> Aus = einmalige Aufgabe, Ein = wiederkehrende Serie (siehe „Serien").

---

## Checkliste

Im Aufgabenformular kannst du eine **Checkliste** anlegen. Damit zerlegst du eine Aufgabe
in einzelne, abhakbare Teilschritte:

- **Hinzufügen:** Text eingeben und **„Hinzufügen"** klicken – der neue Eintrag
  erscheint in der Liste.
- **Abhaken:** Schalter je Eintrag toggelt zwischen erledigt / offen.
- **Entfernen:** Kreuz-Button löscht den Eintrag.

Die Checkliste wird mit der Aufgabe gespeichert und ist beim Bearbeiten wieder da.
Sie fließt nicht in die Wertberechnung ein, dient rein der Übersicht.

---

## Automatisches Löschen nach verpasster Deadline

Aktivierst du im Formular **„Automatisch löschen nach 3 Tagen bei verpasster Deadline"**
(Checkbox, nur sichtbar bei gesetzter Deadline), wird die Aufgabe **3 Tage nach Ablauf
der Deadline** automatisch gelöscht – **aber nur, wenn sie bis dahin nicht erledigt ist**.

Das gilt auch für Serien-Instanzen: Wird die Option im Serien-Template gesetzt,
erben alle künftig generierten Instanzen diese Einstellung. Im Serien-Modus ist die
Option immer wählbar, da das Startdatum der Serie als Fälligkeit dient.

---

## Lektorat

Neben dem **Titel**- und dem **Beschreibungs**-Feld findest du je einen Button mit
Zauberstab-Icon: **„Titel lektorieren"** und **„Beschreibung lektorieren"**.

- Klick schickt den aktuellen Text an die KI – an den Provider, der in den
  Einstellungen aktiviert ist.
- Die KI liefert einen verbesserten Vorschlag (Kürzung, Glättung, Rechtschreibung).
- Ein **Diff-Dialog** zeigt den Vergleich nebeneinander (Original ↔ Vorschlag).
- Du übernimmst den Vorschlag per **„Übernehmen"** oder brichst ab – der Originaltext
  bleibt dann erhalten.

Das Lektorat ist unabhängig von der Schnellerfassung und jederzeit nutzbar.

---

## Spracheingabe

Textfelder wie **Titel**, **Beschreibung**, das Freitextfeld der **Schnellerfassung**
und das Suchfeld der Kopfzeilen-Suche lassen sich per Sprache füllen –
sofern dein Browser Spracherkennung unterstützt.

- Im Feld erscheint ein **Mikrofon-Button**. Ein Klick startet die Aufnahme, ein
  weiterer stoppt sie. Erkannter Text wird an den bestehenden Inhalt angehängt.
- Die Sprache ist auf Deutsch (`de-DE`) festgelegt.
- Optional startet die Aufnahme **automatisch** beim Öffnen der Formulare – aktivierbar
  über _Einstellungen → Allgemein → „Sprachaufnahme automatisch starten"_.
- Beim Anlegen und beim Suchen erkennt die KI aus dem gesprochenen Text auch die
  **Kategorie**, sofern du welche angelegt hast (siehe „Kategorien").

---

## Abhängigkeiten (Vorgänger)

Aufgaben können voneinander abhängen: Ein **Vorgänger** muss erledigt sein, bevor die
abhängige Aufgabe sinnvoll begonnen werden kann. Öffne dazu das **„Weitere Aktionen"-
Menü** (Drei-Punkte-Button) einer Aufgabe und wähle **„Abhängigkeiten"**.

- **Aktuelle Vorgänger** listet die verknüpften Aufgaben; jede lässt sich einzeln
  entfernen. (Bereits erledigte Vorgänger erscheinen hier nicht mehr.)
- **Vorgänger hinzufügen:** eine Aufgabe auswählen, ein **Gewicht (0,1–1)** setzen und
  **„Hinzufügen"**. Das Gewicht steuert, wie stark der Vorgänger zum Wert der
  abhängigen Aufgabe beiträgt (1 = voller Einfluss).

Priority Pilot verhindert **zyklische Abhängigkeiten** (z. B. A → B → A) und lehnt sie
mit einem verständlichen Hinweis ab. So bleibt der Abhängigkeitsgraph immer
widerspruchsfrei – und die „Nächste Aufgabe" ist stets die wichtigste, deren
Vorgänger alle erledigt sind.

---

## Kategorien

Kategorien ordnen deine Aufgaben nach **Thema** – „Hausbau", „Steuer", „Verein". Jede
Aufgabe und jede Serie hat höchstens eine; sie erscheint als farbiges Kennzeichen in den
Listen und lässt sich in der Suche als Filter wählen.

### Kategorie oder Säule?

Beides ordnet, aber mit unterschiedlicher Wirkung – deshalb gibt es beides:

|                   | Lebenssäule                             | Kategorie                            |
| ----------------- | --------------------------------------- | ------------------------------------ |
| Frage             | Worauf zahlt das in meinem Leben ein?   | Wo gehört das thematisch hin?        |
| Anzahl je Aufgabe | mehrere, jeweils mit Anteil in Prozent  | genau eine oder keine                |
| Wirkung           | steuert Wert, Priorisierung und Balance | nur Gruppierung, Kennzeichen, Filter |
| Beispiel          | Körper, Beziehungen, Sinn               | Hausbau, Steuer, Verein              |

Kurz: Eine Säule als Ordner zu missbrauchen („Hausbau" als sechste Säule) verzerrt die
Balance-Rechnung. Dafür sind Kategorien da.

### Kategorien anlegen und verwalten

Über _Einstellungen → Kategorien_ legst du Kategorien an, benennst sie um, wählst ihre
Farbe aus einer festen Palette und löschst sie wieder. Neue Konten starten ohne
Kategorien – ohne Kategorie bleiben Aufgaben einfach ungeordnet.

Beim Löschen bleiben die Aufgaben und Serien erhalten; sie verlieren nur die Zuordnung.

### Kategorie zuordnen

Im Aufgaben- und Serienformular wählst du unter **„Kategorie (optional)"** eine aus.
Bei der Schnellerfassung schlägt die KI die passende Kategorie vor, wenn der Text
eindeutig ist („Fliesen fürs Hausbau-Projekt bestellen") – der Vorschlag ist vor dem
Speichern änderbar. Eine Serie vererbt ihre Kategorie an jede generierte Aufgabe.

---

## Lebensbalance-Säulen

Lebensbalance-Säulen beschreiben, in welche Lebensbereiche eine Aufgabe einzahlt.
Sie sind **nutzerdefiniert**: Du legst eigene Säulen an, benennst, gewichtest und löschst sie.
Zu Beginn hast du noch keine Säulen – im Aufgabenformular erscheint dann der Hinweis,
zuerst welche in den Einstellungen anzulegen. Jede Säule besteht aus einem Namen und
einer kurzen Beschreibung.

### Beitrag je Aufgabe (Anteil und Konfidenz)

Im Aufgabenformular ordnest du unter **„Säulen"** eine oder mehrere Säulen zu. Je Säule:

- **Anteil** – wie stark die Aufgabe auf diese Säule einzahlt. Die Anteile aller
  Säulen einer Aufgabe werden beim Speichern automatisch auf 100 % normiert – die
  absolute Skala ist egal.
- **Konfidenz (%)** – wie sicher die Zuordnung ist (0 % = unsicher, 100 % = sicher).

Ohne Säulen-Zuordnung bleibt die Aufgabe **wertneutral**. Mit **„Säulen vorschlagen"**
kann eine KI aus Titel und Beschreibung passende Säulen samt Anteil und Konfidenz
vorschlagen. Nach der Schnellerfassung mit vorbelegtem Titel passiert das automatisch –
den Vorschlag kannst du vor dem Speichern anpassen.

### Säulen-Gewichtung anpassen

Über _Einstellungen → Säulen_ legst du fest, welche Bereiche gerade Priorität haben.
Jede Säule bekommt einen Wert von 0,0 bis 1,0; beim Speichern wird auf 100 %
normiert. Bei Gleichverteilung ist die Gewichtung neutral. Erhöhst du z. B. „Körper",
steigen Aufgaben, die stark auf „Körper" einzahlen, im Wert – und rücken damit in der
Priorisierung nach oben.

---

## Säulen-Berater

Der **Säulen-Berater** ist ein KI-Ratgeber für Aktivitäten. Er steckt in der
Schnellerfassung: Öffne **„Neuen Task anlegen"** und klicke im Freitext-Schritt auf
**„Beraten lassen"**.

- Er schlägt konkrete Aktivitäten vor und zeigt, auf welche Säulen sie einzahlen –
  mit kurzer Begründung.
- Er kennt deine aktuelle Verteilung aus „Meine Themen" und richtet die Vorschläge
  **bevorzugt auf die schwächsten (am stärksten unterversorgten) Säulen** aus.
- Optional beschreibst du im Textfeld deine Frage oder Situation (z. B. „Was kann ich am
  Wochenende für mich tun?"). Ohne Frage bekommst du Vorschläge über alle Säulen
  hinweg. Das Feld unterstützt **Spracheingabe**.
- Die Vorschläge erscheinen unter dem Textfeld, der Dialog bleibt offen. Mit **„Als Aufgabe
  übernehmen"** schreibst du einen Vorschlag in dasselbe Textfeld zurück und gehst von dort
  mit **„Verarbeiten und weiter"** ins Formular.
- Hast du noch keine Säulen angelegt, weist dich der Berater darauf hin, statt Vorschläge
  zu machen.

---

## Serien (wiederkehrende Aufgaben)

Mit **Serien** legst du wiederkehrende Aufgaben als Vorlage an. Aus einer Serie
erzeugt Priority Pilot regelmäßig neue Aufgaben-Instanzen.

- **Neue Serie anlegen:** über **„Neuen Task anlegen"** und den Schalter **„Serie"**
  einschalten. Statt einer Deadline setzt du dann ein **Startdatum** und einen
  **Rhythmus**: **Täglich**, **Wöchentlich**, **Monatlich**, **Werktags** (Mo–Fr),
  **Wochenende** (Sa+So) oder an einem bestimmten Wochentag (**Montags** bis
  **Sonntags**). Bei einem Wochentag-Rhythmus muss das Startdatum auf den passenden
  Wochentag fallen – sonst zeigt dir die App vor dem Speichern einen Hinweis.
  Priorität, Aufwand, Beschreibung und Säulen werden als Vorlage für
  jede Instanz übernommen.
- **Verwalten:** im Tab **Serien** siehst du alle Serien mit ihrem Rhythmus. Dort
  kannst du sie **bearbeiten** oder **löschen**. Beim Löschen entscheidest du zwischen
  **„Ja (Serie + alle Aufgaben)"** und **„Nein (nur Serie, Aufgaben bleiben
  eigenständig)"**: Mit **Ja** werden die offenen Instanzen mitgelöscht, mit **Nein**
  bleiben alle Aufgaben als eigenständige Aufgaben bestehen. Bereits erledigte
  Instanzen bleiben in beiden Fällen als eigenständige Aufgaben erhalten.
- **Fällige Instanzen generieren:** der gleichnamige Button erzeugt die aktuell
  fälligen Aufgaben aus allen Serien.

Aus einer Serie entstandene Aufgaben tragen im Aufgabenbaum das Kennzeichen **Serie**;
weichst du eine Instanz individuell ab, kommt **geändert** hinzu.

Hat jemand aus einer Gruppe eine Serie für dich angelegt und endet die gemeinsame
Mitgliedschaft – weil jemand die Gruppe verlässt oder die Gruppe gelöscht wird –,
trägt diese Serie das Kennzeichen **Ruhend**. Sie erzeugt dann keine neuen Aufgaben
mehr; bearbeiten und löschen kannst du sie weiterhin.

### Serien bearbeiten – Kaskade auf bestehende Instanzen

Wenn du ein Serien-Template bearbeitest und **kaskadierbare Felder** änderst
(Titel, Priorität, Aufwand, Beschreibung, Adresse, Automatisches Löschen, Säulen, Kategorie), erscheint
vor dem Speichern ein Bestätigungs-Dialog: **„Änderungen auf alle Instanzen übernehmen?"**

- **Ja** – die geänderten Werte werden auf alle bereits generierten Instanzen
  übertragen (auch auf solche, die du individuell angepasst hast).
- **Nein (nur Serie)** – nur das Template wird aktualisiert; künftige Instanzen
  erhalten die neuen Werte, bestehende bleiben unberührt.

Rhythmus und Startdatum werden **nie** kaskadiert.

---

## Aufgabengraph

Der Tab **Wald** zeigt, wie deine Aufgaben zusammenhängen.

- Ein **Pfeil** zeigt von der Unteraufgabe nach unten auf die Aufgabe, die sie ermöglicht.
- Je **dicker die Linie**, desto stärker das Gewicht der Abhängigkeit. Die Zahl steht an
  der Linie, du musst die Stärke also nicht schätzen.
- Jeder **Knoten** zeigt `#ID`, Titel, **Priorität**, **Wert** und – falls es Unteraufgaben
  gibt – den **Fortschritt**.
- Eine Aufgabe, die mehreren übergeordneten Aufgaben zuarbeitet, steht **einmal** da und hat
  mehrere Kanten.

Gezeigt wird immer eine zusammenhängende Abhängigkeitskette. Hast du mehrere, blätterst du
über **„Zurück"** und **„Vor"**; dazwischen steht, die wievielte von wie vielen du gerade
siehst. Aufgaben ganz ohne Abhängigkeit erscheinen hier nicht – verknüpfe zwei Aufgaben im
Tab „Aufgaben" über **„Abhängigkeiten"**, dann steht die erste Kette hier.

Unter der Grafik sitzen die Schaltflächen **Ansicht einpassen**, **Vergrößern** und
**Verkleinern**; auf dem Handy schiebst du den Ausschnitt mit dem Finger.

Ein Tipp auf einen Knoten öffnet darunter eine Detail-Karte mit Priorität, Wert,
Gesamtaufwand, Fortschritt und allen Vorgängern und Nachfolgern samt Gewicht. Von dort
kommst du direkt zu **Abhängigkeiten bearbeiten**. Alles Weitere – anlegen, ändern,
abhaken – machst du im Tab „Aufgaben".

Darunter lassen sich zwei Bereiche aufklappen: eine **Legende**, die die Pfeile und
Linienstärken erklärt, und **Graph als Liste** – dieselben Angaben in Textform und der Weg
für Tastatur und Screenreader.

---

## Erledigte Aufgaben und Punkte

In der **Erledigt**-Ansicht des Aufgaben-Tabs (Umschalter oben) stehen alle
abgeschlossenen Aufgaben. Je Säule wird angezeigt, wie viele **Punkte** die Aufgabe
dort eingebracht hat – die Spaltenwerte sind der auf die Säulen verteilte Aufwand.
Mit **„Wieder öffnen"** holst du eine Aufgabe zurück in den offenen Zustand.

### Punkte (Gamification)

Beim Erledigen einer Aufgabe sammelst du Punkte:

- Die Punkte entsprechen **Aufwand mal Priorität** der Aufgabe, anteilig auf ihre
  Säulen verteilt – entsprechend dem Anteil, mit dem die Aufgabe auf jede Säule
  einzahlt. Erledigst du eine Aufgabe erst nach ihrer Deadline, gibt es dafür nur
  die halbe Punktzahl.
- Aufgaben ohne Säulen-Zuordnung fließen ins **Dashboard-Gesamtguthaben** ein, verteilt
  nach deiner Säulen-Gewichtung — in der Erledigt-Tabelle zeigen sie 0 Punkte je Spalte.
  Erledigte Arbeit wird so auch ohne zugeordnete Säule sichtbar.

Dein Gesamtstand und die Aufteilung je Säule erscheinen im Dashboard unter
**„Gesamtguthaben"**.

### Meilenstein-Badges

Die Dashboard-Card **„Meilensteine"** zeigt feste Stufen für deinen Streak und deine
gesammelten Gamification-Punkte. Erreichte Stufen sind hervorgehoben, nicht erreichte
bleiben sichtbar. Die Auswertung ist rückwirkend: Bestandsdaten oberhalb einer Schwelle
zählen schon beim ersten Aufruf, ohne dass du dafür etwas Neues erledigen musst.

- **Streak** (gegen deine Bestmarke): 3, 7, 14, 30, 100 Tage.
- **Punkte** (Summe deiner Gamification-Punkte aus erledigten Aufgaben): 50, 250, 1000,
  5000 Punkte.

Es gibt keinen gespeicherten Erreicht-Zustand: Ein Punkte-Badge kann nach dem
**„Wieder öffnen"** einer erledigten Aufgabe wieder erlöschen, wenn deine Punktesumme
dadurch unter die Schwelle fällt.

---

## Einstellungen

Über das **Zahnrad** in der Kopfzeile öffnest du die Einstellungen mit den Bereichen
Allgemein, Säulen, KI-Provider, Standort, Gruppen, Kategorien und Zugriff. Administratoren
der App sehen zusätzlich den Bereich **Nutzerverwaltung** (siehe unten).

### Allgemein

- **Anzeigename** – der Name, mit dem das Dashboard dich begrüßt; nach dem Ändern
  mit **„Anzeigename speichern"** übernehmen.
- **Darstellung** – wähle das Farbschema: **System**, **Hell** oder **Dunkel**.
  „System" folgt der Einstellung deines Betriebssystems.
- **Sprache** – die Sprache der Oberfläche. Zur Wahl stehen Deutsch, Englisch,
  Französisch, Italienisch, Niederländisch, Polnisch, Portugiesisch, Russisch,
  Schwedisch und Spanisch; jede steht in der Liste in ihrer eigenen Schreibweise.
  Die Wahl wirkt sofort und bleibt auf diesem Gerät gespeichert. Ohne eigene Wahl
  richtet sich die App nach der Spracheinstellung deines Browsers.
- **Animationen** – die Schalter **„Animationen"**, **„Herz animieren"** und
  **„Erledigt animieren"** steuern die Bewegungen des Herzens auf dem Dashboard und
  den Ablauf beim Erledigen einer Aufgabe.
- **Sprachaufnahme automatisch starten** – ist der Schalter aktiv, wird beim Öffnen
  der Formulare das erste Feld fokussiert und dessen Mikrofon automatisch gestartet.
  Beim Einschalten wird der Mikrofon-Zugriff angefragt.
- **Push-Nachrichten aktivieren** – siehe „Benachrichtigungen".

### Säulen

Der Editor für die **Säulen-Gewichtung** (siehe „Lebensbalance-Säulen") sowie die
Verwaltung der Säulen selbst (Anlegen, Bearbeiten, Löschen – jeweils über eigene
Modal-Dialoge).

### Kategorien

Die Verwaltung der Kategorien (Anlegen, Bearbeiten, Löschen – jeweils über eigene
Modal-Dialoge) samt Farbwahl aus der festen Palette; siehe „Kategorien".

### KI-Provider

Oben schaltest du mit **„KI-Features aktiv"** die KI-Bedienelemente insgesamt ein und aus.
Ist der Schalter aus, öffnet „Neuen Task anlegen" direkt das vollständige Formular, und die
Lektorat-Buttons verschwinden aus dem Aufgabenformular.

Darunter wird die KI konfiguriert (Schnellerfassung, Säulen-Vorschlag, Säulen-Berater,
Lektorat). Du wählst den aktiven Provider und daraus per Dropdown das Modell – die
Modellliste wird live vom Provider geladen. Mitgelieferte Provider (Mistral, OpenRouter)
beziehen ihren Zugang vom Server; eigene Provider legst du über **„Neuer Provider"** an
(Name, Adresse, API-Key, Modell) und kannst sie **testen**, bearbeiten und löschen. Diese
Einstellung gilt serverseitig für alle Nutzer. Ist kein Provider eingerichtet, zeigt der
Tab den Hinweis, dass die KI-Features noch nicht nutzbar sind.

### Standort

- **Standort erfassen** – ermittelt im Hintergrund regelmäßig deine aktuelle
  Position (Standard alle 5 Minuten). Beim Einschalten wird die
  Standort-Berechtigung angefragt. Mit **„Standort ermitteln"** holst du die
  Position sofort; dazu siehst du die Uhrzeit der letzten Erfassung und eine
  Adresse zum Standort. Drei Schieberegler steuern die Standortfunktion:
  **Anzeige-Entfernung** – bis zu dieser Entfernung zeigt die „In der Nähe"-Liste
  Aufgaben; **Alarm-Entfernung** – liegt eine Aufgabe näher als diese Entfernung,
  kommt ein Push-Hinweis; **Aktualisierungsintervall** – wie oft die Position ermittelt
  wird.

#### Gespeicherte Orte

Orte, die du oft brauchst, legst du hier einmal ab und wählst sie danach im Adressfeld
direkt aus.

- **Anlegen:** unter **„Gespeicherte Orte"** einen **Namen** („Zuhause", „Büro") und
  eine **Adresse** eingeben, dann **„Anlegen"**. Die Adresse tippst du hier als freien
  Text ein – eine Vorschlagsliste gibt es in den Einstellungen nicht.
- **Meine Orte:** die Karte darunter listet alle gespeicherten Orte. Je Eintrag kannst
  du **umbenennen** (neuen Namen eingeben, **„Übernehmen"**) oder **löschen**
  (**„Endgültig löschen"** nach Rückfrage).

Im Adressfeld von Aufgaben und Serien stehen deine gespeicherten Orte vor den
Suchtreffern. Orte, die du hier in den Einstellungen anlegst, haben keine Koordinaten –
sie füllen das Adressfeld, zählen aber nicht für „In der Nähe". Koordinaten bekommt ein
Ort nur, wenn du ihn direkt aus einem Suchtreffer im Adressfeld speicherst.

### Zugriff

Hier legst du persönliche **Tokens** an, mit denen externe Programme auf deine Daten
zugreifen – mit deinen Rechten. **„Token erzeugen"** legt einen an und zeigt seinen
Schlüssel **genau einmal**; danach siehst du nur noch Name, Rechtestufe, Ablauf und die
letzte Nutzung. Je Token schaltest du zwischen **Nur lesend** und **Lesen und Schreiben**
um. **„Zurückziehen"** sperrt einen Token ab dem nächsten Aufruf.

---

## Gruppen

In _Einstellungen → Gruppen_ organisierst du zusammen mit anderen Nutzern Aufgaben:

- **Gruppe anlegen:** Namen festlegen – du bist damit Admin der Gruppe. Admins tragen
  das Kennzeichen **„Admin"**, Mitglieder **„Mitglied"**.
- **Mitglieder verwalten:** als Admin suchst du in der Gruppe über **„Konto suchen"**
  ein Konto und lädst es per **„Einladen"** ein; entfernen kannst du Mitglieder
  ebenfalls nur als Admin.
- **Einladen per Link:** in der Gruppe erzeugst du unter **„Link erzeugen"** einen
  Einladungs-Link. Wer ihn öffnet – auch ohne Anmeldung –, landet auf einer Seite mit
  **„Gruppe beitreten"**. Unter **„Offene Einladungen"** kannst du Links kopieren oder
  für ungültig erklären (**„Ungültig machen"**).
- **Einladungen** (Karte in der Gruppen-Übersicht, nicht zu verwechseln mit
  „Offene Einladungen"): eingeladene Konten können annehmen oder ablehnen.
- **Aufgaben für andere anlegen:** im Aufgaben- und Serien-Formular wählst du im Feld
  **„Empfänger"**, für wen die Aufgabe bestimmt ist. In den Listen erkennst du
  fremde Aufgaben an den Hinweisen **„Für: {Name}"** und **„Erstellt von: {Name}"**;
  bearbeiten lassen sie sich nur beim Empfänger.

---

## Nutzerverwaltung (nur für Administratoren)

Jedes Konto hat eine App-weite Rolle: **Administrator** oder **Mitglied**. Diese Rolle ist etwas
anderes als die Admin-Rolle innerhalb einer Gruppe (siehe [Gruppen](#gruppen)) – wer eine Gruppe
verwaltet, ist deshalb noch kein Administrator der App.

- **Wer Administrator ist:** Konten, deren E-Mail-Adresse der Betreiber in `ADMIN_EMAILS`
  eingetragen hat, werden beim Anmelden automatisch Administrator. Alle anderen Konten sind
  Mitglied. Aus der Liste entfernte Adressen bleiben Administrator, bis jemand die Rolle in der
  App zurückstuft.
- **Bereich Nutzerverwaltung:** Administratoren sehen in den Einstellungen den zusätzlichen
  Bereich _Nutzerverwaltung_ mit allen Konten (Name, E-Mail, Rolle). Über **„… zum
  Administrator machen"** bzw. **„… zur Mitgliedschaft zurückstufen"** änderst du die Rolle;
  die Änderung gilt sofort, auch für bereits angemeldete Personen.
- **Mindestens ein Administrator:** Den letzten verbleibenden Administrator kann niemand
  zurückstufen – ernenne zuerst eine andere Person.
- **Mitglieder** sehen den Bereich nicht; ein direkter Aufruf von `/settings/nutzer` öffnet bei
  ihnen den Bereich _Säulen_.

---

## Benachrichtigungen (Push)

Priority Pilot kann dich per **Push-Nachricht** an fällige Aufgaben erinnern – auch
wenn die App gerade nicht geöffnet ist.

- Aktivieren über _Einstellungen → Allgemein → „Push-Nachrichten aktivieren"_. Beim
  Einschalten fragt der Browser nach der Benachrichtigungs-Erlaubnis.
- Mit **„Push testen"** kannst du eine Testnachricht auslösen.
- Unterstützt dein Browser keine Push-Nachrichten, erscheint ein Hinweis – meist hilft
  es, die App zu installieren (siehe unten).
- Erinnerungen verschickt die App einmal täglich als **je eine gebündelte Nachricht**:
  alle offenen Aufgaben, deren Deadline innerhalb der nächsten 24 Stunden abläuft oder
  schon überschritten ist — sowie **separat** deine drei wichtigsten offenen Aufgaben
  (nach Priorität). Eine bereits gemeldete Fälligkeit wird nicht erneut gemeldet.
- Ist die Standort-Erfassung aktiv, bekommst du zusätzlich einen Hinweis, wenn eine
  offene Aufgabe mit Ortsbezug näher als deine Alarm-Entfernung liegt (Standard 1 km):
  als einzelne Nachricht mit Titel und Entfernung bzw. als gebündelte Nachricht
  „X Aufgaben in der Nähe". Auch hier wird dieselbe Aufgabe nicht sofort erneut
  gemeldet.

> **Hinweis: Doppelte Benachrichtigung vermeiden.** Wenn du Priority Pilot nur als
> Browser-Tab (Chrome) und **nicht** als eigenständige App nutzt, kann neben der
> App-Benachrichtigung eine **zweite Benachrichtigung** von Chrome erscheinen (z. B.
> „URL kopieren", „Teilen", „In Chrome öffnen"). Diese Mehrfachbenachrichtigung ist ein
> Plattformverhalten von Chrome, nicht von Priority Pilot. **Workaround:** Installiere die
> App als eigenständige App (siehe unten „App installieren und aktualisieren") – dann wird
> nur noch die gewünschte App-Benachrichtigung angezeigt. Aufeinanderfolgende Pushes
> ersetzen sich zudem gegenseitig, sodass nichts gestapelt wird – die App vergibt ihren
> Benachrichtigungen dazu einen festen Tag.

---

## App installieren und aktualisieren

Priority Pilot ist eine **installierbare Web-App (PWA)** und funktioniert auch offline.

- **Installieren:** Erscheint das Banner **„App installieren"**, kannst du die App mit
  **„Installieren"** auf dein Gerät legen. Unter iOS/Safari nutzt du dazu **Teilen →
  Zum Home-Bildschirm**.
- **Aktualisieren:** Ist eine neue Version verfügbar, erscheint unten eine Karte mit
  **„Jetzt neu laden"**. Ein Klick lädt die aktuelle Version.

Eine Karte **„Offline einsatzbereit"** bestätigt, dass die App auch ohne Verbindung
nutzbar ist.

Die laufende Versionsnummer steht in der **Fußzeile**; ist die Standort-Erfassung
aktiv, steht dort zusätzlich deine zuletzt ermittelte Position.

---

## Bahn-Routenplaner (öffentlich)

Unter der Adresse **`/bahn`** gibt es einen eigenständigen, **öffentlich** (ohne
Anmeldung) erreichbaren **Bahn-Routenplaner**:

- **Start-** und **Zielbahnhof** eingeben (mit Vorschlagsliste), dazu **Datum** und
  **Uhrzeit**.
- **„Verbindungen suchen"** zeigt Verbindungen mit Abfahrt, Ankunft, Dauer und
  Umstiegen; je Verbindung zusätzlich, ob sie pünktlich ist oder wie viele Minuten
  Verspätung angekündigt sind.

Dieser Planer ist ein eigenständiges Extra und unabhängig von deinen Aufgaben.

---

## Tastaturkürzel

- **Strg + Enter** (bzw. **⌘ + Enter**) – löst in Dialogen die primäre Aktion aus
  (z. B. Anlegen/Bearbeiten, „Verarbeiten und weiter", Vorgänger „Hinzufügen",
  „Speichern" in den Einstellungen, „Endgültig löschen"). „Beraten lassen" bleibt
  ein reiner Klick-Weg.
- **Esc** oder Klick außerhalb – schließt Dialoge und Menüs.

---

## Weitere Hinweise

- Alle Daten werden **serverseitig** gespeichert; Änderungen sind sofort persistent
  und auf all deinen Geräten verfügbar.
- Die KI-Funktionen (Schnellerfassung, Säulen-Vorschlag, Säulen-Berater, Lektorat) benötigen
  einen serverseitig konfigurierten Zugang. Ist er nicht eingerichtet, bleiben die
  übrigen Funktionen uneingeschränkt nutzbar.
