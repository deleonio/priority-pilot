# Review #1024 (PR #1024) — Kreuzverhör Erst-Runde

## Erledigt
- 2026-08-25 Review-Phase (KREUZVERHÖR, Erst-Review): Modus erkannt (0 Kommentare → kein ai-review-Marker), vollständigen Diff + Issue-AKs + CI geprüft. **VERDICT: needs-fixup** — 3 e2e rot in CI (Run 32854083826, e2e-Shard 1/4). Inline-Findings als GH-Review (COMMENT) gepostet (Review-ID 5019624840), Sammelkommentar <!-- ai-review --> angelegt (**Comment-ID 5411292417** — Folge-Runden per PATCH fortschreiben), PR-Titel via Gate umbenannt.

## Relevante Stellen
- `frontend/src/components/CompletedTasksTable.tsx:146` — KolTableStateful-Render OHNE Host-Breiten-Constraint; CI: hostRight=468 > 376 bei 375px (AK3/AK-307-5 rot). Header-width 360+96 (Z. 101/109) treiben min-content.
- `frontend/src/components/CompletedTasksTable.tsx:59` — Kommentar „_fixedCols={[0,1]} hält Titel- und Aktion-Spalte sichtbar" ist FALSCH: KoliBri-Spec table-stateful `_fixedCols: [number, number]` = „fixed number of columns from start and end" → [0,1] fixiert NUR die letzte. Richtig für Titel+Aktion: [1,1]. Vorbild TaskTable.tsx:172 kommentiert korrekt („fixiert die letzte Spalte").
- `frontend/e2e/completed-tasks.spec.ts:267` — kolHeaderGeometry-Filter `TH && closest('thead')` findet 0 Zellen (CI: count=0, Zeile 301). KoliBri 4.3.0 rendert Kopfzellen offenbar nicht als th-im-thead; `getByRole('columnheader')` funktioniert dagegen (AK-6 kam bis hostRight-Assertion) → Messung auf role umstellen.
- `frontend/e2e/completed-tasks.spec.ts:234/369` — die rot-laufenden hostRight-Assertionen (Beleg-Zeilen).
- `frontend/src/components/CompletedTasksTable.test.tsx:88` —_assertiert `data-fixed-cols='[0,1]'`; bei [1,1]-Fix mit anpassen (begründete Test-Korrektur).
- CI-Befund: e2e Shard 1: ✘ :177 (AK-6-neu), ✘ :281 (AK2), ✘ :343 (AK-307-5); AK-1..4 + AK-307-3 grün; Shards 2–4 grün (done-toggle/auto-remove ok); vitest lief NICHT im e2e-Job.

## Annahmen
- [0,1]→[1,1]-Fix entspricht dem UX-/Spec-Willen („fixiert Titel (erste) und Aktion (letzte)", Spec docs/spec/issue-1020.md) — Spec-Text selbst nennt noch [0,1], ist also mitzukorrigieren.
- hostRight=468 ≈ 360 (Titel) + 96 (Aktion) + Punkte-Spalte → Host wächst auf min-content statt zu clippen; Fix = CSS-Constraint (max-width:100%/min-width:0-Kette) + ggf. kleinere Header-Widths; genaue KoliBri-Scroll-Mechanik muss Fixup ausmessen (interner Scroller existiert? Ungeprüft — Assertion lief nie).

## Verworfen
- Eigene KoliBri-DOM-Rekonstruktion (node_modules nicht installiert in Sandbox) — CI-Befund count=0 reicht als Beleg; Struktur-Recherche ist Fixup-Aufgabe.
- needs-human: F3 (_fixedCols) ist per KoliBri-Doku eindeutig entschieden, keine Mensch-Entscheidung.

## Offen
- Fixup muss F1 (Host-Constraint + CSS zurück), F2 (Messtechnik role-basiert, begründete Test-Korrektur), F3 ([1,1] + Kommentar + Spec + Vitest) umsetzen und alle 3 e2e grün fahren.

## Nächster Schritt
- Fixup-Runde: Nach Push MODUS FIXUP-NACHWEIS — nur fixup-Diff seit updatedAt des Sammelkommentars prüfen, F1/F2/F3 verifizieren, dann CI (e2e Shard 1) grün abwarten.

## Fallstricke
- Sammelkommentar per PATCH fortschreiben (Comment-ID merken), NICHT neu anlegen.
- GH-Review/Kommentare mit Unicode → --body-file/--input-JSON (jq) nutzen.
- PR-Titel bereits umbenannt zu `feat(frontend): rebuild completed tasks table as KolTableStateful (#1020)` (Titel-Gate) — in Folge-Runden nicht erneut prüfen.
- Titel-Gate gilt als erledigt; KEINE Labels setzen (Workflow macht das).
