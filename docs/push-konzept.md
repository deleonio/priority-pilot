# Push-Konzept — Anlässe, Ziele, Zeitfenster

Legt fest, welche Push-Nachrichten die App verschickt, wohin ein Tipp darauf führt, wann sie
zugestellt werden und welcher Schalter sie steuert. Grundlage für die Umsetzungs-Issues am Ende
(#2844). Schwesterdokumente: [Fürsorge-Tonalität](fuersorge-tonalitaet.md) (Ton und Prüffrage),
[Mobile-UI-Regeln](mobile-ui-rules.md), [ADR 0018](adr/0018-preismodell-free-plus-pro.md)
(Paketgrenzen und Upgrade-Hinweise).

## 1. Ausgangslage

Alle fachlichen Pushes laufen über `sendDedupedPush`/`sendDedupedPushBulk`
(`server/src/logics/dedupedPush.ts`). Die Dedupe nutzt `notification_logs` (`kind` + `dedupeKey`),
ein Eintrag entsteht erst nach erfolgreicher Zustellung. Die Nutzlast trägt `title`, `body` und
`url` (`PushPayload`, `server/src/logics/push.ts`). Der Klick-Weg ist im Web `notificationclick` in
`frontend/public/push-sw.js`, in der Android-App `listenForNativePushTaps` in
`frontend/src/lib/push.ts`. Beide lösen `url` ab der App-Wurzel `/app/` auf.

Befunde, die dieses Konzept beheben soll:

- **Ziel fehlt.** Acht von zehn Push-Arten schicken `url: '/'`. Wer „Meilenstein erreicht“ antippt,
  landet oben auf dem Dashboard und findet die Meilenstein-Karte erst nach langem Scrollen.
  Dashboard-Karten haben keinen Anker, Hash-Scrolling gibt es nicht.
- **Zeitfenster liefen ins Leere.** Der Scheduler (`server/src/scheduler/index.ts`) rief alle
  Trigger einmal pro UTC-Tag um 8 UTC auf (seit #2858 stündlich, Abschnitt 3). Die
  Streak-Erinnerung sendet nur zwischen 18 und 21 Uhr Ortszeit und kommt deshalb in Europa nie an.
  Fällige Aufgaben und Top-Aufgaben treffen in Deutschland um 9 oder 10 Uhr ein, nicht am Morgen.
- **Pushes verdrängen sich.** Der Service Worker setzt für jede Nachricht `tag: 'priority-pilot'`.
  Fällige Aufgaben und Top-Aufgaben kommen im selben Lauf, die zweite ersetzt die erste. Die
  Android-App (`server/src/logics/fcm.ts`) setzt keinen Tag, dort stapeln sich alle.
- **Der In-App-Hinweis führt nirgends hin.** `PushToast` zeigt Titel und Text bei offener App,
  bietet aber keinen Weg zum Ziel.
- **Wichtige Ereignisse bleiben stumm.** Gruppeneinladungen, eine fehlgeschlagene Zahlung, das
  Ende einer Kulanzfrist und neue Rechnungen erzeugen höchstens eine Mail. Abo-Ereignisse aus
  Google Play erzeugen gar nichts.
- **Kaum Wahl (vor #2850).** Es gab nur den Hauptschalter und „Fürsorge-Hinweise“ (`users.carePushEnabled`); seit #2850 ergänzen die fünf Gruppenschalter aus §5 die Wahl.

## 2. Ziele

### 2.1 Format

Ein Ziel ist ein App-Pfad, optional mit Query und Anker: `/<pfad>[?query][#anker]`. Anker tragen
ein festes Präfix je Fläche, damit sie sich nicht mit anderen IDs der Seite schneiden:

| Fläche             | Anker-Schema    | Beispiel                      |
| ------------------ | --------------- | ----------------------------- |
| Dashboard-Karte    | `#karte-<name>` | `/#karte-streak`              |
| Gruppe             | `#gruppe-<id>`  | `/settings/gruppen#gruppe-12` |
| Einstellungs-Block | `#<name>`       | `/settings/pakete#rechnungen` |

Die erlaubten Anker stehen in **einer** Liste auf dem Server (Ziele je Push-Art) und als Spiegel im
Frontend (IDs an den Karten). Ein Spiegel-Test gleicht beide ab
([ADR 0025](adr/0025-geteilte-fachlogik-duplikat-spiegel-tests.md)).

Anker der Dashboard-Karten (`frontend/src/components/Dashboard.tsx`):

| Anker                    | Karte                         | sichtbar                        |
| ------------------------ | ----------------------------- | ------------------------------- |
| `karte-balance`          | Herz/Zifferblatt              | immer                           |
| `karte-willkommen`       | Willkommensschritte           | bis alle Schritte erledigt sind |
| `karte-fuersorge`        | Fürsorge-Hinweis (`CareHint`) | wenn ein Hinweis anliegt        |
| `karte-freie-zeit`       | Freie Zeit                    | mit verbundenem Kalender        |
| `karte-top-aufgaben`     | Top-Aufgaben                  | wenn offene Aufgaben existieren |
| `karte-streak`           | Streak                        | immer                           |
| `karte-wochenrueckblick` | Wochenbilanz                  | nur sonntags                    |
| `karte-monatsrueckblick` | Monatsbilanz                  | Tag 1 bis 7 des Monats          |
| `karte-jahresrueckblick` | Jahresrückblick               | nur im Januar                   |
| `karte-meilensteine`     | Meilenstein-Abzeichen         | immer                           |
| `karte-deadlines`        | Deadlines                     | wenn Deadlines anstehen         |

### 2.2 Verhalten beim Öffnen

1. Die App öffnet die Route. Web: `notificationclick` fokussiert ein offenes Fenster und navigiert
   es. Android: `listenForNativePushTaps` schreibt den Verlaufseintrag und löst `popstate` aus.
2. Trägt das Ziel einen Anker, scrollt die Seite **nach dem ersten Rendern mit Daten** zur
   Karte (`scrollIntoView`, Vorbild: der Sprung der Willkommensschritte zum Fürsorge-Hinweis in
   `Dashboard.tsx`) und setzt den Fokus auf deren Überschrift, damit Screenreader die Karte ansagen.
   `prefers-reduced-motion` schaltet die Scroll-Animation ab.
3. Danach entfernt die App den Anker aus der Adresse (`replace`), sonst springt ein Neuladen
   erneut.
4. Ist die Karte nicht gerendert (Hinweis schon erledigt, Monatsfenster vorbei), bleibt das
   Dashboard oben stehen. Es gibt keine Fehlermeldung.
5. `/tasks/<id>` öffnet wie heute die Aufgabe im Bearbeiten-Dialog. Gibt es die Aufgabe nicht
   mehr, zeigt die App einen kurzen Hinweis („Diese Aufgabe gibt es nicht mehr.“) statt still auf
   dem Dashboard zu landen.
6. Kommt ein Push bei offener App an, bekommt der In-App-Hinweis (`PushToast`) eine Aktion
   „Öffnen“ mit demselben Ziel.

Damit Push und Karte nicht auseinanderlaufen, gilt für zeitgebundene Karten: **Der Push geht nur in
dem Zeitraum raus, in dem die Zielkarte sichtbar ist** (Wochenrückblick am Sonntag, Monatsrückblick
an Tag 1 bis 7, Jahresrückblick im Januar).

### 2.3 Gruppierung in der Mitteilungszentrale

Statt eines Tags für alles bekommt jede Schaltergruppe (Abschnitt 5) einen eigenen Tag:
`pp-aufgaben`, `pp-fuersorge`, `pp-erfolge`, `pp-gruppen`, `pp-abo`, `pp-tipps`. Eine neue
Fürsorge-Nachricht ersetzt die alte, verdrängt aber keine Zahlungs-Nachricht. Für Android gilt
dasselbe über das `tag`-Feld der FCM-Notification.

## 3. Zeitmodell

Der Scheduler ruft die Trigger **stündlich** auf statt einmal am Tag. Jeder Trigger prüft je
Nutzer selbst, ob dessen lokales Zeitfenster offen ist (`users.zeitzone`, Fallback UTC — so wie
`carePush.ts` und `streakReminder.ts` es schon tun). Die Dedupe je lokalem Tag verhindert doppelte
Zustellung, auch wenn das Fenster mehrere Läufe umfasst.

| Fenster (Ortszeit) | Wofür                                                             |
| ------------------ | ----------------------------------------------------------------- |
| Morgen 07–09 Uhr   | „Dein Tag“: fällige Aufgaben und Top-Aufgaben in einer Nachricht  |
| Tag 09–18 Uhr      | Fürsorge, Rückblicke, Service-Nachrichten, nachgeholte Ereignisse |
| Abend 18–21 Uhr    | Streak-Erinnerung, Journal-Impuls                                 |
| Ruhezeit 21–07 Uhr | keine Zustellung                                                  |

Das Morgenfenster beginnt um 07 Uhr, die bisherige Ruhezeit-Grenze 08 Uhr aus `carePush.ts` rückt
für alle Arten auf 07 Uhr. Fürsorge-Hinweise bleiben im Tagesfenster.

**Ereignis-Pushes** (jemand legt eine Aufgabe für mich an, eine Einladung kommt) gehen sofort
raus, außer in der Ruhezeit. Fällt ein Ereignis in die Ruhezeit, entfällt der Push, der Inhalt
ist ja in der App sichtbar. Ausnahmen sind offene Einladungen und Service-Nachrichten: Die holt der
erste stündliche Lauf nach 07 Uhr nach, wenn sie dann noch zutreffen (Einladung nicht angenommen,
Zahlung weiter offen).

**Ortserinnerungen** (`geo-nearby-task`) bleiben ereignisgetrieben, halten aber die Ruhezeit ein.

## 4. Push-Budget

- **Höchstens drei Pushes je Nutzer und lokalem Tag** über alle Arten zusammen. Gezählt wird über
  `notification_logs` (`userId`, `sentAt` im lokalen Tag), es entsteht keine neue Tabelle.
- **Service-Nachrichten** (Abschnitt 6, Gruppe Abo & Rechnungen) zählen nicht mit und werden nie
  vom Budget verdrängt.
- **Vorrang** bei vollem Budget, von oben nach unten:
  1. Direkt an mich gerichtet: Aufgabe für mich angelegt, Gruppeneinladung
  2. Ortserinnerung
  3. „Dein Tag“ (fällige Aufgaben und Top-Aufgaben)
  4. Fürsorge-Hinweis, Streak-Erinnerung
  5. Erfolge und Rückblicke
  6. Tipps und Angebote
- **Bündeln:** Fällige Aufgaben und Top-Aufgaben werden zu einem Morgen-Push „Dein Tag“. Fallen
  Wochen- und Monatsrückblick auf denselben Tag, geht nur der Monatsrückblick raus. Ein Lob ersetzt
  an diesem Tag den Fürsorge-Hinweis, es kommt nie beides.

## 5. Schalter

Unter „Einstellungen → Allgemein → Benachrichtigungen“ (`SettingsPage.tsx`) bleibt der
Hauptschalter. Darunter stehen fünf Gruppen:

| Schalter                  | Enthält                                                          | Standard |
| ------------------------- | ---------------------------------------------------------------- | -------- |
| Aufgaben und Erinnerungen | Dein Tag, Aufgaben anderer Personen, Serien, Willkommensschritte | an       |
| Fürsorge                  | Fürsorge-Hinweis, Lob, Streak, Journal-Impuls, Willkommen zurück | an       |
| Erfolge und Rückblicke    | Meilensteine, Wochen-, Monats- und Jahresrückblick               | an       |
| Gruppen                   | Einladungen, angenommene Einladungen, Challenges                 | an       |
| Tipps und Angebote        | nutzungsbezogene Hinweise auf Plus und Pro                       | **aus**  |

- Ortserinnerungen haben ihren Schalter schon unter „Einstellungen → Ortung“ und bleiben dort.
- **Abo und Rechnungen** hat keinen eigenen Schalter. Diese Service-Nachrichten betreffen den
  Vertrag. Sie lassen sich nur mit dem Hauptschalter abstellen, die Mail geht in jedem Fall raus.
- Der bestehende Schalter `carePushEnabled` wird zum Schalter „Fürsorge“, die übrigen kommen als
  Boolean-Felder an `users` hinzu.

## 6. Bestand: Ziele der zehn Push-Arten

| Kind               | Anlass                                   | Beispieltext (de)                                                 | heute         | künftig                                                      | Fenster, Häufigkeit            | Schalter                  | Paket     |
| ------------------ | ---------------------------------------- | ----------------------------------------------------------------- | ------------- | ------------------------------------------------------------ | ------------------------------ | ------------------------- | --------- |
| `due-task`         | Deadline in den nächsten 24 h            | „Fällige Aufgaben – Du hast 3 fällige oder überfällige Aufgaben.“ | `/`           | eine Aufgabe: `/tasks/<id>`, mehrere: `/#karte-deadlines`    | Morgen, 1/Tag, in „Dein Tag“   | Aufgaben und Erinnerungen | alle      |
| `daily-top-tasks`  | Bis zu drei wichtigste Aufgaben          | „Deine wichtigsten Aufgaben – Steuer, Laufen, Oma anrufen“        | `/`           | eine Aufgabe: `/tasks/<id>`, mehrere: `/#karte-top-aufgaben` | Morgen, 1/Tag, in „Dein Tag“   | Aufgaben und Erinnerungen | alle      |
| `care-push`        | Säule im Defizit oder überlastet         | „Dein Körper könnte eine Pause gebrauchen …“                      | `/`           | `/#karte-fuersorge`                                          | Tag, 1/Tag                     | Fürsorge                  | alle      |
| `streak-reminder`  | Heute noch nichts erledigt, Streak läuft | „Deine Streak wartet – eine kleine Aufgabe heute hält sie.“       | `/aufgaben`   | `/#karte-streak`                                             | Abend, 1/Tag, nicht am Ruhetag | Fürsorge                  | alle      |
| `monthly-recap`    | Neuer Monat                              | „Dein Monatsrückblick ist da“                                     | `/`           | `/#karte-monatsrueckblick`                                   | Tag, Tag 1 bis 7, 1/Monat      | Erfolge und Rückblicke    | alle      |
| `milestone`        | Streak- oder Punkte-Meilenstein          | „Meilenstein erreicht! 30 Tage Streak am Stück.“                  | `/`           | `/#karte-meilensteine`                                       | Ereignis                       | Erfolge und Rückblicke    | alle      |
| `task-created`     | Jemand legt eine Aufgabe für mich an     | „Neue Aufgabe von Anna – „Fenster putzen“ …“                      | `/`           | `/tasks/<id>`                                                | Ereignis                       | Aufgaben und Erinnerungen | alle      |
| `task-completed`   | Jemand erledigt meine Aufgabe            | „Aufgabe erledigt – Anna hat „Fenster putzen“ erledigt.“          | `/`           | `/tasks/<id>`                                                | Ereignis                       | Aufgaben und Erinnerungen | alle      |
| `series-generated` | Jemand erzeugt Serien-Aufgaben für mich  | „Neue Aufgaben von Anna – „Haushalt“: 4 neue Aufgaben.“           | `/`           | `/serien`                                                    | Ereignis                       | Aufgaben und Erinnerungen | alle      |
| `geo-nearby-task`  | Aufgabe mit Ort in der Nähe              | „Apotheke – 0,3 km“                                               | `/tasks/<id>` | bleibt                                                       | Ereignis, je Aufgabe 1/24 h    | Ortung                    | Plus, Pro |

Bei `due-task` und `daily-top-tasks` gilt nach der Bündelung „Dein Tag“: Steht genau eine Aufgabe
in der Nachricht, öffnet sie diese Aufgabe. Stehen mehrere drin, öffnet sie die Karte
`#karte-deadlines`, sobald eine fällige dabei ist, sonst `#karte-top-aufgaben`.

## 7. Neue Anlässe

Bewertung aller Vorschläge aus #2844, ergänzt um zwei Anlässe aus der Analyse. Beispieltexte
folgen der [Prüffrage](fuersorge-tonalitaet.md#2-die-prüffrage): Jeder Text bietet einen Schritt,
eine Erlaubnis oder Anerkennung an.

### 7.1 Fürsorge und Produkt

| Anlass                                      | Bewertung  | Begründung                                                                                                                          | Ziel, Fenster, Häufigkeit, Schalter                                                                                                                                 | Beispieltext                                                                     |
| ------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Lob bei guter Balance                       | übernehmen | Die Lob-Texte gibt es schon in der Tonalität, bisher nur auf dem Dashboard. Anerkennung bindet stärker als Mahnung.                 | `/#karte-balance`, Tag, höchstens 1/Woche, nur ohne Defizit und Überlast, Fürsorge                                                                                  | „Du pflegst deine Beziehungen mit viel Wärme. Diese Verbindungen tragen dich.“   |
| Wochenrückblick                             | übernehmen | Die Karte gibt es schon, sie wird aber nur gesehen, wenn man sonntags zufällig öffnet.                                              | `/#karte-wochenrueckblick`, Sonntag 17–20 Uhr, 1/Woche, Erfolge und Rückblicke                                                                                      | „Deine Woche in einem Bild: Schau, wo du dir gutgetan hast.“                     |
| Jahresrückblick                             | übernehmen | Einmal im Jahr, hoher Wiedererkennungswert, die Karte steht im Januar.                                                              | `/#karte-jahresrueckblick`, 2. Januar, Tag, 1/Jahr, Erfolge und Rückblicke                                                                                          | „Dein Jahr ist rund. Ein Blick zurück auf alles, was du bewegt hast.“            |
| Überlast-Hinweis                            | ändern     | Ist schon Teil von `care-push` (Überlast hat Vorrang vor Defizit). Kein eigener Anlass, nur das Ziel aus Abschnitt 6.               | wie `care-push`                                                                                                                                                     | „Deine Liste ist lang, dein Tag hat Grenzen. Wähle eine Sache, die heute zählt.“ |
| Freie Zeit im Kalender                      | ändern     | Ein eigener Push wäre ein vierter am Tag. Als Satz im Morgen-Push „Dein Tag“ bringt er denselben Nutzen ohne zusätzliche Nachricht. | Zusatzzeile in „Dein Tag“, nur mit verbundenem Kalender; Ziel `/#karte-freie-zeit`, wenn keine Aufgabe im Push steht                                                | „… Heute Nachmittag hast du zwei Stunden frei.“                                  |
| Aufgaben nach Deadline automatisch entfernt | verwerfen  | Der Text könnte nur protokollieren („3 Aufgaben entfernt“) und fällt durch die Prüffrage. Die Karte „Verpasste Aufgaben“ reicht.    | –                                                                                                                                                                   | –                                                                                |
| Abendlicher Journal-Impuls                  | ändern     | Nur für Menschen, die das Journal nutzen, sonst wirkt er wie Werbung für eine Funktion.                                             | `/journal`, Abend, höchstens 2/Woche, nur bei Journal-Eintrag in den letzten 30 Tagen, Fürsorge                                                                     | „Was war heute gut? Ein Satz im Journal reicht.“                                 |
| Willkommensschritte nicht abgeschlossen     | übernehmen | Wer nach zwei Tagen nicht weiter eingerichtet hat, bekommt sonst nie die Fürsorge-Funktionen zu sehen.                              | `/#karte-willkommen`, Tag, einmalig am 2. Tag nach Registrierung, Aufgaben und Erinnerungen                                                                         | „Zwei kleine Schritte fehlen noch, dann kennt die App deine Säulen.“             |
| Willkommen zurück (aus der Analyse)         | übernehmen | Rückkehr nach einer Pause ist der wichtigste Moment für die Bindung. Ohne Schuld, mit einem kleinen Einstieg.                       | `/#karte-balance`, Tag, nach 7 Tagen ohne angelegte oder erledigte Aufgabe (ein Zeitstempel der letzten App-Öffnung fehlt bisher), höchstens 1 je 30 Tage, Fürsorge | „Schön, dass es dich gibt. Wenn du magst: eine kleine Aufgabe für heute wartet.“ |

### 7.2 Gruppen

| Anlass                                         | Bewertung  | Begründung                                                                                                                         | Ziel, Fenster, Häufigkeit, Schalter                                                      | Beispieltext                                                                      |
| ---------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Einladung in eine Gruppe erhalten              | übernehmen | Heute erfährt die eingeladene Person nichts, wenn sie die App nicht öffnet. Einladungen veralten dann ungesehen.                   | `/settings/gruppen#einladungen`, Ereignis (Ruhezeit: nachholen), 1 je Einladung, Gruppen | „Anna lädt dich in die Gruppe „Familie“ ein.“                                     |
| Einladung angenommen, Einladungslink eingelöst | übernehmen | Die einladende Person sieht, dass es losgehen kann.                                                                                | `/settings/gruppen#gruppe-<id>`, Ereignis, 1 je neuem Mitglied, Gruppen                  | „Ben ist jetzt in „Familie“ dabei.“                                               |
| Challenge gestartet, Zwischenstand, Ende       | ändern     | Start und Ende übernehmen. Zwischenstände erzeugen Wettbewerbsdruck und Lärm, das passt nicht zur Fürsorge.                        | `/settings/gruppen#gruppe-<id>`, Ereignis, 2 je Challenge, Gruppen                       | „Die Challenge in „Familie“ ist geschafft – schaut euch an, was ihr bewegt habt.“ |
| Duo-Partner hat etwas erledigt                 | verwerfen  | Erledigte gemeinsame Aufgaben meldet schon `task-completed`. Meldungen über jede Aktivität der anderen Person kippen in Kontrolle. | –                                                                                        | –                                                                                 |

### 7.3 Abo und Rechnungen

| Anlass                                         | Bewertung  | Begründung                                                                                                                                                                                                               | Ziel, Fenster, Häufigkeit, Schalter                                                    | Beispieltext                                                               |
| ---------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Neue Rechnung oder Gutschrift                  | übernehmen | Service-Nachricht. Die Mail mit PDF bleibt als Beleg, der Push führt direkt zur Liste.                                                                                                                                   | `/settings/pakete#rechnungen`, Tag, 1 je Rechnung, Service                             | „Deine Rechnung für Oktober ist da.“                                       |
| Zahlung fehlgeschlagen, Kulanzfrist, Abo endet | übernehmen | Service-Nachricht. Heute nur Mail (PayPal) oder gar nichts (Google Play). Ohne Hinweis verliert die Person Funktionen, ohne es zu merken.                                                                                | `/settings/pakete`, Tag, je Zustand 1, Kulanzfrist zusätzlich 3 Tage vor Ende, Service | „Deine Zahlung hat nicht geklappt. Bis zum 3. November bleibt Plus aktiv.“ |
| Abo aktiv: „Das ist jetzt neu“                 | verwerfen  | Wer gerade bezahlt hat, ist in der App. Die Einführung gehört dorthin, nicht in einen Push.                                                                                                                              | –                                                                                      | –                                                                          |
| Paketgrenze erreicht                           | verwerfen  | Die KI-Grenze ist nach [ADR 0018](adr/0018-preismodell-free-plus-pro.md) Entscheidung 4 unsichtbar und kein Verkaufsargument. Die Kalendergrenze trifft man in der App, dort greift der Inline-Hinweis (Entscheidung 6). | –                                                                                      | –                                                                          |
| Nutzungsbezogener Plus-Hinweis                 | ändern     | Nur mit Opt-in und nur mit konkretem Nutzungssignal, sonst ist es Werbung, die niemand bestellt hat. Regeln in Abschnitt 8.                                                                                              | `/settings/pakete`, Tag, höchstens 1 je 30 Tage, Tipps und Angebote                    | siehe Abschnitt 8                                                          |

## 8. Tipps und Angebote

Pushes, die zum Abo motivieren, sind Werbung. Sie folgen strengeren Regeln als alle anderen:

- **Nur mit Einwilligung.** Schalter „Tipps und Angebote“, Standard aus. Der Schalter erklärt in
  einem Satz, was kommt („Höchstens einmal im Monat ein Hinweis auf eine Funktion, die zu deiner
  Nutzung passt.“). Abschalten geht an derselben Stelle.
- **Höchstens ein Push je 30 Tage**, nur für Free-Konten, nie in den ersten 7 Tagen nach der
  Registrierung.
- **Nur mit Nutzungssignal.** Der Hinweis nennt eine Funktion, die zu etwas passt, das die Person
  schon tut. Kandidaten:
  - mindestens drei Aufgaben mit Ort → Ortserinnerungen (Plus)
  - mindestens drei Aufgaben für andere Personen angelegt → Gruppen (Plus)
- **Nie die Fürsorge als Hebel.** Die Fürsorge gehört vollständig in Free
  ([ADR 0018](adr/0018-preismodell-free-plus-pro.md), Grundsatz 3). Kein Text verknüpft Balance,
  Streak oder Wohlbefinden mit einem Kauf.
- **Prüffrage gilt.** Der Text bietet einen Nutzen an, er drängt nicht. Erlaubt: „Deine Aufgaben
  mit Ort können sich melden, wenn du in der Nähe bist. Das kann Plus.“ Nicht erlaubt: „Nur noch
  heute: Plus zum Sonderpreis!“
- **Trennung Werbung und Service.** Abo- und Rechnungs-Nachrichten (Abschnitt 7.3) enthalten nie
  einen werblichen Satz. Vor dem Livegang prüft das [Rechts-Team](../.claude/skills/rechts-team/SKILL.md)
  Einwilligungstext und Trennung.
- **Freigabe (2026-10-24, #2880).** Der Einwilligungstext (Satz am Schalter „Tipps und
  Angebote“) ist vom Autor pragmatisch freigegeben — eine externe Rechtsberatung liegt nicht
  vor und ist vor dem echten Marktstart nachzuholen. Die Zuordnung gilt damit:
  Tipps-und-Angebote-Pushes sind Einwilligungswerbung, die Service-Nachrichten aus
  Abschnitt 7.3 bleiben werbefrei.

## 9. Lösungsplan — Issue-Schnitt

Alle Issues höchstens „Mittel“. Sie entstehen mit dem Skill [Ticket-Baum](../.claude/skills/ticket-tree/SKILL.md)
unter einem Epic „Push-Nachrichten mit Ziel“ als Nachfolger von #2844, mit nativen
`blocked-by`-Beziehungen gemäß Spalte „Hängt ab von“.

| Nr  | Issue                                                                                                                                 | Größe  | Hängt ab von | Welle |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------ | ----- |
| 1   | `[P1/M]` Push-Ziele öffnen: Anker an Dashboard-Karten, Scrollen und Fokus, „Öffnen“ im In-App-Hinweis, Hinweis bei gelöschter Aufgabe | Mittel | –            | 1     |
| 2   | `[P1/M]` Zeitmodell: Scheduler stündlich, lokale Fenster je Trigger, Ruhezeit 21–07 Uhr                                               | Mittel | –            | 1     |
| 3   | `[P1/S]` Bestands-Pushes auf ihre Ziele umstellen, Ziel-Liste mit Spiegel-Test                                                        | Klein  | 1            | 2     |
| 4   | `[P2/M]` Push-Budget, Vorrang, „Dein Tag“-Bündel und Tags je Gruppe (Web und FCM)                                                     | Mittel | 2            | 2     |
| 5   | `[P2/M]` Schaltergruppen unter Benachrichtigungen                                                                                     | Mittel | –            | 1     |
| 6   | `[P1/M]` Service-Pushes Abo und Rechnungen (PayPal, Google Play, Rechnungen, Kulanzfrist)                                             | Mittel | 1, 2         | 2     |
| 7   | `[P2/M]` Gruppen-Pushes: Einladung, neues Mitglied, Challenge Start und Ende                                                          | Mittel | 1, 2, 5      | 3     |
| 8   | `[P2/M]` Fürsorge-Erweiterung: Lob, Wochen- und Jahresrückblick, Journal-Impuls, Willkommensschritte, Willkommen zurück               | Mittel | 3, 4, 5      | 3     |
| 9   | `[P3/M]` Tipps und Angebote: Einwilligung, Nutzungssignale, Obergrenze, Prüfung durch das Rechts-Team                                 | Mittel | 4, 5         | 4     |
| 10  | `[P3/S]` Benutzerhandbuch: Abschnitt Benachrichtigungen                                                                               | Klein  | 5–9          | 4     |

Kritischer Pfad: 2 → 4 → 8 → 9. Issue 2 behebt nebenbei die Streak-Erinnerung, die heute in Europa
nie ankommt, und kann deshalb vor allen anderen starten.
