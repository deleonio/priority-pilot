# Wochenansicht: erledigte Aufgaben am Deadline-Tag mit anzeigen (#2012)

**Stand:** 2026-10-04 (Spec-Phase #2012)

## Ziel

Die Wochenansicht blendet erledigte Aufgaben (Status `Done`) nicht mehr komplett aus: Eine
Tageskarte listet auch die erledigten Aufgaben mit Deadline = diesem Tag auf, klar von offenen
unterschieden. Tage, deren Aufgaben alle erledigt sind, wirken dadurch nicht mehr leer.

## Vorbedingung

Eingeloggter Nutzer, Dashboard-Tab mit geöffneter Wochenansicht. `GET /tasks` liefert Done-Tasks
bereits mit (nur `archivedAt: null` gefiltert, `server/src/express/routes/tasks.ts:595`) — die
Änderung ist rein frontendseitig in `frontend/src/components/WeekView.tsx` (Filter
`openTasksWithDeadline`, ~Z. 67) samt Styling in `frontend/src/app.css` (`.week-view-tasks`-Block).

## Verhalten

1. **AK1 — erledigte Aufgaben in der Tageskarte:** Jede Tageskarte zeigt zusätzlich die
   erledigten Aufgaben mit Deadline = diesem Tag; eine Karte, deren Aufgaben alle `Done` sind,
   enthält deren Titel und ist nicht leer. Die Done-Einträge erscheinen **unter** den offenen
   Einträgen der Karte (gleiche `ul.week-view-tasks`, danach sortiert).
2. **AK2 — eigene Kennzeichnung:** Erledigte Einträge tragen die dedizierte CSS-Klasse
   `week-view-done` (durchgestrichen, abgesenkte Deckkraft — Ausgestaltung in `app.css`),
   offene Einträge nicht. Damit sind beide Gruppen unterscheidbar.
3. **AK3 — Rest unverändert:** Tage ohne zugeordnete Aufgaben bleiben ohne Listeneinträge; die
   Empfehlungs-Dedup-Logik (`deadlineOutsideWeek`) und die `nextTask`-Anzeige bleiben unberührt —
   Empfehlungen/„nächste Aufgabe" sind offene Tasks und erscheinen weiterhin nur unter „heute"
   (bestehende #1617-Tests bleiben grün).
4. **AK4 — Mobile 375px:** Erledigte Einträge sind in den Tageskarten bei 375 px sichtbar, ohne
   horizontalen Overflow (bestehende responsive Kartenstruktur; Bounding-Box-Assertion statt
   `scrollWidth`, da die App-Shell Overflow-x clippt).

## Tests

- **TF1** (Vitest, `WeekView.test.tsx`): Tag mit nur erledigten Aufgaben → Titel erscheint in
  genau dieser Karte, in keiner anderen. Flipped den Bestands-Test „zeigt erledigte Aufgaben
  (Status Done) nicht in der Wochenansicht" (Z. 105) auf das Soll-Verhalten.
- **TF2** (Vitest, `WeekView.test.tsx`): Done-`li` trägt `week-view-done`, offenes `li` nicht;
  Done-Eintrag steht nach den offenen Einträgen.
- **TF3** (Vitest, `WeekView.test.tsx`): Tag ohne zugeordnete Aufgaben bleibt ohne `li`
  (Empfehlungs-/Nachbartag-Verhalten bereits durch Bestands-Tests abgedeckt — Dedup).
- **TF4** (E2E, `frontend/e2e/issue-1617-week-view.spec.ts`): erledigte Aufgabe erscheint in
  ihrer Tageskarte; bei 375 px ohne horizontalen Overflow (Bounding-Box).
