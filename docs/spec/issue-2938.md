# Spec #2938 — Aufgaben-Ansicht `/aufgaben/<id>` (Schnitt-Teil 1, Leseseite)

Verbindliche Grundlagen: `docs/ux-konzept-ansichten.md` (Abschnitte 3, 4.1/4.2, 7, 8, 9) und der
KI-UX-Block im Harness-Kommentar. Dieses Ticket ist Schnitt-Teil 1: reine Leseseite — kein
Abhaken, keine sticky Primäraktion, keine Unteraufgaben-/Abhängigkeits-/Herkunfts-Listen.

## Ziel

`/aufgaben/<id>` (Browser-Pfad `/app/aufgaben/<id>`) zeigt eine Aufgabe als Leseseite mit
Kopfzeilen-Aktionen „Zurück", „Bearbeiten" und „…"-Menü. Backend unverändert (vorhandenes
`GET /tasks/:id`, fremde/unbekannte ID → 404).

## Verdrahtung in `App.tsx`

- Route über Präfix-Match `/^\/aufgaben\/(\d+)$/` (Muster `App.tsx:879`); die Ansicht liegt über
  der Hauptansicht (Muster `/hilfe`/`/settings`, `App.tsx:224`).
- Der Aufgaben-Tab bleibt markiert: `activeTab` löst `/aufgaben/<id>` per Präfix-Match auf Index 1
  auf (bisher exakter `ROUTE_PATHS.indexOf`).
- Matomo-`known`-Regex (`App.tsx:405`) um `aufgaben` erweitern, sonst zählt die Ansicht als 404.
- `lastMainViewRef` (`App.tsx:805`): `/aufgaben/<id>` zählt NICHT als Hauptansicht — „Zurück" ohne
  Vorgänger (Push-Einstieg/Kaltstart) fällt auf `/` zurück.
- Deep-Link `/tasks/<id>` (Bearbeiten-Dialog + Redirect, `App.tsx:878`) bleibt UNBERÜHRT — die
  `replace`-Umleitung auf `/aufgaben/<id>` ist Teil 4 des Schnitts.

## Neuer Baustein `TaskView` (`frontend/src/components/TaskView.tsx`)

- Props: `{ taskId: number; onBack: () => void; onEdit: (task: Task) => void }`.
- Daten: neue API-Fassaden-Methode `getTask({ id }: { id: number }): Promise<Task>` (`GET
/tasks/{id}`, `!response.ok` → `ResponseError`) — 404 bleibt als Status unterscheidbar.
- Kopf: Titel als `KolHeading _level={1}`, Badge-Zeile (Status-/Prioritäts-Badges) als gemeinsame
  Komponente, die aus `TaskTree` herausgelöst und in beiden genutzt wird (Abschnitt 9, nicht
  kopiert — vorhandene `TaskTree`-Tests bleiben der Maßstab).
- Kopfzeilen-Aktionen: „Zurück" (`common:actions.back`, ruft `onBack`), „Bearbeiten"
  (`common:actions.edit`, ruft `onEdit(task)` → vorhandenes `TaskFormModal`), „…"-Menü als
  icon-only `KolPopoverButton` mit `_label` (Pflicht, Regel 2).
- Kernzeile: Fälligkeit relativ (`formatRelativeDeadline`, z. B. „in 12 Tagen") und absolut
  (`formatDeadline`, „15.01.2030"), Aufwand (`formatNumber`, z. B. „0,75").
- Beschreibung als Fließtext mit erhaltenen Zeilenumbrüchen.
- „Mehr Details": eingeklapptes `KolDetails _label="Mehr Details"` mit Ort, Einordnung
  (Säulen-Zuordnung) und Meta-Angaben. **Felder ohne Wert erscheinen nicht** (kein „Ort: –").
- Layout: eine Spalte bis 48rem (`task-view-content` über `task-view-facts`), ab 48rem zwei
  Spalten nebeneinander (Inhalt links, schmale Faktenspalte rechts) — Abschnitt 8.
- Nur `--pp`-Tokens; „nicht gefunden" als `KolAlert _variant="card"`, Ladefehler als
  `KolAlert _type="error"`; Skelett als Light-DOM/CSS.

## Zustände

| Zustand                    | Anzeige                                                                                                                                                                      |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Laden                      | Skelett in der Form der Ansicht (`.task-view-skeleton` mit Titelbalken `.task-view-skeleton-title` und mindestens zwei Faktenzeilen `.task-view-skeleton-row`), kein Spinner |
| 404 (unbekannte/fremde ID) | `KolAlert` „Diese Aufgabe gibt es nicht mehr." (`app:shell.taskGone`) + Link „Zu den Aufgaben" → `/aufgaben`; KEIN Formular, KEINE Weiterleitung — die Route bleibt stehen   |
| sonstiger Ladefehler       | `KolAlert _type="error"` „Daten konnten nicht geladen werden" (`app:shell.loadFailed`) + KolButton „Erneut laden" → stößt denselben Abruf erneut an                          |
| Erfolg                     | Leseseite wie oben                                                                                                                                                           |

## i18n (`taskView`-Namespace, de/en)

Neu: `retry` („Erneut laden"/"Reload"), `moreDetails` („Mehr Details"/"More details"), `toTasks`
(„Zu den Aufgaben"/"To the tasks"), `deadline` („Fälligkeit"/"Deadline"), `effort`
(„Aufwand"/"Effort"), `address` („Ort"/"Location"), `assignment` („Einordnung"/"Assignment").
Wiederverwendet: `app:shell.taskGone`, `app:shell.loadFailed`, `common:actions.back`,
`common:actions.edit`.

## Testfälle (Zuordnung)

| AK  | Test                                                                                                          | Datei                                       |
| --- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| AK1 | TF1: Kopf (h1 + P4-Badge), Kernzeile (relativ + absolut, Aufwand), Beschreibung bei 375×812                   | `frontend/e2e/aufgaben-ansicht.spec.ts`     |
| AK2 | TF2: `/aufgaben/999999` → Nicht-gefunden-Alert + Link „Zu den Aufgaben", URL bleibt, kein Bearbeiten-Formular | `frontend/e2e/aufgaben-ansicht.spec.ts`     |
| AK3 | TF3: „Bearbeiten" öffnet `TaskFormModal` („Aufgabe bearbeiten: …"), „Zurück" → `/` (Fallback)                 | `frontend/e2e/aufgaben-ansicht.spec.ts`     |
| AK4 | TF4: API pending → Skelett ohne Alert; Fehler → Fehler-Alert + „Erneut laden" stößt neuen Abruf an            | `frontend/src/components/TaskView.test.tsx` |
| AK5 | TF5: 1024 px → Fakten-/Inhaltsspalte nebeneinander (x-Versatz), 375 px → untereinander                        | `frontend/e2e/aufgaben-ansicht.spec.ts`     |
| AK6 | TF6: ohne Adresse kein Ort-Block; mit Adresse steht der Ort im „Mehr Details"-Block                           | `frontend/src/components/TaskView.test.tsx` |

Nicht extra getestet (Randbedingungen, Review-Sache): Badge-Zeilen-Extraktion (Bestandsschutz
läuft über die vorhandenen `TaskTree`-Tests), Matomo-Regex, Tab-Markierung per Präfix.
