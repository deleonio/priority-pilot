# Issue 1168 — Spec (Phase 3), Stand 2026-09-02T07:00:29Z

**ERGEBNIS: rote Tests geschrieben, Draft-PR erstellt (VERDICT ready).**

## Erledigt

- Branch `ai/harness/1168` ausgecheckt (bereits vorhanden, trug Phase-1/2-Notizen `1e3cecd4`/`41f752f3`); untracked Duplikate der Phasennotizen im Arbeitsverzeichnis waren byte-identisch mit dem committeten Stand → nach `/tmp/stash1168` verschoben statt überschrieben.
- Harness-Marker-Kommentar gelesen (`gh issue view 1168 --json comments --jq ...`), AK1–AK8 + TF1–TF8 daraus entnommen (kein erneutes Schreiben nötig, nur Lesezugriff).
- `docs/spec/issue-1168.md` neu angelegt: Vertrag `Dashboard` (`onStartTask` → `onCompleteTask`), neuer Vertrag `CompleteTaskDialog` (Props: `task`, `onConfirm`, `onClose`, `onCompleted`, `fallbackFocusRef`; Modal-Titel „Aufgabe erledigen"; Bestätigen-Button „Als erledigt markieren"; Fehler-Label „Erledigen fehlgeschlagen"), Verdrahtungsplan `App.tsx` (`DialogState`-Variante `{kind:'complete', task}`).
- TF1 (AK1) in `frontend/src/components/Dashboard.test.tsx:373-406` ergänzt: prüft `_label="Erledigt"`-Button im Panel, kein `_label="Jetzt starten"` mehr (Attribut-Query-Konvention, kein KoliBri-Mock nötig — Datei mockt `@public-ui/react-v19` bewusst NICHT, wie die 15 bestehenden Tests dort).
- **Kurskorrektur während des Laufs:** ursprünglich `frontend/src/components/CompleteTaskDialog.test.tsx` angelegt (Muster 1:1 von `ConfirmDeleteDialog.test.tsx`, statischer Import `./CompleteTaskDialog`). Der erste Commit-Versuch scheiterte am lefthook-Pre-Commit-Hook: `pnpm -r knip` meldet einen unauflösbaren Import (`Unresolved imports (1): ./CompleteTaskDialog`), weil die Datei im Spec-PR bewusst NICHT existieren darf (Spec-PR-Scope-Regel — kein Produktivcode, auch kein Stub). `@ts-expect-error` löst zwar `tsc`, aber NICHT `knip` (das scannt Importpfade statisch, unabhängig vom TS-Kommentar). Datei daher wieder gelöscht — TF2/TF6 stattdessen als e2e-Fälle in `issue-1168-dashboard-done-button.spec.ts` (s. u.) verlagert, dort greift der Dialog nur über Selektoren/Rollen, kein Modul-Import nötig. **Merke für Folge-Issues mit neuer Komponente:** eine reine Unit-Test-Datei, die eine im Spec-PR noch nicht existierende Komponente importiert, bricht `pnpm knip` im Pre-Commit-Hook — solche Fälle über e2e/Vitest gegen den aufrufenden Container (hier `Dashboard`) oder ausschließlich e2e abdecken, bis die Komponente in der Impl-Phase entsteht.
- Neu `frontend/e2e/issue-1168-dashboard-done-button.spec.ts` (TF3 AK2/AK4/AK5, TF4 Leerfall AK5, TF5 AK3, TF6 AK6 Fehlerfall via `page.route`-Mock auf `PUT /api/v1/tasks/{id}` → 500) — zwei Tasks mit `priority` 9/5 seeden (`findNextImportantTask` sortiert nach `priority` absteigend, `server/src/logics/find.ts:33`), Bestätigen/Abbrechen/Leerfall/Fehlerfall über echtes Backend (`page.request`) bzw. gezielten Route-Intercept nur für TF6.
- `frontend/e2e/issue-1042-dashboard-start-button.spec.ts` angepasst (TF7): Label-Erwartung `Jetzt starten` → `Erledigt` in `openDashboardWithStartButton`; Layout-AK1–AK3 unverändert (Selector `.dashboard-next-task-content > kol-button` bleibt gültig).
- `frontend/e2e/issue-1118-dashboard-section-cards.spec.ts` AK8-Test angepasst (TF8): Enter öffnet jetzt `heading` „Aufgabe erledigen" (statt generischem `dialog`-Locator), zusätzlich Escape-Assertion (Dialog verschwindet, Fokus kehrt zum Erledigt-Button zurück).
- Verifiziert: `npx vitest run src/components/Dashboard.test.tsx` → TF1 rot mit der erwarteten Assertion („Button mit _label=Erledigt fehlt"), alle 15 bestehenden Dashboard-Tests weiterhin grün. `npx tsc --noEmit -p .` und `npx eslint` auf allen geänderten/neuen Dateien: sauber. `npx knip --config knip.jsonc` (frontend): keine unaufgelösten Imports mehr.
- Commit `test: red spec tests for #1168` (nur Tests + Spec + Phasennotiz), Push, Draft-PR erstellt.

## Relevante Stellen

- `docs/spec/issue-1168.md` — der neue Vertrag; Folgephase (Impl) MUSS `onCompleteTask`, `CompleteTaskDialog`-Props, Modal-Titel „Aufgabe erledigen" und Button-Label „Als erledigt markieren" exakt so umsetzen, sonst laufen die Tests aus einem anderen Grund rot.
- `frontend/src/components/Dashboard.tsx:198-205` — hier muss der Button-Block auf `onCompleteTask`/`_label="Erledigt"`/`fa-solid fa-check` umgestellt werden (Impl-Phase).
- `frontend/src/App.tsx:44-49,611,378-422` — `DialogState`-Union + Verdrahtung + Erledigt-Pfad-Vorlage (unverändert von Triage-Notiz übernommen, hier nochmal verifiziert).
- `frontend/src/components/ConfirmDeleteDialog.tsx`, `Modal.tsx` — Vorlage für `CompleteTaskDialog.tsx` (Impl-Phase erstellt diese Datei neu).

## Annahmen

- Modal-Titel „Aufgabe erledigen" und Button-Label „Als erledigt markieren" waren im Harness-Block NICHT AK-vorgegeben (nur UX-Empfehlung ähnlichen Wortlauts) — hier als bindender Vertrag in der Spec festgeschrieben, damit Tests und Impl exakt zusammenpassen. Falls die Impl-Phase einen anderen Wortlaut für sinnvoller hält, muss sie die Spec UND die Tests gemeinsam anpassen (nicht nur den Code).
- `GET /next` bevorzugt höhere `priority` (server-seitig verifiziert in `find.ts:33`) — Seeds mit priority 9 vs. 5 sind daher deterministisch, nicht auf Insert-Reihenfolge angewiesen.

## Verworfen

- `ConfirmDeleteDialog` mit `_variant="danger"` wiederverwenden — von Triage/UX bereits verworfen, hier nur bestätigt (nicht-destruktive Aktion).
- Eigene Beschreibung/Titel-Wortlaut wörtlich aus dem UX-Block übernehmen ("Bestätigen" als Alternative) — Spec legt sich auf einen Wortlaut fest, UX nannte es „keine harte Vorgabe".

## Offen

- Keine offenen Fragen im Sinne des Skills (alle AKs testbar) — Abschnitt „Offene Fragen" im PR-Body bleibt leer/entfällt.
- `/tmp/stash1168/` (verschobene Duplikate `issue-1168-triage.md`/`issue-1168-ux.md`) ist ein Wegwerf-Ablageort außerhalb des Repos — keine Aufräum-Aktion nötig, liegt nicht im Arbeitsbaum.

## Nächster Schritt

- Impl-Phase (Label `ai:needs-impl` wird vom Workflow gesetzt): `CompleteTaskDialog.tsx` neu bauen, `Dashboard.tsx` Button umstellen, `App.tsx` verdrahten (PUT `/tasks/{id}` status Done + `reload()` ohne sticky-Pfad, da `handleDoneToggle`s `DONE_REMOVAL_DELAY_MS` fürs Panel nicht passt).

## Fallstricke

- Der TF3/TF4/TF5-E2E-Test nutzt `.dashboard-next-task-content` als Container-Assertion für den Folge-Task-Titel — falls die Impl den Klassennamen ändert, laufen die Tests aus dem falschen Grund rot.
- `frontend/e2e/issue-1118-dashboard-section-cards.spec.ts` AK8 verlangt jetzt exakt den Heading-Text „Aufgabe erledigen" — weicht die Impl-Phase vom Spec-Titel ab, bricht dieser Test zusätzlich zu TF3/TF4/TF5/TF6.
- Lefthook-Pre-Commit (`pnpm -r knip`) prüft ALLE Workspaces, nicht nur die geänderten Dateien — Importe auf noch nicht existierende Produktivdateien fliegen dort auf, auch wenn `tsc`/`eslint` (per `@ts-expect-error`) grün sind. Vor dem Commit immer `npx knip --config knip.jsonc` im betroffenen Workspace laufen lassen, wenn ein Spec-Test eine neue Komponente referenziert.
