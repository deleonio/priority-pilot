# Issue 1063 — Review (Kreuzverhör, PR #1064)

## Erledigt
- MODE bestimmt: kein `<!-- ai-review -->`-Kommentar vorhanden → Kreuzverhör (Runde 1).
- Vollständiger PR-Diff gelesen (877 Zeilen: Modell/Migration/API/Logik/OpenAPI/TaskForm/GeoBadge/SeriesTab/CompletedTasksTable/CSS + Spec + Tests).
- Verifiziert: `git diff 8e9ae3a9 9001fc73 -- '*test*'` leer → Spec-Tests unverändert grün gefahren (Separation of Duties OK).
- Verifiziert: Kaskade nur auf offene Instanzen (`openInstancesWhere` mit `status != 'Done'`, server/src/express/routes/series.ts ~402).
- Verifiziert: E2e-Anker existieren (`series-tree-item-${id}` SeriesTab.tsx:144, `_task` DoneTaskRow CompletedTasksTable.tsx:60/101).
- CI-Stand: verify/precheck pass, e2e-Matrix pending (Gate-Workflow übernimmt).
- Sammelkommentar gepostet (Marker erste Zeile): issuecomment-5443550920, Review-Status reviewed, Footer „Review-Typ: Kreuzverhör".
- Titel-Gate: PR-Titel war Spec-Rest `test: rote Spec-Tests …` (deutsch, falscher Typ) → umbenannt in `feat(server): add series address field and geo badges in lists`.
- Verdict: reviewed → /tmp/claude-verdict.

## Relevante Stellen
- .ai-memory/issue-1063-review-comment.md — geposteter Kommentar-Body (Vorlage für Fixup-Runden).
- server/src/express/routes/series.ts — validateSeriesFields (address-Validierung), serializeSeries, Kaskade.
- frontend/src/components/GeoBadge.tsx — span role=img, testid+aria-label auf demselben Element (Vertrag).

## Annahmen
- E2e-Matrix wird grün (impl-Phase lokal 3/3, verify grün); falls rot, setzt pr-gate-merge needs-changes und der Fixup-Loop startet — kein Review-Thema.

## Verworfen
- Findings zu KolBadge-Abweichung und Migration über SERIES_TABLE_COLUMNS — beide im PR-Body begründet (Skill: begründete Abweichung ist kein Finding).
- MEMORY.md-Eintrag — glatter Lauf ohne neues Scheitern/Lösungsmuster (strenges Aufnahmekriterium).

## Offen
- keine

## Nächster Schritt
- Falls Fixup-Push kommt: FIXUP VERIFICATION — Sammelkommentar 5443550920 per PATCH updaten, nur Delta-Diff seit Updated prüfen.

## Fallstricke
- Beim Update des Sammelkommentars die ID 5443550920 wiederverwenden (PATCH issues/comments/<id>), keinen neuen Kommentar anlegen.
- Finding-Nummern gibt es (noch) keine — erste Runde war findungsfrei; Nummerierung beginnt ggf. erst in einer späteren Runde bei 1.
