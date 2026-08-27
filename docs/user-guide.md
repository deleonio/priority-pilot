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

Der Zugang ist auf freigeschaltete E-Mail-Adressen beschränkt. Ist deine Adresse
nicht zugelassen, erscheint ein entsprechender Hinweis – wende dich dann an den
Administrator.

Über die Kopfzeile kannst du dich jederzeit wieder **abmelden** (Icon ganz rechts).

---

## Überblick: Kopfzeile und Ansichten

Ganz oben findest du die **Kopf-Aktionen**:

- **Suche** (Lupe) – durchsucht deine Aufgaben nach Titel.
- **Neuen Task anlegen** (Plus) – der zentrale Einstieg für neue Aufgaben _und_ Serien.
- **Säulen-Berater** (Glühbirne) – KI-Vorschläge für Aktivitäten.
- **Einstellungen** (Zahnrad) – Darstellung, Spracheingabe, Push, Standort, Säulen-Gewichtung, KI-Provider.
- **Hilfe** (Fragezeichen) – dieses Handbuch.
- **Abmelden** – beendet die Sitzung.

Rechts daneben siehst du dein Profilbild.

Die Kopfzeile ist auf allen Bildschirmgrößen einheitlich: Alle sechs Icon-Buttons stehen direkt in der Leiste – ein zusätzliches Menü gibt es nicht.

Darunter wechselst du über eine **Tab-Leiste** zwischen den vier Hauptansichten:

1. **Dashboard** – Überblick und Empfehlungen
2. **Aufgaben** – deine Aufgaben anlegen und pflegen; ein Umschalter wechselt hier
   zwischen **offenen** und **erledigten** Aufgaben
3. **Serien** – wiederkehrende Aufgaben
4. **Wald** – die Priorisierung als Baum

---

## Dashboard

Das Dashboard ist die Startseite und reine Anzeige. Wenn ein Name hinterlegt ist,
begrüßt es dich mit **„Hallo {Name}!"**. Solange du noch keine Aufgaben hast, zeigt
die App stattdessen eine Karte mit dem Button **„Ersten Task anlegen"**. Von oben nach unten:

- **Statuskacheln:** **Gesamt**, **Offen** und **Erledigt** – die Anzahl deiner
  Aufgaben auf einen Blick.
- **Nächste Aufgabe:** die Aufgabe mit der höchsten Priorität, deren Vorgänger alle
  erledigt sind.
  Über **„Jetzt starten"** öffnest du sie direkt zum Bearbeiten. Steht nichts an,
  erscheint ein Hinweis (alles erledigt oder durch offene Vorgänger blockiert).
- **Was ist jetzt dran?** Eine nummerierte Vorschlagsliste mit höchstens fünf Einträgen,
  davon maximal zwei je Säule. Die bereits als „Nächste Aufgabe" angezeigte Aufgabe taucht
  hier nicht erneut auf.
- **Wichtigste Tasks:** die Top 5 nach berechnetem **Wert**.
- **Meine Themen:** je Säule ein Fortschrittsbalken, der den **tatsächlichen Anteil**
  (wohin dein Aufwand fließt) gegen die **Zielgewichtung** der Säule stellt. Darunter
  Anzahl der einzahlenden Aufgaben (offen/erledigt), anteiliger Wert und Aufwand.
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
Den Überblick über den gesamten Aufgabenbaum mit Oberaufgaben, Abhängigkeiten und dem
Aufgabenwald findest du im Tab **Wald**.

Oben im Tab findest du zwei Bedienelemente:

- einen **Umschalter „Erledigte Aufgaben anzeigen"**, der zwischen der Liste der offenen
  Aufgaben und der Tabelle der erledigten Aufgaben wechselt, und
- ein **Suchfeld**, das die aktuelle Ansicht nach **Titel** filtert (Teiltreffer,
  Groß-/Kleinschreibung egal). Der Filter greift erst, wenn du **„Filtern"** klickst
  oder Enter drückst. Der Suchtext bleibt beim Umschalten bestehen; bei keinem Treffer
  erscheint ein Leerhinweis.

