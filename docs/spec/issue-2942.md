# Spec #2942 — Serien- und Vorlagenansicht `/serien/<id>` (Ansichten Teil 5, Leseseite)

Verbindliche Grundlagen: `docs/ux-konzept-ansichten.md` (Abschnitte 3, 5, 7, 8, 9) und der
KI-UX-Block im Harness-Kommentar. Container-Entscheidungen zu #2937: Instanzlisten über Filter am
vorhandenen `GET /tasks` (`seriesId`/`originSeriesId`), „Nächste Termine" ist Teil 6 (#2943),
Pünktlichkeit entfällt — „Zuletzt erledigt" zeigt das Erledigt-Datum (`completedAt`).

## Ziel

`/app/serien/<id>` zeigt eine Serie („Vorlage" = Serie mit `autoCreate === false`, ADR 0020) als
Leseseite mit einer Primäraktion unten. Einstiege (Titel-Link, Badge-Link) sind Teil 4 (#2941) und
bleiben unberührt; `routes/templates.ts` (importierbare Lebensbereich-Pakete) gehört nicht hierher.

## Datenbasis

- `GET /series/:id` (vorhanden, fremde ID → 404) liefert Kopf und vererbte Werte.
- Instanzlisten über Filter am vorhandenen `GET /tasks`: `?seriesId=<id>` bzw.
  `?originSeriesId=<id>` — beide liefern **alle** Instanzen im Lese-Scope des Nutzers, inklusive
  erledigter und archivierter; der bestehende Archiv-Ausschluss gilt in Kombination mit diesen
  Parametern nicht. Fremde (fremdzugreifende) Serie → leere Liste; ohne Parameter bleibt das
  Verhalten unverändert (`api.ts`: `listTasks` um Query-Parameter erweitern, `openapi.yml`
  accordingly — Umsetzung Phase 4).

## Ansicht `SeriesView` (eine Komponente, zwei Ausprägungen via `autoCreate`, Konzept §5)

- Kopf: Titel als `KolHeading _level={1}`, Badge-Zeile (Prioritäts-Badge, Muster `TaskView`).
- Rhythmus-Klartext mit Startdatum (`seriesTab.rhythm.<rhythm>` + `formatDeadline`), **keine**
  „Nächste:"-Termine (Teil 6). Ruhende Serie (`active=false`): „Pausiert" statt Terminen;
  „Fortsetzen" über vorhandenes PATCH — Sekundäraktion, kein eigener AK.
- Serie (`autoCreate=true`): Block „Offene Aufgaben" (Instanzen mit `seriesId`, Status ≠ Done),
  Block „Zuletzt erledigt" (max. 5, mit `completedAt`-Datum), Block „Jede Aufgabe bekommt"
  (Aufwand, Checkliste nur lesbar als Zähler „Checkliste (2)" — KEINE Checkbox, Säulen, Ort,
  Beschreibung, Auto-Löschen).
- Vorlage (`autoCreate=false`): statt Rhythmus-Block „Entsteht nur auf Abruf." mit Datum der
  letzten Anlage; Block „Die Aufgabe bekommt" **steht vor** der Liste „Daraus angelegt"
  (`originSeriesId`: offene + letzte erledigte Abruf-Aufgaben).
- Listen ohne Inhalt bekommen keinen Block mit leerer Überschrift („Leer bleibt leer", §2.6).
- Primäraktion unten (sticky, Daumenzone; ab 48rem oben): Serie „Aufgabe jetzt anlegen", Vorlage
  „Aufgabe aus Vorlage anlegen" — öffnet den vorhandenen `SeriesInstanceDialog`; nach erfolgreichem
  Anlegen Navigation auf `/aufgaben/<id>` der neuen Aufgabe (Fokus auf die h1 dort).
- Instanz-Zeilen sind Links auf `/aufgaben/<id>` (ganze Zeile, ≥ 44 px hoch).
- „Bearbeiten" oben öffnet den vorhandenen Serien-Dialog; nach dem Speichern löst der bekannte
  `TASKS_CHANGED_EVENT` den erneuten Abruf aus — die Ansicht übernimmt die Werte ohne Neuladen.

## Layout (Konzept §8)

Eine Spalte bei 375 px; ab 48rem zwei Spalten (Inhalt links `.series-view-content`, schmale
Faktenspalte rechts `.series-view-facts`), Primäraktion wechselt von sticky-unten nach oben.

## Zustände

| Zustand                    | Anzeige                                                                                                                                      |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Laden                      | Skelett in der Form der Ansicht (`.series-view-skeleton`), kein Spinner, kein Alert                                                          |
| 404 (unbekannte/fremde ID) | `KolAlert _variant="card"` „Diese Serie gibt es nicht mehr." (`seriesView.seriesGone`) + Link „Zu den Serien" → `/app/serien`; KEIN Redirect |
| sonstiger Ladefehler       | `KolAlert _type="error"` „Daten konnten nicht geladen werden" (`app:shell.loadFailed`) + KolButton „Erneut laden"                            |
| Erfolg                     | Leseseite wie oben                                                                                                                           |

## i18n (Namespace `seriesView`, de/en)

Neu u. a.: `seriesGone` („Diese Serie gibt es nicht mehr."), `toSeries` („Zu den Serien"),
`openTasks` („Offene Aufgaben"), `lastCompleted` („Zuletzt erledigt"), `everyTaskGets` („Jede
Aufgabe bekommt"), `templateTaskGets` („Die Aufgabe bekommt"), `fromTemplate` („Daraus angelegt"),
`onDemand` („Entsteht nur auf Abruf."), `primarySeries` („Aufgabe jetzt anlegen"),
`primaryTemplate` („Aufgabe aus Vorlage anlegen"), `paused` („Pausiert"), `checklist`
(„Checkliste"). Wiederverwendet: `seriesTab.rhythm.<rhythm>`, `app:shell.loadFailed`.

## Testfälle (Zuordnung)

| AK  | Test                                                                                                                                                      | Datei                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| AK1 | TF1: `?seriesId=`/`?originSeriesId=` liefern offene + erledigte + archivierte + abgekoppelte Instanzen; fremder Nutzer → leer; ohne Parameter unverändert | `server/src/express/tasks-series-filter.test.ts`   |
| AK2 | TF2: Serie bei 375×812 — h1, Badge, Rhythmus-Klartext + Startdatum (kein „Nächste"), offene/erledigte Instanzen, Zeilen → `/aufgaben/<id>`                | `frontend/e2e/serien-ansicht.spec.ts`              |
| AK3 | TF3: Vorlage — „Entsteht nur auf Abruf.", „Die Aufgabe bekommt" vor „Daraus angelegt", kein Rhythmus-Block                                                | `frontend/e2e/serien-ansicht.spec.ts`              |
| AK4 | TF4: Primäraktion → `SeriesInstanceDialog`, Anlegen → URL `/aufgaben/<id>` mit Titel der neuen Aufgabe                                                    | `frontend/e2e/serien-ansicht.spec.ts`              |
| AK5 | TF5: 404-Alert + Link, Skelett beim Laden, `TASKS_CHANGED_EVENT` → erneuter Abruf (Vitest); 404 auch e2e                                                  | `frontend/src/components/SeriesView.test.tsx`, e2e |
| AK6 | TF6: ab 48rem zwei Spalten + Primäraktion oben, bei 375 px eine Spalte + Primäraktion unten                                                               | `frontend/e2e/serien-ansicht.spec.ts`              |

Nicht extra getestet (Randbedingungen, Review-Sache): Matomo-`known`-Regex, `activeTab`-Präfix,
`lastMainViewRef`, h1-Unterdrückung (App-Verdrahtung wie #2938), Safe-Area-Inset der
Primäraktion, ruhende Serie (sekundär, kein AK).
