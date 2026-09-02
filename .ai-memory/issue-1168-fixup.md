# Issue 1168 — Fixup (PR #1170), Stand 2026-09-02

## Erledigt
- ai-review-Kommentar (Runde 1, 🟡 needs-fixup) gelesen: genau 2 offene Findings, beide fixable, beide vom Autor im PR-Body bereits selbst diagnostiziert.
- Finding #1 (`frontend/e2e/issue-1168-dashboard-done-button.spec.ts:58`, TF3/AK2/AK4/AK5): Seed-Priorität `9` > Server-Limit `max: 5` (`server/src/models/task.ts:113-116`) → `createTask()` scheitert still (kein `response.ok()`-Check im Helper). Fix: erste Aufgabe `9`→`5`, zweite Aufgabe `5`→`2` (Reihenfolge bleibt deterministisch, beide ≤5).
- Finding #2 (`frontend/e2e/issue-1168-dashboard-done-button.spec.ts:114`, TF6/AK6): `page.route`-Mock filterte auf `method() === 'PUT'`, `api.updateTask` sendet aber PATCH (`frontend/src/api.ts:192-193`) → Fehlerfall nie getriggert. Fix: `'PUT'` → `'PATCH'`.
- Beide Edits angewandt, Gate (format/prettier/lint/knip/test) via gate-runner-Subagent grün (alle 5 Befehle exit 0).

## Relevante Stellen
- `frontend/e2e/issue-1168-dashboard-done-button.spec.ts:58,59,114` — die beiden Fixes.
- `server/src/models/task.ts:113-116` — Prioritäts-Obergrenze `max: 5` (Beleg für Finding #1).
- `frontend/src/api.ts:192-193` — `updateTask` nutzt PATCH (Beleg für Finding #2).

## Annahmen
- Der `createTask()`-Helper selbst (fehlender `response.ok()`-Check) wird NICHT geändert — das Review-Finding nennt es nur als Ursachenerklärung, der vorgeschlagene Fix betrifft ausschließlich die Prioritätswerte/Mock-Methode (Scope-Grenze: nur gemeldete Findings fixen).

## Verworfen
- Erweiterung des `createTask()`-Helpers um eine `response.ok()`-Assertion — nicht Teil des gemeldeten Findings, würde über den Scope hinausgehen.

## Offen
- Push und Thread-Resolve stehen noch aus (folgt direkt nach dieser Notiz).

## Nächster Schritt
- Committen+pushen, beide Review-Threads (Zeile 58 + 114) via GraphQL auflösen.

## Fallstricke
- Threads sind GraphQL-only (REST `pulls/{pr}/threads` existiert nicht) — Thread-IDs vorher per `reviewThreads`-Query holen, nach Pfad+Zeile matchen, nur `isResolved=false`.
