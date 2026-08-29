# Issue 1110 — Review (PR #1114), Stand 2026-08-29

## Erledigt
- Erstrunde (Kreuzverhör) + Fixup-Nachweis abgeschlossen. Sammelkommentar = eine `<!-- ai-review -->`-Nachricht, ID `5461322787` (Issues-API-Kommentar), zuletzt gepatcht 2026-08-29T08:58:19Z → Endstand `reviewed` 🟢.
- Erstrunde: 2 Findings als Inline-Kommentare gepostet — F1 🔴 e2e-Isolation (`issue-1110-nearby-radius.spec.ts`, CI Run 33242931315 `e2e (2)` rot durch #1098-AK7-Kontamination), F2 🟡 `notifyTasksChanged()` durch `if (!isSeriesMode)` unterdrückt (`TaskForm.tsx:675`).
- Fixup-Commit `13f147ad` verifiziert: F1 = `setDisplayDistance(page, 5)` in allen 4 Tests + `afterEach`-Reset (:73-74), F2 = `notifyTasksChanged();` bedingungslos. Beides exakt wie vorgeschlagen, kein neuer Befund im Delta → `reviewed`.
- Titel-Gate bestanden („feat(frontend): nearby radius title and real distances (#1110)", 62 Zeichen) — kein Rename nötig.

## Relevante Stellen
- `.ai-memory/issue-1114-comment.md` — Wegwerf-Artefakt (Sammelkommentar-Body), NICHT committen.
- `frontend/e2e/issue-1110-nearby-radius.spec.ts:56-61` — Helper `setDisplayDistance` (PUT /geo-config mit `expect(response.ok())`-Guard); Preconditions-Muster jetzt Referenz für Specs, die von gemeinsamen Config-Werten abhängen.
- `frontend/src/components/TaskForm.tsx:675` — unbedingtes `notifyTasksChanged()`; Echo-Guard-Zweig :967-972 weiter unit-uncovered (nicht-blockend).

## Annahmen
- CI auf Fixup-Head `9d0bfae7` (Run 33244248400) war beim Verdict noch pending, nicht rot — 🟢 gilt inhaltlich; Gate/Merge entscheidet der deterministische Check.

## Verworfen
- Neue Serien-e2e (F2, ausdrücklich optional) — Verhalten über denselben Listener-Pfad gedeckt, Fixup-Notiz begründet den Verzicht.
- `issue-1098-geo-settings.spec.ts` (Quelle der Kontamination) ändern — außerhalb des PR-Scopes; der eigene afterEach-Reset reicht.

## Offen
- -

## Nächster Schritt
- -

## Fallstricke
- E2E-User ist gemeinsame Infrastruktur: Specs, die Config-Werte (geo-config) ändern, müssen sie selbst setzen UND im afterEach zurücksetzen, sonst Shard-Reihenfolgen-Rot.
- Sammelkommentar-Update via `gh api --method PATCH repos/.../issues/comments/<id>` (Issues-API), nicht `gh pr comment --edit-last`.
