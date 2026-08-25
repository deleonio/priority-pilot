# Triage #1020 — UX/UI Erledigte Aufgaben (Tabellen-Layout)

## Erledigt
- 2026-08-25 Erst-Triage: Titel optimiert, Body lektoriert, Analyse-Block (stand=12:42:13Z) in Body, VERDICT analyzed (🟡).
- 2026-08-25 Re-Triage (dieser Lauf): Delta-Kommentar von @deleonio 12:50:56Z gelesen — **Nutzer-Entscheidung: Mobil-Karten-Modus soll ENTFALLEN, Umstieg auf KolTable** (KoliBri scrollt intern, App-Container gibt max. Breite vor). Code gegengeprüft: CompletedTasksTable.tsx komplett, completed-tasks.spec.ts AK-6/AK-307-5-Stellen, TaskTable.tsx:172-173, KoliBri-Spec table-stateful geholt. Neuen Analyse-Block (stand=12:55:16Z) in Body geschrieben, Ampel 🟢, VERDICT: spec-ready.

## Relevante Stellen
- `frontend/src/components/CompletedTasksTable.tsx` — DIE Komponente. Native `<table>` (Z. 67) mit Headern „Titel"/`pillar.name`/„Aktion" (Z. 71-78); Kommentar Z. 26-34 begründet native Tabelle mit AK-6 — bei Umbau MIT ÄNDERN (Begründung ist obsolet). `data-label` an td (Z. 87) ist Karten-Modus-Selektor, fällt weg. KolToolbar „Wieder öffnen" (Z. 92-106) muss in KolTable-Zelle weiterlaufen.
- `frontend/src/components/TaskTable.tsx:172-173` — Vorbild für Umbau: `KolTableStateful _label/_data/_headers/_fixedCols={[0,1]}`. TaskTable setzt KEINE width/minWidth in Headers — Breitensteuerung dort nicht vorgezeichnet.
- `frontend/src/app.css:1524-1650` — `.completed-tasks*`-Blöcke inkl. Karten-Modus (<48rem, `td[data-label]::before`, Media-Query ab 1593) — großteils ENTFERNEN/bereinigen.
- `frontend/e2e/completed-tasks.spec.ts:170-186` (AK-6: 375px kein horizontales Scrollen, scrollWidth≤375) und `:314-333` (AK-307-5 Toolbar bei 375px, gleiche scrollWidth-Prüfung) — AK-6-Test ist mit Nutzer-Entscheidung obsolet → anpassen/streichen; `:274-275` nutzt `td[data-label]`-Selektor (Karten-Modus!) → auf KolTable-DOM umstellen.
- `frontend/e2e/done-toggle.spec.ts`, `done-auto-remove.spec.ts` — müssen grün bleiben.
- `frontend/src/components/Dashboard.test.tsx` — einziger Vitest-Ort für CompletedTasksTable (kein eigenes test.tsx).
- KoliBri-Spec `spec/table-stateful` (via mcp fetch) — Props: `_data`, `_headers` (horizontal: KoliBriTableHeaderCellWithLogic[][]), `_label`, `_fixedCols`, `_pagination`, `_selection`.

## Annahmen
- @deleonio ist berechtigt, #228 AK-6 außer Kraft zu setzen (wirkt wie Maintainer-Entscheidung; Issue-Autor-Kontext).
- „seitliches Scrollen" künftig INNERHALB KolTable (Shadow-DOM), Seiten-Shell clippt weiter `overflow-x: hidden` (MEMORY 2026-08-24) → Seiten-scrollWidth-Assertions bleiben erfüllbar.
- Keine Zerlegung: weiterhin eine Schicht (Frontend), 1 PR machbar (Komponente + CSS + e2e-Anpassung zusammengehörig).

## Verworfen
- Zerlegung in Sub-Issues — ein Anliegen, ein PR (wie Erst-Triage).
- Eigene Breiten-Recherche in KoliBri-Header-Cell-Feldern (`width`/`minWidth`) — Spec nennt Typ nur namentlich; als „unklar" im Analyse-Block an UX/Spec delegiert statt raten.

## Offen
- (aus Erst-Triage) `.ai-memory/tmp-1020-comment.md` löschen — Sandbox lehnt rm ab, harmlos gitignored.
- Wie kurz werden Säule-Header konkret (Kürzel/Abkürzung/title) — UX-Entscheidung.
- Breitensteuerung KolTable: Header-Cell-Props vs. CSS — in UX/Spec klären (TaskTable gibt kein Vorbild).

## Nächster Schritt
- UX-Phase: Entwurf KolTable-Umbau (Kurz-Header, Breiten, interne Scroll) + Karten-Modus-Entfernung; danach Spec (Vitest in Dashboard.test.tsx + e2e-Umbau AK-6).

## Fallstricke
- e2e `td[data-label]`-Selektoren (spec.ts:274) matchen nach Umbau nichts mehr — mit ändern, sonst falsch-grün/Timeout.
- AK-6-Streichung im Spec/PR begründen mit Nutzer-Kommentar 2026-08-25 12:50Z (Ticket-Historie), sonst wirkt sie wie Regressions-Rauschen.
- `forestTaskIds`-Filter (Doppel-DOM #228) ist KEIN Karten-Modus-Bestandteil — unangetastet lassen.
- app.css geteilt — nur `.completed-tasks*`-Blöcke anfassen.
- gh-Kommentare mit Body per `--body-file` (Unicode-Anführungszeichen sonst Bash-Fehler, s. MEMORY).
- Sandbox lehnt `rm`/Compound-`{ }` ab → Schritte einzeln.
