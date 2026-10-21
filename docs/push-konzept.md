# Push-Konzept: Jede Nachricht führt zu ihrem Thema

Push-Nachrichten in Balamentum haben zwei Schwächen: Fast jeder Tipp öffnet nur die Startseite,
und viele wichtige Ereignisse (Gruppeneinladung, fehlgeschlagene Zahlung, neue Rechnung,
Wochenrückblick) lösen gar keinen Push aus. Dieses Konzept legt fest: welche Push-Arten es gibt,
wohin jeder Tipp führt, wie viel pro Tag zugestellt wird, zu welcher lokalen Zeit, welche Schalter
es gibt und welche neuen Anlässe dazukommen. Es ist der Bauplan für die Umsetzungs-Issues am Ende
([Issue-Schnitt](#issue-schnitt)), nicht selbst Umsetzung.

Alle Fürsorge- und Hinweistexte folgen der [Fürsorge-Tonalität](fuersorge-tonalitaet.md); die
Bewertung von Balance-Zuständen richtet sich nach dem [Zifferblatt-Konzept](zifferblatt-konzept.md).

## Grundregeln

1. **Jede Push-Art hat ein konkretes Ziel.** Ein Tipp führt zur Seite, zur Aufgabe oder zur
   Dashboard-Karte, um die es geht — nie „nur zur App“.
2. **Ein Gedanke je Nachricht.** Texte sind ein bis zwei Sätze, in der Nutzersprache
   (`users.sprache`), Ton nach Fürsorge-Tonalität.
3. **Weniger ist mehr.** Das Budget (siehe [Budget](#push-budget)) begrenzt den Tag; besser eine
   gebündelte Nachricht als drei einzelne. Der Service Worker ersetzt ohnehin aufeinanderfolgende
   Nachrichten (`tag: 'priority-pilot'`, `push-sw.js`).
4. **Werbung ist getrennt von Service.** Pushes, die zum Upgrade anregen sollen, laufen nur mit
   eigenem Opt-in (siehe [Werbung und Service](#werbung-und-service-trennen)).

## Bestand: alle zehn Push-Arten und ihre Ziele

Alle Bestands-Arten versendet der Server über `sendDedupedPush`/`sendDedupedPushBulk`
(`server/src/logics/dedupedPush.ts`, Dedupe über `notification_logs` aus `kind` + `dedupeKey`).
Schalter heute: nur der Push-Haupt-Schalter (Gerät abonnieren/kündigen) und „Fürsorge-Hinweise“
(`users.carePushEnabled`). Die Spalte „Schalter“ nennt die künftige Gruppe aus dem
[Schalter-Abschnitt](#schalter-unter-benachrichtigungen).

| Push-Art (`kind`)  | Anlass                                          | Beispieltext (de)                                                                                                | Ziel heute    | Ziel künftig                                                          | Häufigkeit                         | Schalter              | Paket    |
| ------------------ | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------- | --------------------------------------------------------------------- | ---------------------------------- | --------------------- | -------- |
| `due-task`         | Aufgabe fällig/überfällig (ab 24 h vor Termin)  | „Fällige Aufgaben — Du hast 3 fällige oder überfällige Aufgaben.“                                                | `/`           | eine: `/tasks/{id}`; mehrere: `/aufgaben?deadline={frühester Termin}` | 1×/Tag, je Aufgabe+Termin genau 1× | Aufgaben              | Free     |
| `daily-top-tasks`  | 3 wichtigste Aufgaben des Tages                 | „Deine wichtigsten Aufgaben — Steuererklärung, Arzttermin“                                                       | `/`           | `/#tagesplan` (Tagesplan-Karte)                                       | 1×/Tag morgens                     | Aufgaben              | Free     |
| `care-push`        | Säule defizitär oder überlastet                 | „Deine Liste ist lang, dein Tag hat Grenzen. Wähle eine Sache, die heute wirklich zählt – der Rest darf warten.“ | `/`           | `/#fuersorge` (Fürsorge-Hinweis)                                      | max. 1×/Tag, 8–21 Uhr lokal        | Fürsorge & Rückblicke | Free     |
| `streak-reminder`  | Streak läuft Gefahr, heute noch nichts erledigt | „Deine Streak wartet — Du bist seit 5 Tagen dran – eine kleine Aufgabe heute hält deine Serie am Leben.“         | `/aufgaben`   | `/#streak` (Streak-Karte)                                             | max. 1×/Tag, 18–21 Uhr lokal       | Fürsorge & Rückblicke | Free     |
| `monthly-recap`    | Monatsrückblick bereit (Tag 1–7)                | „Dein Monatsrückblick ist da — Ein Blick zurück: So hat sich deine Balance im letzten Monat entwickelt.“         | `/`           | `/#monat` (Monatskarte)                                               | 1×/Monat                           | Fürsorge & Rückblicke | Free     |
| `milestone`        | Streak- oder Punkte-Schwelle überschritten      | „Meilenstein erreicht! 🎉 — 100 Punkte gesammelt — weiter so!“                                                   | `/`           | `/#meilensteine` (Meilenstein-Karte)                                  | je neuem Meilenstein               | Fürsorge & Rückblicke | Free     |
| `task-created`     | Gruppenmitglied legt Aufgabe für einen          | „Neue Aufgabe von Anna — „Ablage sortieren“ wurde für dich angelegt.“                                            | `/`           | `/tasks/{id}`                                                         | je Aufgabe, genau 1×               | Gruppen               | Plus/Pro |
| `task-completed`   | Fremde Aufgabe erstmals erledigt                | „Aufgabe erledigt — Anna hat „Ablage sortieren“ erledigt.“                                                       | `/`           | `/tasks/{id}`                                                         | je Aufgabe, genau 1×               | Gruppen               | Plus/Pro |
| `series-generated` | Serien-Lauf erzeugt fremde Aufgaben             | „Neue Aufgaben von Anna — „Wochenputz“: 3 neue Aufgaben.“                                                        | `/`           | `/serien`                                                             | je Serie+Lauf                      | Gruppen               | Plus/Pro |
| `geo-nearby-task`  | Betreten des Alarmabstands                      | „2 Aufgaben in der Nähe — Supermarkt (0,8 km), Apotheke (1,0 km)“                                                | `/tasks/{id}` | bleibt                                                                | Flanke je Aufgabe, max. 1×/24 h    | Aufgaben              | Plus/Pro |

Begründungen, wo ein Ziel die Startseite bleibt: keine — nach der Umstellung führt jede Bestands-Art
zu einem konkreten Ziel. `due-task` mit mehreren Aufgaben nutzt den bestehenden Deadline-Filter
(`?deadline=YYYY-MM-DD`, `frontend/src/App.tsx`), `geo-nearby-task` öffnet die nächste Aufgabe
bereits heute über den bestehenden Deep-Link (`/tasks/{id}` öffnet den Bearbeiten-Dialog).

## Zielformat und Klickpfad

**Format des Ziels** ist das bestehende Feld `url` in `PushPayload` (`server/src/logics/push.ts`):
App-Pfad ab Wurzel plus optionaler Query plus optionaler Hash-Anker für Dashboard-Karten:

```text
/                         App-Wurzel (nur noch Fallback, wenn kein Ziel bekannt)
/aufgaben?deadline=2026-11-02   Seite mit Filter
/#streak                  Dashboard mit Karte „Streak“ (Hash-Anker)
```

**Dashboard-Karten als Anker.** Adressierbare Karten bekommen ein `id`-Attribut mit festem Namen;
der Anker ist der Name ohne Sonderzeichen:

| Anker           | Karte                          | Bedingung heute              |
| --------------- | ------------------------------ | ---------------------------- |
| `#tagesplan`    | Tagesplan (Tag-Ansicht)        | immer                        |
| `#fuersorge`    | Fürsorge-Hinweis (`care-hint`) | bei Bedarf                   |
| `#streak`       | Streak-Karte                   | bei laufendem Streak         |
| `#woche`        | Wochenkarte                    | nur sonntags                 |
| `#monat`        | Monatskarte                    | Tag 1–7 des Monats           |
| `#jahr`         | Jahresrückblick                | nur im Januar                |
| `#meilensteine` | Meilenstein-Karte              | bei erreichten Meilensteinen |
| `#willkommen`   | Willkommens-Schritte           | bis Onboarding abgeschlossen |
| `#rechnungen`   | Rechnungen im Tab Pakete       | immer                        |

**Verhalten Web.** Der `notificationclick`-Handler in `frontend/public/push-sw.js` löst die URL
über `toAppUrl` gegen den Scope auf — ein Hash bleibt dabei erhalten, der Service Worker braucht
keine Änderung. Die App reagiert auf `location.hash`: sie navigiert zum Dashboard (falls nötig)
und scrollt zur Karte (`scrollIntoView`, Vorbild `care-hint`-Sprung in `Dashboard.tsx`). Hash bei
bereits offenem Fenster wird ebenso über den Hash-Handler behandelt.

**Verhalten Android.** Der native Tap-Listener (`listenForNativePushTaps`, `frontend/src/lib/push.ts`)
schreibt die URL per `history.pushState` in den Router-Verlauf — Pfad, Query und Hash bleiben
erhalten; derselbe Hash-Handler der Web-App führt den Sprung aus.

**Karte gerade nicht gerendert.** Zeitgebundene Karten (Wochen-, Monats-, Jahreskarte) und
bedingte Karten (Streak, Fürsorge) können beim Tipp außerhalb ihres Fensters fehlen. Regel: Der
Hash-Anker überschreibt das Zeitfenster — die Karte wird beim angesprungenen Besuch einmalig
trotzdem gerendert (der Push gehört zur Karte, sonst wäre das Ziel eine leere Seite). Fällt eine
Karte aus einem anderen Grund weg (z. B. Streak zwischenzeitlich gebrochen), landet der Tipp auf
dem Dashboard ohne Scroll; das ist kein Fehler.

## Bewertung des Ideenkatalogs

Jeder Vorschlag aus dem Ticket: übernehmen (mit Ziel, Häufigkeit, Schalter, Beispieltext), ändern
(gekürzt/umgeformt) oder verwerfen (mit Begründung).

### Fürsorge & Produkt

| Vorschlag                                    | Bewertung      | Begründung und Ausgestaltung                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lob bei guter Balance                        | **übernehmen** | Anerkennung fehlt bisher außerhalb des Dashboards. Ziel `/#zifferblatt` (Balance-Karte), Häufigkeit max. 1×/Monat und nur, wenn die Balance im grünen Bereich ist und das letzte Lob ≥ 30 Tage zurückliegt, Schalter „Fürsorge & Rückblicke“. Text: „Deine Balance trägt diesen Monat. Schau rein, was schon gut läuft – das hast du dir aufgebaut.“ |
| Wochenrückblick am Sonntag                   | **übernehmen** | Sonntags passt zum Fenster der Wochenkarte; kein zusätzlicher Anlass nötig. Ziel `/#woche`, 1×/Woche (sonntags, 17–20 Uhr lokal), Schalter „Fürsorge & Rückblicke“. Text: „Deine Woche im Rückblick — Ein Blick auf sieben Tage Balance: Was trägt dich, was darf kürzer sein?“                                                                      |
| Jahresrückblick im Januar                    | **übernehmen** | Gegenstück zur Monats-/Wochenkarte, einmal im Jahr kein Risiko. Ziel `/#jahr`, 1×/Jahr (erste Januartage), Schalter „Fürsorge & Rückblicke“. Text: „Dein Jahr in der Balance — Der Jahresrückblick ist bereit: Woraus hast du 2026 Kraft geschöpft?“                                                                                                 |
| Überlast-Hinweis „Du darfst heute kürzen“    | **verwerfen**  | Existiert schon: `care-push` behandelt Überlast mit Vorrang vor Defizit — eine zweite Art würde denselben Anlass doppeln.                                                                                                                                                                                                                            |
| Freie Zeit im Kalender erkannt               | **verwerfen**  | Kalendertermine sagen nichts über tatsächliche Verfügbarkeit aus; ein daraus abgeleiteter Ratschlag wäre leicht falsch und wirkt bevormundend.                                                                                                                                                                                                       |
| Nach Deadline automatisch entfernte Aufgaben | **verwerfen**  | Nachträgliche Fehlermeldung („…wurde entfernt“) protokolliert nur, statt zu sorgen — sie besteht die Prüffrage nicht; die Auto-Löschung ist bewusst pro Aufgabe eingestellt.                                                                                                                                                                         |
| Abendlicher Journal-Impuls                   | **ändern**     | Jeden Abend wäre Dauerbeschallung; gedrosselt ist er ein sanfter Anstoß. Ziel `/journal`, 3×/Woche (19–21 Uhr lokal), Schalter „Fürsorge & Rückblicke“. Text: „Platz für einen Gedanken — Drei Minuten im Journal können den Tag sortieren. Nur wenn du magst.“                                                                                      |
| Willkommens-Schritte nach 2 Tagen offen      | **übernehmen** | Onboarding-Abbrüche sind die größte Hürde; der Hinweis endet von selbst. Ziel `/#willkommen`, genau 2 Versuche (Tag 2 und Tag 5 nach Registrierung), Schalter „Aufgaben“. Text: “Fast fertig eingerichtet — Noch zwei kurze Schritte, dann kennt Balamentum deine Säulen.“                                                                           |

### Gruppen (Feature Plus/Pro)

| Vorschlag                                  | Bewertung      | Begründung und Ausgestaltung                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------ | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Einladung in eine Gruppe                   | **übernehmen** | Persönliche Anfrage verdient sofortige Nachricht; heute bleibt sie unsichtbar. Ziel `/settings/groups`, sofort beim Ereignis, Schalter „Gruppen“. Text: „Anna lädt dich ein — „Fitness-Gruppe“ wartet auf deine Antwort.“                                                                                                                                                                                  |
| Einladung angenommen / Link eingelöst      | **übernehmen** | Schließt die Schleife für den Einladenden. Ziel `/settings/groups` (Fokus auf die Gruppe), sofort, Schalter „Gruppen“. Text: „Anna ist dabei — „Fitness-Gruppe“ kann jetzt losgehen.“                                                                                                                                                                                                                      |
| Challenge gestartet / Zwischenstand / Ende | **ändern**     | Start und Ende sind echte Ereignisse, der Zwischenstand ist Alltag und geht im Tagesgeschäft unter. Start + Ende: Ziel `/settings/groups`, je 1×, Schalter „Gruppen“. Text Start: „Challenge startet — „Die meisten Schritte im Mai“: Ab heute zählt jeder Schritt.“ Text Ende: „Challenge beendet — „Die meisten Schritte im Mai“ ist entschieden. Schau rein, wie es ausging.“ Zwischenstand: verworfen. |
| Duo-Partner hat etwas erledigt             | **ändern**     | Je Erledigung wäre bei aktiven Partnern Dauer-Push; gebündelt bleibt es verbindlich. Max. 1 Nachricht/Tag (Sammeln bis 20 Uhr), Ziel `/settings/groups`, Schalter „Gruppen“. Text: „Anna war heute dran — 2 erledigte Aufgaben in eurem Duo.“                                                                                                                                                              |

### Abo & Rechnungen

| Vorschlag                                        | Bewertung      | Begründung und Ausgestaltung                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------ | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Neue Rechnung oder Gutschrift                    | **übernehmen** | Pflichtinformation, heute nur per Mail — Push schließt die Lücke. Ziel `/settings/plans#rechnungen`, sofort, nicht abschaltbar (Service). Text: „Neue Rechnung — Deine Rechnung für November 2026 liegt bereit.“                                                                                                                                            |
| Zahlung fehlgeschlagen / Kulanzfrist / Abo endet | **übernehmen** | Zeitkritisch und rechtsrelevant; ohne Nachricht droht der stille Abo-Verlust (Google Play hat heute gar keinen Kanal). Ziel `/settings/plans`, sofort, nicht abschaltbar (Service). Text: „Zahlung nicht erfolgreich — Die Zahlung für dein Paket ist fehlgeschlagen. Bitte Zahlungsmethode prüfen.“                                                        |
| Abo aktiv: „Das ist jetzt neu für dich“          | **ändern**     | Direkt nach dem Kauf ist es Transaktionsbestätigung mit Nutzen (kein Werbe-Push im Sinne der Trennung), darf aber nicht wiederkommen. Genau 1× nach jedem Upgrade oder Kauf, Ziel `/settings/plans`, Schalter „Abo & Rechnungen“ (an, da Service). Text: „Plus ist aktiv — Ortserinnerungen und KI-Hilfe stehen dir jetzt zur Verfügung.“                   |
| Paketgrenze erreicht (KI-Kontingent, Kalender)   | **ändern**     | Beide Grenzen erlebt der Nutzer unmittelbar in der App (KI-Drossel im laufenden Dialog, Kalender-Ablehnung im Formular) — ein Push erreicht ihn nie „danach“. Kein Push; stattdessen In-App-Hinweis mit Blick auf das höhere Paket.                                                                                                                         |
| Nutzungsbezogener Plus-Hinweis                   | **übernehmen** | Werblicher Anlass mit klarem Nutzenversprechen — läuft ausschließlich unter dem Opt-in „Tipps & Angebote“. Ziel `/settings/plans`, max. 1×/Monat, Schalter „Tipps & Angebote“ (default aus). Text: „Ortserinnerungen könnten dir Wege ersparen — Viele deiner Aufgaben haben einen Ort. Wenn du magst, erinnert dich Balamentum, wenn du in der Nähe bist.“ |

## Push-Budget

**Tageshöchstzahl: 5 Pushes pro Nutzer und Tag** über alle Arten zusammen. Nicht ins Budget
gezählt: nicht abschaltbare Service-Pushes (Rechnung, Zahlung, Abo-Ende) — sie sind selten,
zeitkritisch und rechtlich geboten.

- **Ruhezeiten: 21:00–08:00 Uhr der Nutzerzeitzone** für alle geplanten Arten (verallgemeinert
  aus dem bestehenden `care-push`-Fenster). Ereignis-Pushes (`task-created`, `task-completed`,
  `series-generated`, Gruppen-Einladungen) werden sofort zugestellt — sie sind direkt, selten und
  antworten auf ein frisches Ereignis; Störungen regelt das Gerät (Bitte-nicht-stören).
- **Vorrang beim Zusammentreffen** (das Budget füllt sich von oben): 1. Service (Zahlung,
  Rechnung), 2. soziale Ereignisse (Gruppe, neue/erledigte Aufgaben), 3. Termine (`due-task`,
  `geo-nearby-task`), 4. Rückblicke und Meilensteine, 5. Fürsorge-Anstöße (`care-push`, Streak,
  Lob, Journal-Impuls), 6. Tipps & Angebote. Innerhalb einer Stufe gewinnen neuere Ereignisse.
  Fürsorge-Anstöße verlieren als Erstes — ihr Anlass kehrt am Folgetag wieder (tagesweises Dedupe
  existiert bereits).
- **Bündelung `due-task` + `daily-top-tasks`:** feuern beide am Morgen, entfällt die separate
  Fälligkeits-Nachricht — die Tages-Nachricht übernimmt („Deine wichtigsten Aufgaben — A, B, C;
  davon 2 heute fällig“) und loggt beide `kind`s. Ziel ist dann `/#tagesplan`; die Aufgabe-Ansicht
  bleibt über die Karte erreichbar.

Technisch zählt das Budget je Kalendertag der Nutzerzeitzone (nicht UTC), sonst würde die
Tagesgrenze mitten im lokalen Abend kippen.

## Zeitmodell: lokale Zustellfenster

**Problem.** Der Scheduler feuert genau einmal pro UTC-Tag (`PUSH_REMINDERS_HOUR`, Default 08:00
UTC — `server/src/scheduler/index.ts`). Ein Trigger mit lokalem Fenster verpasst es deshalb fast
immer: Die Streak-Erinnerung (18–21 Uhr lokal) erreicht Nutzer in Europa nie, weil der einzige
Tick vormittags liegt. `care-push` und `geo-nearby-task` umgehen das heute durch eigene
Intervall-Jobs bzw. clientgetriggerte Läufe — kein generalisierbares Muster.

**Konzept.** Der 15-Minuten-Tick bleibt zentral, der 1×-pro-UTC-Tag-Gate fällt weg. Jeder geplante
Trigger erhält ein lokales Zustellfenster (Von-bis-Stunde) und entscheidet je Nutzer:

1. Der Tick prüft je Nutzer die lokale Stunde über `user.zeitzone` (`Intl`, Fallback UTC —
   bestehende Konvention `nutzerZeitzone`).
2. Liegt sie im Fenster **und** wurde heute (lokaler Kalendertag) noch nicht gesendet, wird
   zugestellt; das Dedupe über den lokalen Tagesschlüssel existiert für die meisten Arten schon
   (`{userId}:{lokalesDatum}`).
3. Fenster verpasst (Server-Ausfall, Nutzer ohne Tick an diesem Tag) → kein Nachziehen am selben
   Tag; der nächste Tag bringt die nächste Chance. Geplante Pushes sind Erinnerungen, keine
   Pflichttermine.

Feste Sendestunden je Art (lokale Zeit): `daily-top-tasks` 06:00, `due-task` 08:00,
Wochenrückblick sonntags 17:00, Journal-Impuls 19:00, Streak-Fenster 18–21 (bestehend),
`care-push` 08–21 (bestehend), Monats-/Jahresrückblick im Fenster des jeweiligen ersten
Kartentags. Der 15-Minuten-Takt macht je Nutzer ohne eigene Timer ausführbar — Vorbild ist der
Geo-Job, der bereits per `startIntervalScheduler` im festen Intervall läuft.

## Schalter unter „Benachrichtigungen“

Heute gibt es neben dem Hauptschalter nur „Fürsorge-Hinweise“. Künftig fünf Gruppen (KoliBri-
Switches in der Karte „Benachrichtigungen“, `frontend/src/components/SettingsPage.tsx`):

| Gruppe                | enthält                                                                                                    | Default                             |
| --------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Aufgaben              | `due-task`, `daily-top-tasks`, `geo-nearby-task`, Willkommens-Schritte                                     | an                                  |
| Fürsorge & Rückblicke | `care-push`, `streak-reminder`, `monthly-recap`, Wochen-/Jahresrückblick, Lob, Journal-Impuls, `milestone` | an                                  |
| Gruppen               | `task-created`, `task-completed`, `series-generated`, Einladungen, Challenge, Duo                          | an                                  |
| Abo & Rechnungen      | Rechnung, Zahlungsproblem, Abo-Ende, „neu für dich“                                                        | an, **nicht abschaltbar** (Service) |
| Tipps & Angebote      | nutzungsbezogene Plus-Hinweise                                                                             | **aus** (Opt-in)                    |

„Fürsorge & Rückblicke“ übernimmt die Rolle des heutigen `carePushEnabled` (Feld wird Gruppe, kein
Datenverlust — es gibt keine Bestandskunden-Ballast-Pflicht, Migration des Felds ist Teil des
Schalter-Issues). Der Hauptschalter bleibt: Ohne Abonnement stellt das Gerät überhaupt nichts zu.

**Nicht abschaltbar** sind nur die Service-Pushes der Gruppe „Abo & Rechnungen“ — Rechnung und
Zahlungsprobleme sind Vertragsinformationen mit Fristcharakter; ein Abschalten hätte den stillen
Abo-Verlust zur Folge.

## Werbung und Service trennen

- **Service-Pushes** antworten auf eine Handlung oder ein Vertragsereignis des Nutzers (Kauf,
  Zahlung, Rechnung, Abo-Ende). Sie laufen ohne eigenes Opt-in, sind nicht abschaltbar und
  enthalten keine Verkaufsargumente.
- **Werbliche Pushes** regen zu einem Kauf oder Upgrade an, das nicht unmittelbar auf einer
  eigenen Handlung des Nutzers beruht. Davon gibt es genau eine Art: den nutzungsbezogenen
  Plus-Hinweis. Er läuft ausschließlich mit dem Opt-in „Tipps & Angebote“ (default aus), mit
  fester Obergrenze von 1×/Monat und freier Kündbarkeit des Opt-ins (datenschutzfreundlich: jede
  Nachricht muss sich abschalten lassen, ohne die Service-Pushes zu verlieren).
- **Grenzfälle:** „Das ist jetzt neu für dich“ (direkt nach Kauf) und der
  Paketgrenzen-In-App-Hinweis zählen nicht als Werbung — sie folgen unmittelbar auf eine eigene
  Handlung bzw. bleiben ganz in der App.
- **Tonalitäts-Prüfpunkt:** jeder Fürsorge- und Hinweistext muss die Prüffrage aus der
  Fürsorge-Tonalität mit „sorgt“ beantworten: „Sorgt der Text, oder protokolliert er nur?“ — er
  muss heute etwas anbieten (Schritt, Erlaubnis oder Anerkennung), nicht nur feststellen. Die
  Beispieltexte dieses Konzepts sind darauf geprüft; neue Texte werden im Review dagegen geprüft.

## Issue-Schnitt

Alle Issues höchstens „Mittel“. Sie entstehen mit dem Skill [Ticket-Baum](../.claude/skills/ticket-tree/SKILL.md)
unter einem Epic „Push-Konzept“ mit nativen `blocked-by`-Beziehungen gemäß Spalte „Hängt ab von“.

| Nr  | Issue                                                                                                                             | Größe  | Hängt ab von |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------ |
| 1   | [P2/M] Ziel-Infrastruktur: `id`-Anker auf Dashboard-Karten, Hash-Handler mit Scroll und Zeitfenster-Override                      | Mittel | –            |
| 2   | [P2/S] Bestands-Ziele umstellen: alle zehn Push-Arten auf Konzept-Ziele (inkl. `due-task`-Deadline-Filter)                        | Klein  | 1            |
| 3   | [P2/M] Zeitmodell: lokale Zustellfenster im Scheduler (15-Min-Tick, lokaler Tagesschlüssel, feste Sendestunden)                   | Mittel | –            |
| 4   | [P2/M] Schaltergruppen unter „Benachrichtigungen“ (fünf Gruppen, `carePushEnabled` wird Gruppe, nicht abschaltbare Service-Arten) | Mittel | –            |
| 5   | [P2/M] Push-Budget: Tageszähler, Vorrang, Bündelung `due-task` + `daily-top-tasks`                                                | Mittel | 3, 4         |
| 6   | [P2/M] Neue Anlässe Fürsorge & Rückblicke: Lob, Wochen- und Jahresrückblick, Journal-Impuls, Willkommens-Schritte                 | Mittel | 1, 3, 4      |
| 7   | [P2/M] Neue Anlässe Gruppen: Einladung (erhalten/angenommen), Challenge Start/Ende, Duo-Bündelung                                 | Mittel | 4            |
| 8   | [P2/M] Neue Anlässe Abo & Rechnungen: Rechnung, Zahlungsproblem, Abo-Ende, „neu für dich“; Google-Play-Kanal mitdenken            | Mittel | 4            |
| 9   | [P2/S] Tipps & Angebote: Opt-in-Schalter, monatlicher nutzungsbezogener Plus-Hinweis (Werbung getrennt)                           | Klein  | 4            |

Kritischer Pfad: 1 → 2 und 3/4 → 5/6 → 8. Issue 3 (Zeitmodell) ist unabhängig von der
Ziel-Infrastruktur und kann parallel zuerst laufen — ohne ihn bleiben Streak und Wochenrückblick
in Europa stumm.