Daneben öffnet die **Lupe in der Kopfzeile** ein Suchfenster: Gib einen Begriff ein
(optional per Sprache) und starte die Suche – die App wechselt dazu in den Aufgaben-Tab
und übernimmt den Begriff als Titel-Filter.

Rechts an jeder Zeile können **Kennzeichen** stehen:

- **Serie** – die Aufgabe stammt aus einer Serie.
- **geändert** – eine Serien-Instanz, die du abweichend bearbeitet hast.
- **Fortschritt** als `erledigt/gesamt` – nur bei Aufgaben mit Unteraufgaben; zählt
  alle darunterliegenden Unteraufgaben mit.
- **Priorität** als `P1` bis `P5` – die Farbe stuft die Wichtigkeit ein: P1 blau,
  P2 und P3 orange, P4 und P5 rot.

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
Der Ablauf ist zweistufig:

### Schritt 1 – Schnellerfassung

Beschreibe deine Aufgabe frei im Feld **„Beschreibe deinen Task"**, z. B.:
_„Bis Freitag den Kundenbericht fertigstellen, hohe Priorität, etwa ein halber Tag."_

Danach hast du zwei Möglichkeiten:

- **Verarbeiten und weiter** – eine KI liest den Text und füllt Titel, Beschreibung,
  Priorität, Aufwand und Deadline im Formular vor.
- **Überspringen** – öffnet direkt das leere Formular; bereits eingegebener Text
  wandert in die Beschreibung.

### Schritt 2 – Formular

Im selben Dialog erscheint das Aufgabenformular. Felder:

- **Titel** (Pflichtfeld, max. 30 Zeichen) – kurzer, prägnanter Name. Ein Zähler am
  Feld zeigt die aktuelle Zeichenzahl.
- **Priorität** – Schieberegler, ganze Zahl von **1 bis 5** (Standard 3). Höher =
  wichtiger; fließt direkt in den Wert ein.
- **Geschätzter Aufwand in Tagen** – Schieberegler von **0,1 bis 1** (Standard 0,5).
- **Deadline (optional)** – Fälligkeitsdatum. Es zählt der reine Kalendertag,
  unabhängig von der Zeitzone.
- **Beschreibung (optional)** – weiterer Kontext.
- **Checkliste (optional)** – zerlege die Aufgabe in abhakbare Teilschritte.
  Einträge können hinzugefügt, abgehakt und entfernt werden.
- **Automatisches Löschen (optional)** – bei verpasster Deadline die Aufgabe nach 3 Tagen
  automatisch löschen (nur wählbar, wenn eine Deadline gesetzt ist; bei Serien immer
  wählbar, da das Startdatum als Fälligkeit dient).
- **Lektorat** – über einen Button neben Titel und Beschreibung kannst du die KI bitten,
  den Text zu verbessern (Kürzung, Smoothing, Rechtschreibung). Ein Diff-Dialog zeigt den
  Vergleich; du entscheidest, ob du den Vorschlag übernimmst.
