# UX-Konzept: Ansichten für Aufgabe, Serie und Vorlage

Legt fest, wie eine Aufgabe, eine Serie und eine Vorlage **angesehen** werden, ohne das Formular zu
öffnen. Schwesterdokumente: [Design-Sprache „Cockpit"](../.ai-knowledge/ux-design.md),
[Mobile-UI-Regeln](mobile-ui-rules.md), [Push-Konzept](push-konzept.md),
[ADR 0020](adr/0020-serien-automatisch-anlegen-vorlage.md) (Vorlage = Serie ohne Automatik),
[ADR 0024](adr/0024-erledigen-direkt-mit-rueckgaengig.md) (Erledigen mit Rückgängig),
[Sequenzielle Bestätigung](ux-pattern-sequential-confirmation.md).

## 1. Ausgangslage

Die App kennt für Aufgaben und Serien nur Formulare: Anlegen und Bearbeiten laufen über
`TaskFormModal`/`TaskForm` (gut 2.100 Zeilen, ein Viewport reicht auf 375 px bei Weitem nicht),
Serien über denselben Dialog im Serien-Modus. Eine Lesesicht gibt es nicht.

Befunde:

- **Push landet im Formular.** `/tasks/<id>` öffnet die Aufgabe im Bearbeiten-Dialog und
  navigiert sofort aufs Dashboard (`App.tsx`, Deep-Link-Effekt). Wer „Apotheke – 0,3 km“ antippt,
  will wissen, was zu tun ist, und bekommt ein Eingabeformular mit Fokus im Titelfeld. Schließt er
  es, steht er auf dem Dashboard statt bei der Aufgabe.
- **Antippen tut nichts.** Im Aufgabenbaum (`TaskTree`) ist der Titel eine Überschrift ohne
  Aktion; Details gibt es nur über „…“ → „Bearbeiten“. Dasselbe gilt im Tab „Serien & Vorlagen“.
- **Ansehen birgt Risiko.** Wer nur nachsehen will, tippt versehentlich in ein Feld, löst die
  Dirty-Erkennung aus (#1584) und muss „Verwerfen“ bestätigen.
- **Zusammenhänge sind unsichtbar.** Unteraufgaben, Abhängigkeiten, Herkunft aus einer Serie,
  Verlauf einer Serie und die von einer Vorlage abgerufenen Aufgaben stehen an keiner Stelle
  beieinander.

## 2. Grundsätze

1. **Antippen heißt ansehen.** Jeder Titel einer Aufgabe, Serie oder Vorlage öffnet die Ansicht.
   Bearbeiten ist ein bewusster zweiter Schritt.
2. **Die Ansicht beantwortet zuerst „Was ist zu tun und bis wann?“** Titel, Fälligkeit und die
   eine Primäraktion stehen ohne Scrollen im Blick. Alles andere ordnet sich darunter.
3. **Eine Primäraktion je Ansicht** ([Regel 5](mobile-ui-rules.md)), unten in der Daumenzone
   ([Regel 1](mobile-ui-rules.md)). Sie hängt vom Typ und Zustand ab (Abschnitt 6).
4. **In der Ansicht wird nur geschaltet, nicht geschrieben.** Abhaken (Checkliste, Erledigt),
   Anheften, Pausieren gehen direkt. Texte, Zahlen und Daten ändert nur das Formular. So bleibt die
   Ansicht frei von Dirty-Zuständen.
5. **Eine Ansicht für Serie und Vorlage.** Nach ADR 0020 ist die Vorlage eine Serie ohne
   Automatik. Die Ansicht ist dieselbe Komponente; sie blendet Rhythmus-Teile aus und tauscht die
   Primäraktion.
6. **Leer bleibt leer.** Felder ohne Wert erscheinen nicht. Kein „Ort: –“, keine leere Checkliste.

## 3. Form: eigene Route, kein Dialog

Die Ansicht ist eine **Seite mit eigener Route**, kein Modal.

| Route            | Inhalt                                                            |
| ---------------- | ----------------------------------------------------------------- |
| `/aufgaben/<id>` | Aufgabenansicht                                                   |
| `/serien/<id>`   | Serien- oder Vorlagenansicht                                      |
| `/tasks/<id>`    | Alt-Ziel aus Pushes, leitet mit `replace` auf `/aufgaben/<id>` um |

Gründe:

- **Bearbeiten öffnet einen Dialog.** Wäre die Ansicht selbst ein Modal, entstünde Modal in Modal
  (Anti-Pattern der Mobile-UI-Regeln). Als Seite trägt sie den vorhandenen `TaskFormModal` ohne
  Umbau.
- **Push, Neuladen und Zurück funktionieren.** Die Adresse bleibt stehen, der Zurück-Weg des
  Browsers bzw. die Android-Zurück-Taste führt dorthin, woher man kam. Bei Einstieg über Push gibt
  es keinen Vorgänger; dann führt „Zurück“ auf `/aufgaben` bzw. `/serien`.
- **Die Craft-Floor-Regel** der Design-Sprache lehnt ein Modal für eine Aufgabe ohne
  Unterbrechungsgrund ab. Ansehen unterbricht nichts.
- **Die Unterrouten passen ins Routenschema** (`ROUTE_PATHS` in `App.tsx`): Der Haupt-Tab bleibt
  markiert, weil die Ansicht unter `/aufgaben` bzw. `/serien` liegt.

Neue Pushes schicken `/aufgaben/<id>`. Die Umleitung von `/tasks/<id>` bleibt, weil ältere
Nachrichten noch in der Mitteilungszentrale liegen; der Hinweis „Diese Aufgabe gibt es nicht
mehr.“ (#2848) wandert in die Ansicht (Abschnitt 7).

**Kopfzeile der Seite:** links ein Zurück-Button (`KolButton`, Icon + Text „Zurück“), rechts
„Bearbeiten“ (`KolButton` sekundär) und „…“ für seltene Aktionen. Bearbeiten steht oben, weil es
der seltene Weg ist; die häufige Aktion liegt unten.

## 4. Aufgabenansicht

### 4.1 Aufbau (375 px, von oben nach unten)

```
┌─────────────────────────────────────┐
│ ← Zurück              Bearbeiten  … │
├─────────────────────────────────────┤
│ Apotheke: Rezept abholen       (h1) │
│ [Offen] [P3] [Serie] [Angeheftet]   │
│                                     │
│ Fällig morgen · Fr, 25.10.          │  ← Dringlichkeitsfarbe + Text
│ Aufwand 15 min · für Anna           │
│                                     │
│ Checkliste                 2 von 3  │
│ ☑ Rezept einstecken                 │
│ ☑ Versichertenkarte                 │
│ ☐ Kassenzettel aufheben             │
│                                     │
│ Beschreibung                        │
│ Das Rezept liegt im Flur …          │
│                                     │
│ Ort                                 │
│ Marktplatz 3, Musterstadt           │
│ 0,3 km · In Karten öffnen ↗         │
│                                     │
│ Unteraufgaben              1 von 2  │
│ ✓ Termin vereinbaren              › │
│ ○ Befund abholen                  › │
│                                     │
│ Wartet auf                          │
│ ○ Überweisung holen               › │
│                                     │
│ Säulen  Gesundheit · Familie        │
│ Kategorie  Erledigungen             │
│                                     │
│ ▸ Mehr Details                      │  ← KolDetails
├─────────────────────────────────────┤
│ [        ✓ Erledigt          ]      │  ← sticky, Primäraktion
└─────────────────────────────────────┘
```

### 4.2 Blöcke

| Block          | Inhalt                                                                                                                                         | erscheint, wenn                  |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Kopf           | Titel als `KolHeading _level={1}`, darunter die Badges aus `TaskTree` (Status, Priorität, Serie/Vorlage, geändert, angeheftet, für/von)        | immer                            |
| Kernzeile      | Fälligkeit relativ **und** absolut (`formatRelativeDeadline` + `formatDeadline`), Aufwand, Empfänger                                           | Deadline oder Aufwand gesetzt    |
| Checkliste     | `KolInputCheckbox` je Punkt, direkt abhakbar; Zähler „2 von 3“ in der Überschriftzeile                                                         | Checkliste nicht leer            |
| Beschreibung   | Fließtext, Zeilenumbrüche erhalten, Links klickbar; ab ca. 8 Zeilen gekürzt mit „Ganzen Text zeigen“                                           | Beschreibung gesetzt             |
| Ort            | Adresse, Entfernung (wenn Standort bekannt), Link in die Karten-App                                                                            | Adresse gesetzt                  |
| Unteraufgaben  | Liste mit Status-Icon und Titel, jede Zeile führt zur Ansicht der Unteraufgabe; Zähler                                                         | Unteraufgaben vorhanden          |
| Abhängigkeiten | „Wartet auf“ und „Blockiert“ als zwei Listen, Zeilen führen zur jeweiligen Ansicht                                                             | Abhängigkeiten vorhanden         |
| Herkunft       | „Aus Serie „Haushalt““ bzw. „Aus Vorlage „Steuer““ mit Link auf `/serien/<id>`; bei Ausnahme der Hinweis „Abweichend von der Serie bearbeitet“ | `seriesId` oder `originSeriesId` |
| Einordnung     | Säulen mit Säulenname als Text (Relief-Regel), Kategorie                                                                                       | Säulen oder Kategorie gesetzt    |
| KI-Entwurf     | vorhandener `TaskAiDraft`-Inhalt, eingeklappt                                                                                                  | `aiDraft` vorhanden              |
| Mehr Details   | `KolDetails`: angelegt von, Gruppe, Mal verschoben, „Nach Fälligkeit automatisch löschen“, Erledigt-am/Punkte                                  | immer, eingeklappt               |

Faktenzeilen folgen Regel 4 der Mobile-UI-Regeln: Label links, Wert rechts, als `ul`/`li`, keine
Karte in Karte. Die ganze Ansicht ist eine Fläche; Abschnitte trennen Überschriften (`KolHeading
_level={2}`) und Abstand `--pp-space-6`, keine Rahmen.

### 4.3 Primäraktion nach Zustand

| Zustand                            | Primäraktion (sticky unten)  | Hinweis                                                                           |
| ---------------------------------- | ---------------------------- | --------------------------------------------------------------------------------- |
| offen / in Arbeit, nicht blockiert | **Erledigt**                 | direkt mit Rückgängig (ADR 0024), Überfällig fragt erst die Pünktlichkeit (#1964) |
| offene Unteraufgaben               | **Erledigt** gesperrt        | Grund als Text darüber: „Noch 1 Unteraufgabe offen“ (`doneBlockedHint`)           |
| wartet auf offene Abhängigkeit     | **Erledigt** bleibt aktiv    | Hinweis „Wartet auf „Überweisung holen““ im Kopf, kein Sperren                    |
| erledigt                           | **Wieder öffnen** (sekundär) | Kopfzeile zeigt „Erledigt am 24.10. · +12 Punkte“                                 |
| archiviert                         | **Wiederherstellen**         | Banner „Archiviert“ (`KolAlert _type="info"`)                                     |

### 4.4 Aktionen im „…“-Menü

Reihenfolge wie im `TaskTree`-Popover, damit die Menüs gleich bleiben: Abhängigkeiten,
Unteraufgabe anlegen, Als Vorlage speichern, Anheften/Lösen, Später (Snooze), Archivieren,
Löschen. Löschen steht als letzter Eintrag und läuft über die sequenzielle Bestätigung; danach
geht es zurück zur Herkunftsliste.

## 5. Serien- und Vorlagenansicht

Eine Komponente, zwei Ausprägungen. Erkennungszeichen ist `autoCreate`.

### 5.1 Serie (`autoCreate = true`)

```
┌─────────────────────────────────────┐
│ ← Zurück              Bearbeiten  … │
├─────────────────────────────────────┤
│ Müll rausbringen               (h1) │
│ [Serie] [P2] [für Anna]             │
│                                     │
│ Jeden Montag · seit 6. Okt.         │
│ Nächste: Mo 27.10. · Mo 3.11. ·     │
│          Mo 10.11.                  │
│                                     │
│ Offene Aufgaben                  2  │
│ ○ Müll rausbringen · Mo 27.10.    › │
│ ○ Müll rausbringen · überfällig   › │
│                                     │
│ Zuletzt erledigt                    │
│ ✓ Mo 20.10. · pünktlich             │
│ ✓ Mo 13.10. · 1 Tag später          │
│ ✓ Mo 6.10.  · pünktlich             │
│                                     │
│ Jede Aufgabe bekommt                │
│ Aufwand 10 min · Checkliste (2)     │
│ Säulen  Zuhause                     │
│ Beschreibung …                      │
│                                     │
│ ▸ Mehr Details                      │
├─────────────────────────────────────┤
│ [   ＋ Aufgabe jetzt anlegen   ]    │
└─────────────────────────────────────┘
```

| Block                | Inhalt                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Kopf                 | Titel, Badges wie im Serien-Tab (Serie, Ruhend, Priorität, für)                                                          |
| Rhythmus             | Klartext aus `rhythm` + `startDate` („Jeden Montag“, „Werktags“, „Monatlich am 3.“), darunter die nächsten drei Termine  |
| Offene Aufgaben      | Instanzen mit `seriesId = id`, nicht erledigt; Zeilen führen zur Aufgabenansicht                                         |
| Zuletzt erledigt     | die letzten fünf erledigten Instanzen mit Datum und Pünktlichkeit; ohne Erledigte entfällt der Block                     |
| Jede Aufgabe bekommt | was die Serie vererbt: Aufwand, Checkliste (nur Anzahl, aufklappbar), Säulen, Kategorie, Ort, Beschreibung, Auto-Löschen |
| Mehr Details         | angelegt von, Startdatum                                                                                                 |

Die Überschrift „Jede Aufgabe bekommt“ trennt Vorlagen-Werte sichtbar von den Instanzen. So ist
klar, dass ein Abhaken hier nichts erledigt; die Checkliste der Serie ist deshalb **nicht**
abhakbar, nur lesbar.

Die nächsten Termine berechnet der Server (`nextOccurrence` in `server/src/logics/series.ts`).
Die Ansicht braucht dafür ein Feld in der Serien-Antwort oder einen kleinen Endpunkt; die Logik
wird nicht ins Frontend kopiert.

**Primäraktion:** „Aufgabe jetzt anlegen“ (vorhandener Weg `seriesTab.createTask` mit
`SeriesInstanceDialog`). Nach dem Anlegen führt die App zur Ansicht der neuen Aufgabe.
**Ruhende Serie:** Primäraktion „Fortsetzen“, der Rhythmus-Block zeigt „Pausiert seit …“ statt
der nächsten Termine.

**„…“-Menü:** Pausieren/Fortsetzen (wenn nicht primär), Löschen (mit `DeleteSeriesDialog`).

### 5.2 Vorlage (`autoCreate = false`)

```
┌─────────────────────────────────────┐
│ ← Zurück              Bearbeiten  … │
├─────────────────────────────────────┤
│ Steuererklärung                (h1) │
│ [Vorlage] [P4]                      │
│                                     │
│ Entsteht nur auf Abruf.             │
│ Zuletzt angelegt am 12.3.2026       │
│                                     │
│ Die Aufgabe bekommt                 │
│ Aufwand 4 h · Checkliste (6)        │
│ ☐ Belege sammeln                    │
│ ☐ Lohnsteuerbescheinigung           │
│ …                                   │
│ Säulen  Finanzen                    │
│ Beschreibung …                      │
│                                     │
│ Daraus angelegt                  1  │
│ ○ Steuererklärung 2025 · offen    › │
│                                     │
├─────────────────────────────────────┤
│ [ ＋ Aufgabe aus Vorlage anlegen ]  │
└─────────────────────────────────────┘
```

Unterschiede zur Serie:

- Kein Rhythmus, keine nächsten Termine. Stattdessen ein Satz „Entsteht nur auf Abruf.“ und das
  Datum der letzten Anlage.
- „Die Aufgabe bekommt“ steht **vor** der Liste der angelegten Aufgaben: Bei einer Vorlage ist
  der Inhalt das, weswegen man sie öffnet. Die Checkliste ist voll ausgeklappt.
- „Daraus angelegt“ listet offene und die letzten erledigten Abruf-Aufgaben
  (`originSeriesId = id`).
- Primäraktion „Aufgabe aus Vorlage anlegen“ öffnet den vorbelegten Dialog „Aufgabe anlegen“ (wie
  „Aus Vorlage“ im Plus-Menü), danach geht es zur Ansicht der neuen Aufgabe.
- Begriff nach ADR 0020: in der App immer „Vorlage“, nie „Projekt-Vorlage“.

## 6. Einstiege

| Ort                                                           | heute                        | neu                                                         |
| ------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------- |
| Push `/tasks/<id>`, `/aufgaben/<id>`                          | Bearbeiten-Dialog, Dashboard | Aufgabenansicht                                             |
| `PushToast` „Öffnen“                                          | Ziel des Push                | unverändert, Ziel ist jetzt die Ansicht                     |
| Titel im Aufgabenbaum (`TaskTree`)                            | keine Aktion                 | Aufgabenansicht                                             |
| Dashboard: nächste Aufgabe, Top-Aufgaben, Deadlines, Verpasst | Bearbeiten-Button            | Titel → Ansicht; die Karten-Primäraktion (Erledigen) bleibt |
| Serien-Tab, Titel                                             | keine Aktion                 | Serien- bzw. Vorlagenansicht                                |
| Badge „Serie“/„Vorlage“ an einer Aufgabe                      | keine Aktion                 | Serien- bzw. Vorlagenansicht                                |
| Graph-Knoten (`TaskGraphPanel`)                               | Abhängigkeiten-Dialog        | unverändert; in der Knoten-Auswahl kommt „Ansehen“ dazu     |

Suche und Wochenansicht filtern den Aufgabenbaum; sie erreichen die Ansicht über dessen Titel.

„Bearbeiten“ bleibt in jedem „…“-Menü direkt erreichbar. Wer gezielt ändern will, spart sich den
Umweg über die Ansicht.

Der Titel wird dafür zum Link (`KolLink` mit Route, kein Button), damit Mittelklick und „In neuem
Tab öffnen“ am Desktop gehen. Die Zielfläche des Links ist die ganze Titelzeile, mindestens 44 px
hoch.

**Kontext aus dem Push (zweite Stufe):** Ein Push darf den Anlass als Query mitgeben
(`?anlass=nah`, `?anlass=faellig`). Die Ansicht hebt dann die passende Zeile hervor (Entfernung
bzw. Fälligkeit, Textfarbe `--pp-signal-ink` plus Icon) und entfernt den Parameter danach per
`replace`, wie beim Anker-Sprung im Push-Konzept. Ohne Parameter sieht die Ansicht gleich aus.

## 7. Zustände

| Zustand                | Darstellung                                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Laden                  | Skelett in der Form der Ansicht (Titelbalken, drei Faktenzeilen), kein Spinner: die Struktur ist bekannt                                                |
| nicht gefunden         | `KolAlert _variant="card"`: „Diese Aufgabe gibt es nicht mehr.“ bzw. „Diese Serie gibt es nicht mehr.“, darunter Link „Zu den Aufgaben“/„Zu den Serien“ |
| kein Zugriff           | wie „nicht gefunden“ (keine Auskunft, ob es die Aufgabe gibt)                                                                                           |
| Ladefehler             | `KolAlert _type="error"` mit „Erneut laden“                                                                                                             |
| Aktion schlägt fehl    | Fehler als `KolAlert` über der Primäraktion, Zustand springt zurück; kein Toast als einziger Ort                                                        |
| erledigt per Push-Ziel | normale Ansicht im Zustand „erledigt“ (Abschnitt 4.3), kein Fehler                                                                                      |

Nach Speichern im Bearbeiten-Dialog zeigt die Ansicht die neuen Werte ohne Neuladen der Seite
(vorhandenes `tasksChanged`-Signal). Nach Löschen geht es zur Herkunftsliste, der Fokus landet auf
deren Überschrift.

## 8. Desktop ab 48rem

Eine Spalte bis 48rem. Darüber zwei Spalten: links Inhalt (Checkliste, Beschreibung,
Unteraufgaben, Abhängigkeiten bzw. Instanzen), rechts eine schmale Faktenspalte (Kernzeile, Ort,
Einordnung, Herkunft) mit der Primäraktion oben statt sticky unten. Die Seite bleibt in der
Inhaltsbreite der App (`max-width: 80rem`), der Fließtext auf 65–75 Zeichen.

## 9. Bausteine

Alles aus KoliBri, keine eigenen Bedienelemente:

| Zweck                    | Komponente                                                           |
| ------------------------ | -------------------------------------------------------------------- |
| Titel, Abschnitte        | `KolHeading` (`_level` 1, 2)                                         |
| Marker                   | `KolBadge` mit den Farben aus `badgeColors.ts`                       |
| Primäraktion             | `KolButton _variant="primary"`, genau eine                           |
| Zurück, Bearbeiten, …    | `KolButton` sekundär bzw. `ghost`, „…“ als Popover wie in `TaskTree` |
| Checkliste               | `KolInputCheckbox`                                                   |
| Links zu Ansichten       | `KolLink`                                                            |
| Mehr Details, KI-Entwurf | `KolDetails` (Regel 1 der aufklappbaren Bereiche)                    |
| Hinweise, Fehler         | `KolAlert`                                                           |

Wiederverwendet werden die Formatierer und Badges aus `lib/task.ts`, `lib/series.ts` und `TaskTree`
(`priorityBadge`, `formatDeadline`, `formatRelativeDeadline`, `doneBlockedHint`, `seriesBadge`).
Die Badge-Zeile des Kopfs sollte aus `TaskTree` herausgelöst und dort wie hier genutzt werden,
statt sie nachzubauen.

## 10. Bewusst nicht enthalten

- Inline-Bearbeiten von Titel, Beschreibung, Datum. Das bleibt beim Formular (Grundsatz 4).
- Kommentare, Änderungsverlauf, Aktivitätslog.
- Teilen-Link nach außen. Die Route funktioniert für Gruppenmitglieder mit Zugriff, mehr nicht.
- Eine eigene Ansicht für Unteraufgaben: Sie nutzen die Aufgabenansicht, oben mit „Teil von
  „Arzttermin““ als Link zur Elternaufgabe.

## 11. Offene Fragen

1. **Nächste Termine:** Feld in der Serien-Antwort (`nextDates`) oder eigener Endpunkt? Empfehlung:
   Feld, berechnet mit `nextOccurrence`, höchstens drei Termine.
2. **Abruf-Aufgaben einer Vorlage:** Reicht `originSeriesId` aus der geladenen Aufgabenliste, oder
   fehlen archivierte/erledigte Aufgaben darin? Bei Lücken genügt ein Filter am vorhandenen
   `GET /tasks`.
3. **Pünktlichkeit im Serien-Verlauf:** Liegt die Pünktlichkeit je Instanz vor (Deadline vs.
   `completedAt`) oder wird sie nur für Punkte berechnet? Ohne Daten fällt die Angabe weg, das
   Erledigt-Datum bleibt.

## 12. Vorschlag für den Issue-Schnitt

| #   | Issue                                                                                                                                | Aufwand | blockiert durch |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | ------- | --------------- |
| 1   | Route `/aufgaben/<id>` mit Aufgabenansicht: Kopf, Kernzeile, Beschreibung, Mehr Details, Zustände, Bearbeiten/„…“                    | M       | –               |
| 2   | Aufgabenansicht: Checkliste abhaken, Primäraktion nach Zustand (Erledigt, gesperrt, Wieder öffnen, Wiederherstellen)                 | M       | 1               |
| 3   | Aufgabenansicht: Unteraufgaben, Abhängigkeiten, Herkunft, Ort, Einordnung                                                            | M       | 1               |
| 4   | Einstiege: Titel-Links in Baum, Dashboard-Karten, Serien-Tab, Graph-Auswahl; `/tasks/<id>` leitet um, Pushes senden `/aufgaben/<id>` | M       | 1               |
| 5   | Route `/serien/<id>`: Serien- und Vorlagenansicht inkl. Primäraktion, offene und erledigte Instanzen                                 | M       | 1               |
| 6   | Server: nächste drei Termine einer Serie; Rhythmus-Block der Serienansicht                                                           | S       | 5               |
| 7   | Push-Anlass `?anlass=` mit Hervorhebung (zweite Stufe)                                                                               | S       | 4               |

Jedes Issue bringt einen e2e-Test bei 375×812, der den Kernpunkt festhält; Issue 4 prüft
`frontend/e2e/` auf Specs, die heute den Bearbeiten-Dialog nach einem Deep-Link erwarten.
