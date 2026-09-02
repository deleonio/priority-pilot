# Issue 1168 — Implement (Phase 4), Stand 2026-09-02T07:20:00Z

**ERGEBNIS: Produktivcode grün, Draft-PR #1170 wird review-ready gemacht (VERDICT needs-review).**

## Erledigt

- Draft-PR #1170 auf `ai/harness/1168` ausgecheckt (Kollision mit lokalen untracked Duplikaten der
  Phasennotizen gelöst: byte-identisch mit `origin/ai/harness/1168` verifiziert per `diff`, dann `rm`
  + `git switch`).
- `frontend/src/components/CompleteTaskDialog.tsx` neu gebaut nach `docs/spec/issue-1168.md`: Modal-Titel
  „Aufgabe erledigen", Buttons Abbrechen (zuerst, Initialfokus) → „Als erledigt markieren" (primary, kein
  Danger), Fehler-Alert `_label="Erledigen fehlgeschlagen"` mit `toApiError`-Meldung, beide Buttons während
  `completing` deaktiviert. Struktur 1:1 am `ConfirmDeleteDialog`-Skelett orientiert, aber ohne
  `useCtrlEnter`/Danger-Variante (nicht destruktiv).
- `frontend/src/components/Dashboard.tsx:39-40,82,198-205` — Prop `onStartTask` → `onCompleteTask` (AK1),
  Button-Label „Erledigt", Icon `fa-solid fa-check` (UX-Empfehlung übernommen); Kommentar Z.175 angepasst.
- `frontend/src/App.tsx` — `Dialog`-Union um `{kind:'complete', task}` erweitert, `openComplete`, neue
  Aktion `completeTask(task)` (PATCH über `api.updateTask`, kein sticky-Pfad), Dashboard-Verdrahtung
  `onCompleteTask={openComplete}`, Dialog-Rendering nutzt bestehendes `afterMutation` (`setDialog(null)` +
  `reload()`) als `onCompleted` — identisch zum bereits vorhandenen Delete-Muster.
- `frontend/src/components/Dashboard.test.tsx:392` — das anticipierte `@ts-expect-error` (vom Spec selbst
  als temporär markiert, Kommentar Z.377 „Test ist rot, bis Dashboard.tsx die neue Prop trägt") entfernt,
  da es nach der Prop-Umstellung TS2578 (unused directive) auslöste. Reine Pragma-Entfernung, keine
  Assertion geändert.
- Gate: `pnpm format` (1 Datei reformatiert: `CompleteTaskDialog.tsx`), `pnpm exec prettier --check .`,
  `pnpm lint` (server+frontend), `pnpm knip` (nur pre-existing Config-Hints, keine unresolved imports),
  `pnpm test` (exit 0: server fail 0, frontend 492 passed/13 skipped, scripts 251 passed) — alle grün.
- E2E gezielt: `npx playwright test e2e/issue-1042-dashboard-start-button.spec.ts
  e2e/issue-1118-dashboard-section-cards.spec.ts` → **10/10 grün** (TF7 Layout-Vertrag, TF8 Tastatur+Enter
  öffnet Dialog+Escape schließt — bestätigt AK2/AK3/AK8 im echten Browser).
  `npx playwright test e2e/issue-1168-dashboard-done-button.spec.ts` → **TF4, TF5 grün** (AK5-Leerfall,
  AK3-Abbrechen bestätigt); **TF3, TF6 rot aus test-fremden Gründen** (s. Fallstricke) — als
  Test-Pflege-Bedarf im PR-Body dokumentiert, NICHT am Testcode geändert (Separation of Duties).

## Relevante Stellen

- `frontend/src/components/CompleteTaskDialog.tsx` (neu) — der Dialog selbst.
- `frontend/src/components/Dashboard.tsx:198-205` — Button-Umstellung.
- `frontend/src/App.tsx:47,375,397-411,617,798-805` — Dialog-Union, `openComplete`, `completeTask`,
  Dashboard-Prop, Dialog-Rendering.
- `frontend/src/components/Dashboard.test.tsx:373-406` — TF1/AK1, grün.

## Annahmen

- Wie in der Spec-Notiz: Modal-Titel/Button-Wortlaut sind spec-bindend, nicht nur UX-Empfehlung — 1:1
  übernommen.
- `afterMutation` (bereits vorhandener App-Callback: `setDialog(null)` + `reload()`) erfüllt exakt den
  Spec-Vertrag für `onCompleted` — kein neuer Callback nötig.

## Verworfen

- Eigene `afterComplete`-Funktion — `afterMutation` leistet exakt dasselbe (Präzedenzmuster wie bei
  `create`/`edit`/`dependencies`).

## Offen

- Keine.

## Nächster Schritt

- PR #1170 aus dem Draft nehmen (`gh pr ready 1170`), Beschreibung um Umsetzung + Test-Pflege-Bedarf
  erweitern, Review-Loop (SKILL Schritt 5) läuft danach eigenständig weiter.

## Fallstricke

- **TF3-Rotursache (test-fremd):** `frontend/e2e/issue-1168-dashboard-done-button.spec.ts:58` seedet
  Priorität 9 — das Sequelize-Model begrenzt `priority` auf `max: 5`
  (`server/src/models/task.ts:113-116`). Der `createTask()`-Helper (Z.28-32) prüft `response.ok()` NICHT,
  daher scheitert die POST-Anfrage für „Erste Aufgabe" still (400), nur die zweite Aufgabe (Priorität 5)
  existiert — TF3 bricht schon an der Vorbedingung `getByText('E2E #1168 Erste Aufgabe')`, nicht an
  #1168-Verhalten.
- **TF6-Rotursache (test-fremd):** Der `page.route`-Mock (Z.113-121) fängt nur `method() === 'PUT'` ab.
  `api.updateTask` (generiert aus `openapi.yml`, `frontend/src/api.ts:192`) sendet aber ein **PATCH**
  — identisch zum bereits bestehenden `handleDoneToggle`-Pfad (`App.tsx:385`). Der Mock greift nie, die
  echte PATCH-Anfrage gelingt, die Aufgabe wird tatsächlich erledigt (Panel zeigt danach den Leerzustand
  statt eines Fehler-Alerts) — kein Fehlverhalten der neuen Komponente, sondern ein falscher
  HTTP-Methoden-Assumption im Testmock.
- Beide Punkte sind reine Testfixture-Bugs (ungültige Seed-Daten bzw. falsche Methode im Mock), keine
  Verhaltensabweichung von `docs/spec/issue-1168.md`. Nicht am Testcode geändert (SKILL Separation of
  Duties) — im PR-Body als Test-Pflege-Bedarf dokumentiert.
- Lokal untracked Duplikate der Phasennotizen im Arbeitsverzeichnis kollidierten beim `git switch` —
  IMMER erst per `diff` gegen `origin/<branch>` auf Byte-Identität prüfen, bevor man sie löscht.
