<!--
Medium-Fachartikel (1–2-Seiter) — Fokus-Thema: „Rückmeldungen ohne Druck“
Titel:      Ein Streak, der nichts nehmen kann
Untertitel: Wie Balamentum Fortschritt zählt, ohne Schulden zu erzeugen — und was dabei an Grenzen bleibt
Tags:       Produkt-Design, Gewohnheiten, Psychologie, UX-Design, Motivation
Bilder:     images/ (echte App-Screenshots aus der laufenden App mit Demo-Daten; vor dem
            Veröffentlichen bei Medium hochladen und an den Bildmarkern einsetzen).
Genre:      Fachartikel — Balamentum tritt als Praxisbeispiel auf.
Schwesterartikel: webdev.md (englisch, web.dev) und devto.md (englisch, dev.to) — am Ende verlinken.
-->

# Ein Streak, der nichts nehmen kann

_Wie Balamentum Fortschritt zählt, ohne Schulden zu erzeugen — und was dabei an Grenzen bleibt_

Kennst du das? Die Kette hält seit drei Wochen, du öffnest die App jeden Abend — und dann
passiert ein Tag. Krankheit, Überstunden, ein Umzug, was auch immer. Am nächsten Morgen
zeigt dir dieselbe App einen auf null gefallenen Zähler, und der Grund, warum du die App
installiert hattest, fühlt sich plötzlich wie eine Schuld an. Manche Menschen deinstallieren an
genau diesem Punkt; der Zähler, der sie täglich abholte, ist der Grund, warum sie ihn meiden.

Das Problem ist nicht der Zähler. Es ist, dass er nimmt. Balamentum, eine Web-App zur
Aufgabenpriorisierung, führt trotzdem einen Streak — gebaut nach vier Regeln, die ihn zum reinen
Sammeln machen.

![Streak-Card in Balamentum](images/screenshot-streak-card.png)

_Demo-Stand aus der laufenden App: „1 Tag in Folge erledigt, 1 Tag Bestmarke“ — laufende Folge
und Bestmarke unterscheiden sich erst, wenn eine Lücke lag; die Card legt offen, wie gezählt
wird._

## Die vier Regeln

**1. Der laufende Tag zählt noch nicht als Bruch.** Reicht die Folge bis gestern, bleibt sie
stehen — der Tag ist ja nicht vorbei. Erst eine echte Lücke setzt den Zähler sichtbar auf null.

**2. Die Bestmarke überdauert jede Lücke.** Sie ist ein Rekord, kein Guthaben, das verfällt.
Eine Lücke kostet die laufende Folge, niemals den Rekord.

**3. Eine verspätete Erledigung rettet den Fälligkeitstag.** Wird eine Aufgabe nach ihrer
Fälligkeit abgehakt — egal wie viel später —, zählt auch der vorgesehene Tag als erfüllt.
Nachreichen löscht keinen Fortschritt.

**4. Die Zählregel steht in der App.** Aufklappbar hinter „So zählt der Streak“. Ein Zähler mit
offener Regel ist ein Werkzeug; ein Zähler mit geheimer Regel wirkt wie ein Gegner, der nach
eigenem Ermessen straft.

Diese Regeln schützen gegen den Kalender, nicht gegen den Papierkorb: Wer eine Erledigung
löscht, nimmt den Tag aus der Zählung. Das ist gewollt — die Zählung folgt dem, was steht — aber
es gehört zur Ehrlichkeit des Designs dazu.

## Rückmeldung, die ruhiger wird, je besser es steht

Neben dem Streak zeigt das Dashboard die Lebensbalance als Herz-Gefäß. Sein Ruhepuls dauert
zwischen 1,5 und 2,6 Sekunden, und die Dauer hängt am Füllstand: je voller das Herz, desto
ruhiger der Puls. Kein Alarm bei Schieflage, kein rot blinkendes Symbol.

Die Rechnung dahinter kann nicht durch Überarbeitung gewonnen werden: Wer das Soll einer Säule
übererfüllt, verbessert die Gesamt-Balance dadurch nicht — die Anzeige zeigt die Übererfüllung
trotzdem deutlich, nur der Gesamtwert zahlt nichts darauf ein. Überlast ist keine Strategie für
den Zähler.

![Dashboard mit Herz, Statistik und Fürsorge-Hinweis](images/screenshot-dashboard-desktop.png)

_Demo-Stand: 13 erledigt, 3 offen — und eine Fürsorge-Karte, die auch dann etwas anbietet, wenn
sie nichts vorzuschlagen hat._

## Die Prüffrage für jeden Text

Jeder Hinweis der App muss eine Frage bestehen: Sorgt der Text, oder protokolliert er nur? Ein
protokollierender Text stellt fest und klagt an („Du hast deine Körper-Säule vernachlässigt“).
Ein sorgender Text bietet heute etwas an, klein genug, um es zu tun, und urteilt nicht.

Auch die Leere passiert diese Prüfung. Wenn die App nichts vorzuschlagen hat, steht es genau so
da — und die Krisen-Zeile, die immer mit an Bord ist, gehört zum Ton: sie begleitet, sie
alarmiert nicht.

![Fürsorge-Hinweis mit TelefonSeelsorge-Zeile](images/screenshot-care-hint.png)

_„Gerade gibt es keinen Vorschlag für dich. Mach in deinem Tempo weiter.“ Wörter wie
„vernachlässigt“ oder „verpasst“ kommen in diesen Texten nicht vor._

## Für das eigene Dashboard

Drei Entscheidungen lassen sich ohne die App nachbauen:

1. Zähle Fortschritt additiv: Beste Folge als Rekord führen, den laufenden Tag nicht vorzeitig
   als Bruch werten, nachgereichte Erledigungen für ihren geplanten Tag zählen lassen.
2. Miss jede Rückmeldung an einer Frage: Beobachtet sie, oder urteilt sie? Zu jedem Befund gehört
   ein kleiner, heute möglicher Schritt.
3. Markiere Erfolg leise und immer abbestellbar — eine Notiz statt einer Sirene.

Ob das Verhalten nutzerwirksam ist, kann ich noch nicht mit Zahlen belegen; belegbar ist der
Bau. Der Streak kann nicht mehr kollabieren als auf den heutigen Stand, die Bestmarke bleibt,
und keine Rückmeldung ruft den Misserfolg.

Balamentum läuft als [Web-App](https://balamentum.modevel.de), dazu als Android-App. Für
Web-Teams zeigt der Schwesterartikel auf web.dev die technischen Grundsätze, auf dev.to den
Feldbericht mit den vier Regeln im Detail.
