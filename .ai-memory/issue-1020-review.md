# Review #1024 (PR #1024) — KOMPLETT

## Erledigt
- 2026-08-25 Runde 1 (KREUZVERHÖR): 3 Findings (F1 Host-Überlauf 375px, F2 Messtechnik count=0, F3 _fixedCols-Semantik), GH-Review 5019624840, Sammelkommentar angelegt, Titel-Gate erledigt, VERDICT needs-fixup.
- 2026-08-25 Runde 2 (FIXUP-NACHWEIS): Zwischenlauf hatte Sammelkommentar bereits auf fixup-applied fortgeschrieben (alle 3 behoben via bae1f1fd), aber KEIN Verdict geliefert. Dieser Lauf: kein Commit nach updatedAt, Fixup-Diff bae1f1fd adversarial gegengeprüft (siehe Relevante Stellen), CI auf Head grün (verify, precheck, e2e 1–4), Sammelkommentar 5411292417 per PATCH auf `reviewed` aktualisiert (15:03:34Z), **VERDICT: reviewed**. Review-Phase abgeschlossen.

## Relevante Stellen
- `frontend/src/app.css:411` — F1-Fix: `--grid-template-columns: minmax(0, 1fr)` auf `.app-tabs` (Root Cause KolTabs-Grid, ausführlicher Kommentar); einzige `.app-tabs`-Verwendung App.tsx:501, e2e-Suite aller Shards grün → kein Fremd-Regressionsrisiko.
- `frontend/src/components/CompletedTasksTable.tsx:155` — F3-Fix: `_fixedCols={[1,1]}`; Kommentar Z. ~70 erklärt KoliBri-Semantik (Anzahl von Anfang/Ende). Spec + Vitest test.tsx:88 synchron angepasst.
- `frontend/src/components/CompletedTasksTable.tsx:47` — `pillarHeaderWidth()` (8,5px/Zeichen + 24 Padding + 16 Reserve, dokumentierte Schätzung): Punkte-Spalten einzeilig bei realistischen Säulennamen; AK2-Geometrie grün in CI.
- `frontend/e2e/completed-tasks.spec.ts:233/279` — F2-Fix: `el.shadowRoot ?? el` als Einstiegspunkt für findScroller + kolHeaderGeometry-Collect (Light-DOM des Hosts ist leer); je `eslint-disable-next-line no-restricted-syntax` mit Begründung.

## Annahmen
- CI-Lauf 32862381023 (e2e 1–4, verify) lief auf Head bae1f1fd — Status via gh pr checks verifiziert.
- pillarHeaderWidth-Heuristik kann bei extremen Glyphen-Mischungen theoretisch knapper werden — dokumentiert, CI grün, kein Handlungsbedarf.

## Verworfen
- Neue Inline-Findings zum Fixup — keiner gefunden (nur Verifizierung, kein Aufrollen unveränderter Teile).
- MEMORY.md-Dauereintrag — kein ticket-übergreifendes, nicht-offensichtliches Learning.

## Offen
- -

## Nächster Schritt
- Keiner — Review abgeschlossen (reviewed). Workflow übernimmt Merge-Gate/Labels.

## Fallstricke
- Sammelkommentar 5411292417 ist der EINZIGE ai-review-Kommentar — weiter per PATCH fortschreiben, nicht neu anlegen.
- Titel-Gate bereits erledigt (`feat(frontend): rebuild completed tasks table as KolTableStateful (#1020)`) — nicht erneut anfassen.
- Unicode-Bodies per --body-file + jq --rawfile (hat funktioniert).
