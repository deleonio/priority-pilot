# Spec: Aufgabenansicht — Unteraufgaben, Blockiert, Herkunft, Ort, Einordnung (#2940)

Teil 3 des Ansichten-Konzepts (`docs/ux-konzept-ansichten.md` Abschnitt 4.2), ergänzt die
Teil-1-Leseseite (`docs/spec/issue-2938.md`) um fünf Blöcke, die nur bei gefüllten Werten erscheinen
(„Leer bleibt leer“). Benennung des Abhängigkeiten-Blocks: **„Blockiert“** (PO- + UX-Entscheidung
2026-10-24) — das ist die `getDependents()`-Richtung (Aufgaben, die auf den angesehenen Task
warten); die Kinder-Richtung heißt „Unteraufgaben“. Keine zweite Liste für dieselbe Kante (#336).

## Server-Vertrag: `GET /tasks/:id/dependencies` (neu, lesend)

- 200 + JSON `{ subtasks: TaskRef[], dependents: TaskRef[] }` mit `TaskRef = { id, title, status }`.
- `subtasks` = direkte Unteraufgaben (`task.getDependencies()`, #336-Richtung) — **inklusive**
  Status `Done` (Zähler-Grundlage), **ohne** archivierte (`archivedAt != null`, #1964/#2188).
- `dependents` = Aufgaben, die auf diesen Task warten (`task.getDependents()`) — gleiche
  Sichtbarkeitsregel (nicht archiviert, Status inklusive `Done`).
- Owner-scoped: fremde oder unbekannte ID → 404 `{ message }` (Muster `GET /tasks/:id`, tasks.ts:888).

## AK1 — Unteraufgaben

Given Task P mit Unteraufgabe C (Kante: `POST /tasks/P/dependencies { dependingTaskId: C }`)
When die Ansicht `/aufgaben/P` geöffnet wird
Then erscheint der Block „Unteraufgaben“ mit je Zeile Status-Icon, Titel und Link auf
`/aufgaben/<KindId>`; der Zähler „X von Y“ in der Überschriftszeile zählt erledigte Kinder mit
(Server liefert `Done`-Kinder, archivierte nicht).

## AK2 — Blockiert

Given ein Task ohne Abhängigkeits-Kanten → weder „Unteraufgaben“- noch „Blockiert“-Block.
Given Task T, auf den W wartet (Kante: `POST /tasks/W/dependencies { dependingTaskId: T }`)
Then listet der Block „Blockiert“ von T aus W mit Status-Icon, Titel und Link auf `/aufgaben/<W>`.

## AK3 — Herkunft

Given Task mit `seriesId` → Block „Herkunft“: „Aus Serie „<Name>““ bzw. „Aus Vorlage „<Name>““
(wenn `autoCreate = false`), jeweils als KolLink auf `/serien/<id>`. `isException = true` →
Zusatztext „Abweichend von der Serie bearbeitet“ unter dem Link (nie nur Farbe). Löst sich die
Serie nicht mehr auf (Fehler/404, z. B. nur noch `originSeriesId`), entfällt der Block ohne
Fehlermeldung.

## AK4 — Ort

Given Task mit Adresse → eigener Block „Ort“ mit Adresse-Text; bei gesetzten Koordinaten
zusätzlich ein externer Karten-Link („In Karten öffnen“, als externes Ziel gekennzeichnet).
Ohne Adresse erscheint kein Ort-Block, und „Mehr Details“ entfällt komplett — der Teil-1-Ort
verlässt die eingeklappten Details (Test-Pflege: ersetzt TF6b aus #2938).

## AK5 — Einordnung

Given Task mit Säulen-Zuordnung (`pillars`) oder Kategorie → Block „Einordnung“ mit Säulenname(n)
als Text (Relief-Regel: nie Farbe allein) und Kategorie-Name. Ohne beide Werte entfällt der Block.

## AK6 — Mobile-First 375×812

Blöcke untereinander (eine Spalte), Listenzeilen als Touch-Target ≥ 44 px inkl. Padding, lange
Werte umbrechend, kein horizontales Scrollen. Layout-/Styling-AK → visuelle Verifikation im
Impl-PR (SKILL: kein erzwungener Stil-Test); das Ein-Spalten-Layout deckt der #2938-Test
„AK5: zwei Spalten ab 48rem, eine Spalte bei 375 px“ bereits ab.

## Testfälle

- **TF1** (AK1, e2e `frontend/e2e/aufgaben-ansicht.spec.ts`): P + C per API, C auf `Done` —
  Block sichtbar, Titel-Link `href=…/aufgaben/<C>`, Zähler „1 von 1“.
- **TF2** (AK2, e2e): blanker Task ohne Blöcke; T+W-Kante → „Blockiert“ listet W mit Link.
- **TF3** (AK3, e2e): Serie (`autoCreate`) → Instanz via `POST /series/:id/instances`, Link
  `href=…/serien/<id>`, Klick wechselt die URL (Zielansicht kommt mit #2942); Vorlage
  (`autoCreate: false`) → „Aus Vorlage“. `isException` und Serien-nicht-auflösbar als Unit
  (logiknah, API-getrieben).
- **TF4** (AK4, e2e): Task mit Adresse + Koordinaten → Ort-Block + Karten-Link, kein
  „Mehr Details“; ohne Adresse → kein Ort-Block.
- **TF5** (AK5 + AK3-Rest, Unit `frontend/src/components/TaskView.test.tsx`):
  `getPillars`/`getCategories`/`getSeries` gemockt — Einordnung erscheint/entfällt; Herkunft
  Serie/Vorlage, Abweichungshinweis, Serien-Fehler → Block entfällt.
- **TF6** (Server, `node:test`, neu `server/src/express/tasks-dependencies-read.test.ts`):
  Vertrag oben — beide Richtungen mit id/title/status, `Done`-Kind ja, archiviertes Kind nein,
  fremde ID → 404 mit message.