- **Säulen (optional)** – auf welche Lebensbereiche die Aufgabe einzahlt
  (siehe „Lebensbalance-Säulen").

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

Neben dem **Titel**- und dem **Beschreibungs**-Feld findest du einen Button mit
Zauberstab-Icon: **Lektorat**.

- Klick schickt den aktuellen Text an die KI – an den Provider, der in den
  Einstellungen aktiviert ist.
- Die KI liefert einen verbesserten Vorschlag (Kürzung, Glättung, Rechtschreibung).
- Ein **Diff-Dialog** zeigt den Vergleich nebeneinander (Original ↔ Vorschlag).
- Du übernimmst den Vorschlag per **„Übernehmen"** oder brichst ab – der Originaltext
  bleibt dann erhalten.

Das Lektorat ist unabhängig von der Schnellerfassung und jederzeit nutzbar.

---

## Spracheingabe

Textfelder wie **Titel**, **Beschreibung**, die **Schnellerfassung**, das Suchfeld
der Kopfzeilen-Suche und das Feld des Säulen-Beraters lassen sich per Sprache füllen –
sofern dein Browser Spracherkennung unterstützt.

- Im Feld erscheint ein **Mikrofon-Button**. Ein Klick startet die Aufnahme, ein
  weiterer stoppt sie. Erkannter Text wird an den bestehenden Inhalt angehängt.
- Die Sprache ist auf Deutsch (`de-DE`) festgelegt.
- Optional startet die Aufnahme **automatisch** beim Öffnen der Formulare – aktivierbar
  über _Einstellungen → Allgemein → „Sprachaufnahme automatisch starten"_.

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

Der **Säulen-Berater** (Glühbirne in der Kopfzeile) ist ein KI-Ratgeber für
Aktivitäten:

- Er schlägt konkrete Aktivitäten vor und zeigt, auf welche Säulen sie einzahlen –
  mit kurzer Begründung.
- Er kennt deine aktuelle Verteilung aus „Meine Themen" und richtet die Vorschläge
  **bevorzugt auf die schwächsten (am stärksten unterversorgten) Säulen** aus.
- Optional beschreibst du deine Frage oder Situation (z. B. „Was kann ich am
  Wochenende für mich tun?"). Ohne Frage bekommst du Vorschläge über alle Säulen
  hinweg. Das Feld unterstützt **Spracheingabe**.
- Klick auf **„Beraten lassen"**. Jeden Vorschlag kannst du mit **„Als Aufgabe
  übernehmen"** direkt in die Schnellerfassung übernehmen.

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
  kannst du sie **bearbeiten** oder **löschen**. Beim Löschen entscheidest du, ob die
  Serie **mitsamt aller zugehörigen Aufgaben** entfernt wird oder **nur die Serie** –
  die bereits generierten Aufgaben bleiben dann eigenständig bestehen.
- **Fällige Instanzen generieren:** der gleichnamige Button erzeugt die aktuell
  fälligen Aufgaben aus allen Serien.

Aus einer Serie entstandene Aufgaben tragen im Aufgabenbaum das Kennzeichen **Serie**;
weichst du eine Instanz individuell ab, kommt **geändert** hinzu.

### Serien bearbeiten – Kaskade auf bestehende Instanzen

Wenn du ein Serien-Template bearbeitest und **kaskadierbare Felder** änderst
(Titel, Priorität, Aufwand, Beschreibung, Automatisches Löschen, Säulen), erscheint
vor dem Speichern ein Bestätigungs-Dialog: **„Änderungen auf alle Instanzen übernehmen?"**

- **Ja** – die geänderten Werte werden auf alle bereits generierten Instanzen
  übertragen (auch auf solche, die du individuell angepasst hast).
- **Nein (nur Serie)** – nur das Template wird aktualisiert; künftige Instanzen
  erhalten die neuen Werte, bestehende bleiben unberührt.

Rhythmus, Startdatum und Aktiv-Status werden **nie** kaskadiert.

---

## Aufgabenwald

Der Tab **Aufgabenwald** zeigt die Priorisierung als **Baumstruktur**, sortiert nach
Wert – die wichtigste Aufgabe steht oben.

- Jeder Knoten zeigt `#ID – Titel` sowie **Priorität**, **Wert** und den
  **Gesamtaufwand in Tagen** (inklusive aller Abhängigkeiten).
- Abhängige Aufgaben stehen eingerückt darunter.

Der Aufgabenwald ist eine **Leseansicht**: Hier erkennst du Zusammenhänge und welche
Aufgaben den größten Hebel haben. Bearbeitet wird im Tab „Aufgaben".

---

## Erledigte Aufgaben und Punkte

In der **Erledigt**-Ansicht des Aufgaben-Tabs (Umschalter oben) stehen alle
abgeschlossenen Aufgaben. Je Säule wird angezeigt, wie viele **Punkte** die Aufgabe
dort eingebracht hat – die Spaltenwerte sind der auf die Säulen verteilte Aufwand.
Mit **„Wieder öffnen"** holst du eine Aufgabe zurück in den offenen Zustand.

### Punkte (Gamification)

Beim Erledigen einer Aufgabe sammelst du Punkte:

- Die Punkte entsprechen dem **geschätzten Aufwand** der Aufgabe, anteilig auf ihre
  Säulen verteilt – entsprechend dem Anteil, mit dem die Aufgabe auf jede Säule einzahlt.
- Aufgaben ohne Säulen-Zuordnung fließen ins **Dashboard-Gesamtguthaben** ein, verteilt
  nach deiner Säulen-Gewichtung — in der Erledigt-Tabelle zeigen sie 0 Punkte je Spalte.
  Erledigte Arbeit wird so auch ohne zugeordnete Säule sichtbar.

Dein Gesamtstand und die Aufteilung je Säule erscheinen im Dashboard unter
**„Gesamtguthaben"**.

---

## Einstellungen

Über das **Zahnrad** in der Kopfzeile öffnest du die Einstellungen mit drei Bereichen:

### Allgemein

- **Darstellung** – die Auswahl (System, Hell, Dunkel) ist aktuell deaktiviert; die
  App nutzt durchgehend das helle Farbschema.
- **Sprachaufnahme automatisch starten** – ist der Schalter aktiv, wird beim Öffnen
  der Formulare das erste Feld fokussiert und dessen Mikrofon automatisch gestartet.
  Beim Einschalten wird der Mikrofon-Zugriff angefragt.
- **Push-Nachrichten aktivieren** – siehe „Benachrichtigungen".
- **Standort erfassen** – ermittelt alle 5 Minuten deine aktuelle Position. Beim
  Einschalten wird die Standort-Berechtigung angefragt. Mit **„Standort jetzt
  ermitteln"** holst du die Position sofort; dazu siehst du die Uhrzeit der letzten
  Erfassung und eine Adresse zum Standort.

### Säulen

Der Editor für die **Säulen-Gewichtung** (siehe „Lebensbalance-Säulen") sowie die
Verwaltung der Säulen selbst (Anlegen, Bearbeiten, Löschen – jeweils über eigene
Modal-Dialoge).

### KI-Provider

Hier wird die KI konfiguriert (Schnellerfassung, Säulen-Vorschlag, Säulen-Berater,
Lektorat). Du wählst den aktiven Provider und daraus per Dropdown das Modell – die
Modellliste wird live vom Provider geladen. Mitgelieferte Provider (Mistral, OpenRouter)
beziehen ihren Zugang vom Server; eigene Provider legst du über **„Neuer Provider"** an
(Name, Adresse, API-Key, Modell) und kannst sie **testen**, bearbeiten und löschen. Diese
Einstellung gilt serverseitig für alle Nutzer. Ist kein Provider eingerichtet, zeigt der
Tab den Hinweis, dass die KI-Features noch nicht nutzbar sind.

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
  **„Neu laden"**. Ein Klick lädt die aktuelle Version.

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
  „Beraten lassen", „Speichern" in den Einstellungen, „Endgültig löschen").
- **Esc** oder Klick außerhalb – schließt Dialoge und Menüs.

---

## Weitere Hinweise

- Alle Daten werden **serverseitig** gespeichert; Änderungen sind sofort persistent
  und auf all deinen Geräten verfügbar.
- Die KI-Funktionen (Schnellerfassung, Säulen-Vorschlag, Säulen-Berater, Lektorat) benötigen
  einen serverseitig konfigurierten Zugang. Ist er nicht eingerichtet, bleiben die
  übrigen Funktionen uneingeschränkt nutzbar.
