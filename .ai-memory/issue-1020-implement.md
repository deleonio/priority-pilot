## Erledigt
- 2026-08-25 Umsetzungs-Phase (5/6) KOMPLETT: Branch `feat/issue-1020-koltable-erledigt`, Commit `b313ac37` gepusht, Draft-PR #1024 → `gh pr ready` gesetzt, PR-Body um „Umsetzung (Phase 4)"-Abschnitt ergänzt. VERDICT: needs-review gesetzt.
- `frontend/src/components/CompletedTasksTable.tsx` komplett neu: `KolTableStateful` (_label="Liste der erledigten Aufgaben", _fixedCols={[0,1]}), Header „Titel"(width 360) · je Säule `shortPillarHeader` (max 20 Z, '…') · „Aktion"(width 96, render→renderIntoCell→KolToolbar „Wieder öffnen", #307 unverändert). Datenzeilen: `pillar-<id>`-Schlüssel, `_task`-Ref für Callback. forestTaskIds-Filter, reopen/Error/Empty-State unverändert übernommen. Obsoleter nativ-Tabellen-Kommentar (alt Z. 26-34) ersetzt durch KolTable-Begründung.
- `frontend/src/app.css`: Zeilen 1538-1647 gelöscht (ganzer `.completed-tasks-table`-Block inkl. <48rem-Karten-Media-Query, #931-fixed-layout). `.completed-tasks`/`-empty`/`-error` bleiben. Kein neues CSS nötig (Breiten über Header-`width`-Props).
- Checks: `tsc --noEmit` ✓, ESLint (2 Dateien) ✓, knip Exit 0 (4 „Configuration hints" zu TaskTable/reactCellRoot/push-sw/main.tsx = informativ, pre-existing-Stil), Prettier ✓ (formattierteKomponente minimal um), Pre-Commit-Hook (lint 17s) lief grün.

## Relevante Stellen
- `frontend/src/components/CompletedTasksTable.tsx:36-37` — shortPillarHeader: `slice(0,19)+'…'` erfüllt Vitest (≤20 Z, ≠Volltext, 'Karriere' unverändert).
- `frontend/src/components/CompletedTasksTable.test.tsx` — Mock-Vertrag: data-testid completed-kol-table, data-table-label, data-fixed-cols='[0,1]';NICHT anfassen.
- `frontend/e2e/completed-tasks.spec.ts:177/281/343` — AK3/AK4 (interner Scroller via Shadow-Rekursion, hostRight≤376), AK2 (kolHeaderGeometry: Titel>alle Punkte-Spalten, maxHeightRatio<2), AK-307-5. Liefen hier NICHT lokal (Regel: Tests nur CI) — Grünfahren muss CI zeigen.
- `frontend/src/components/TaskTable.tsx:91-173` — Vorbild für headers/render/width-Muster.

## Annahmen
- Header-`width` (px) wirkt wie in TaskTable (`width: 210` für Aktionen) — Punkte-Spalten OHNE width bleiben auto → Kopfzeile einzeilig (AK2 maxHeightRatio<2) und Titel (360) dominiert bei 1280px.
- Bei 375px ergibt 360+~180+96 > 375 den internen Scroller (AK3) — KoliBri schaltet selbst um (Nutzer-Entscheidung).
- knip-Hints brechen CI nicht (Exit 0).

## Verworfen
- Playwright-MCP-Screenshot-Check (375px/1280px): kein Browser-MCP in dieser Umgebung angeschlossen → visuelle Verifikation delegiert an e2e-Geometrie-Tests; im PR-Body dokumentiert.
- Zusätzliche CSS-Regeln (min-width Host): Header-width-Props reichen, kein CSS nötig.

## Offen
- -

## Nächster Schritt
- Review-Phase (CI muss Vitest 2 + e2e AK-6-neu/AK2/AK-307-x grün zeigen; falls AK2-Geometrie in CI kippt: width 360/96 in CompletedTasksTable.tsx:101/109 justieren).

## Fallstricke
- app.css nach Löschung hat Doppelleerzeile 1536-1538 — Prettier hat's nicht entfernt, harmlos (CSS-Formatierung), bei Gelegenheit mitnehmen.
- Tests wurden absichtlich lokal NICHT ausgeführt (Workflow-Regel) — Grünfahren ist CI-aufgegeben, nicht verifiziert.
- MEMORY.md-Dauereintrag bewusst KEINER gemacht (kein ticket-übergreifendes, nicht-offensichtliches Learning; Playwright-MCP-Fehlen ist umgebungsbedingt).
