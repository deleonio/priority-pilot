<!--
Medium-Fachartikel (1–2-Seiter) — Fokus-Thema: „Das Zifferblatt der Lebensbalance“
Titel:      Das Bild, das nie selbst rechnet
Untertitel: Warum deine To-do-Liste die Verteilung deiner Energie nicht zeigt — und ein Bild, das es tut
Tags:       Selbstmanagement, Produkt-Design, UX-Design, Work-Life-Balance, Gewohnheiten
Bilder:     images/ (echte App-Screenshots aus der laufenden App mit Demo-Daten; vor dem
            Veröffentlichen bei Medium hochladen und an den Bildmarkern einsetzen).
Genre:      Fachartikel — Balamentum tritt als Praxisbeispiel auf.
Schwesterartikel: webdev.md (englisch, web.dev) — am Ende verlinken.
-->

# Das Bild, das nie selbst rechnet

_Warum deine To-do-Liste die Verteilung deiner Energie nicht zeigt — und ein Bild, das es tut_

Wer viel tut und trotzdem unzufrieden ist, hat selten ein Mengenproblem. Er hat ein
Verteilungsproblem. Die Energie floss diese Woche in zwei Lebensbereiche, während drei andere
leer ausgingen — und keine einzige To-do-Liste zeigt das. Sie zeigt Bestand: was offen ist, was
überfällig ist, was sich seit Wochen nicht bewegt hat. Am Sonntagabend schaust du auf eine Liste
voll erledigter Aufgaben und spürst trotzdem, dass etwas schiefstand. Die Liste sagt dir nur
nicht, was.

Das ist die Lücke, um die es in diesem Artikel geht: eine Auskunft über die Verteilung der
eigenen Energie, lesbar in Sekunden. Balamentum, eine Web-App zur Aufgabenpriorisierung, baut
diese Auskunft als Bild — ein Herz-Gefäß, das sich nach der Lebensbalance füllt. Es ist ein
lehrreiches Beispiel, weil hinter ihm eine Reihe von Entscheidungen steht, die man auch ohne die
App anwenden kann.

![Herz-Gefäß mit Säulen-Legende in Balamentum](images/screenshot-herz.png)

_Demo-Daten aus der laufenden App: 23 % „aus der Balance“ („out of balance“). Sinn liegt am
kürzesten (7 % statt 20 %), Körper zieht davon (40 % statt 20 %, also +20 Prozentpunkte über dem
Ziel). Die Legende nennt Ist, Ziel und Abstand je Säule._

## Die Kennzahl: Ist durch Ziel, ungedeckelt

Die Kennzahl hinter dem Bild ist das Verhältnis von geleisteter Investition zum Zielwert je
Säule. Zwölf Prozent Aufwand bei einem Ziel von 20 ergeben 0,6; dreißig Prozent bei 20 ergeben
1,5. Für die Anzeige wird der Wert bewusst nicht bei 1,0 abgeschnitten: Übererfüllung ist
genauso eine Aussage wie Rückstand, und die Anzeige soll beide zeigen.

Die Gesamt-Balance rechnet dabei strenger, als die Gewichte es nahelegen. Sie misst doppelt —
einmal als Abweichung gegen die Zielgewichte, einmal als Abweichung ohne Gewichtung, wobei jede
Säule mit Ziel einzeln zählt — und der niedrigere Wert zählt. Ein Rechenbeispiel: 60/0/10/10/10
auf Säulen mit den Gewichten 60/10/10/10/10. Die gewichtete Messung ergibt 0,67 und würde als
„gut in Balance“ durchgehen; die ungewichtete Prüfung zieht denselben Fall auf 0,55, in die
leichte Schieflage. Eine leere Säule fällt immer auf, egal wie klein ihr Ziel ist.

## Neun Zifferblätter, eine Auskunft

Das Herz ist eine von neun Darstellungen derselben Rechnung: Herz, Blasen, Scheiben, Ringe,
Strahlen, Blüte, Kristall, Segmente, Zeiger. Alle folgen ein und derselben Regel — die Säule mit
der größten Kennzahl bekommt die größte Form — und unterscheiden sich nur im Material: Die Blase
legt ihre Farbe in eine dünne Haut und lässt den Hintergrund durchscheinen, die Scheibe ist eine
satte Fläche mit harter Kante, der Kristall bricht die Kontur kantig mit hellen Knoten.

![Die neun Zifferblätter als Galerie](images/zifferblatt-galerie.png)

_Alle neun Varianten aus der laufenden App (Demo-Daten): Herz, Blasen, Scheiben, Ringe,
Strahlen, Blüte, Kristall, Segmente, Zeiger — dieselbe Auskunft in neun Materialien. Die Blase
von der Material-Beschreibung oben ist die zweite Kachel; dünnhäutig sieht man es ihr an._

Das Wählen kann Teil der Methode sein. Wer sein Gleichgewicht täglich ansieht, liest
vermutlich die Form ohne Übersetzung, die ihm liegt; gespeichert wird die Wahl pro Gerät, das
Herz ist die Voreinstellung.

## Mobil zuerst, Bewegung abbestellbar

Das Dashboard ist zuerst für das Handy gebaut; die schmalste Viewport-Breite der App liegt bei
375 Pixeln. Die Figur pulsiert mit einem Ruhepuls zwischen 1,5 und 2,6 Sekunden, dessen Dauer am
Füllstand hängt — je voller das Herz, desto ruhiger der Puls. Anzeige statt Alarm. Und wer keine
Bewegung mag, stellt sie ab; dann bleibt dasselbe vollständige Bild, nur still.

![Dashboard auf dem Handy](images/screenshot-dashboard-mobil.png)

_Der Handy-Bildschirm zeigt einen anderen Demo-Stand (26 %) als das erste Bild — dasselbe Bild,
nur auf 375 Pixel Breite._

## Für das eigene Dashboard

Drei der Entscheidungen lassen sich ohne die App nachbauen:

1. Miss je Lebensbereich das Verhältnis Ist zu Ziel — und lass Übererfüllung sichtbar, statt es
   bei 100 % zu kappen.
2. Rechne die Gesamtbilanz doppelt, mit und ohne Gewichtung, und lass den niedrigeren Wert
   zählen. Eine leere Säule darf sich nicht hinter ihrem kleinen Ziel verstecken.
3. Wähle eine Anzeigeform, die du täglich in Sekunden liest — das Bild ist nur so viel wert wie
   die Häufigkeit, mit der du es ansiehst.

Balamentum setzt diese Methode als [Web-App](https://balamentum.modevel.de) um, dazu als
Android-App. Wie dasselbe Bild in zwei Renderern entsteht und wie die Farben gegen
Farbsehschwächen gerechnet werden, beschreibt der Schwesterartikel auf web.dev.
