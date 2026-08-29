# Issue 1121 — Implement (Phase 4), Stand 2026-08-29

## Erledigt
- Spec-Modus: Draft-PR **#1123** (Branch `ai/harness/1121`, schließt #1121 via `Closes #1121`) ausgecheckt; lokale untracked Phasen-Notizen waren byte-identisch mit den getrackten Versionen auf dem Branch (`diff -q`) → verworfen, keine Konflikte.
- Analyse + AK1-AK7 aus Harness-Marker-Kommentar übernommen; Ampel 🟢; **kein KI-UX-Block im Marker** (grep "KI-UX" = 0 Treffer) — UX-Anforderungen kamen aus den Randbedingungen des Analyse-Blocks (U+00A0 als Escape, GeoBadge.tsx unverändert, Titel-Flex aufbrechen).
- **TaskTree.tsx:87-96** — GeoBadge-Rendering aus `.task-tree-badges` (alte Z.115-117, jetzt entfernt) in `.task-tree-row-header` hinter den KolHeading verlagert; Fragment mit Kommentar + `{'\u00a0'}` + `<GeoBadge …/>`.
- **app.css:975-987** — `.task-tree-title` `flex: 1 1 auto` → `flex: 0 1 auto` (+ Kommentar #1121); neu `.task-tree-row-header .geo-badge { flex: none; }` (Chip darf nicht beschnitten werden, Titel trägt den Umbruch).
- `GeoBadge.tsx` NICHT angefasst (AK6-Vertrag); Badges Serie/geändert/Fortschritt/Priorität unverändert (AK4).

## Relevante Stellen
- `frontend/src/components/TaskTree.tsx:88-95` — neuer Header-Block (KolHeading + Fragment mit U+00A0 + GeoBadge).
- `frontend/src/components/TaskTree.tsx:108` — `.task-tree-badges` ohne GeoBadge (nur noch 4 Status-Badges).
- `frontend/src/app.css:975-987` — Titel-Flex + Geo-Badge-Flex-Regel.
- `frontend/e2e/issue-1121-geo-badge-title.spec.ts` — Vertrag (5 Tests, AK1-AK5), NICHT geändert.
- `frontend/e2e/issue-1063-geo-badge.spec.ts` + `issue-1066-nearby-card.spec.ts` — Regression, müssen grün bleiben.

## Annahmen
- `.task-tree-row-header` ist `display:flex` ohne `flex-wrap` (app.css:947-953) → Titel+Icon brechen nie getrennt um; AK2-„Umbrucheinheit" über Badge-Box ≤ Heading-Box bei 375px erfüllt.
- Titel verliert `flex-grow`: `.task-tree-row-header` selbst hat weiterhin `flex: 1 1 auto` in `.task-tree-row`, Controls bleiben rechtsbündig — kein Layoutverlust.

## Verworfen
- Wrapper-Span um Titel+Icon (à la `done-title-cell`) — unnötig, da Header nowrap ist und KolHeading-Host sonst doppelt verschachtelt würde; minimaler Diff.
- Tests anfassen — verboten (Trennung Spec/Impl).

## Offen
- —

## Nächster Schritt
- Review-Phase (`ai:needs-review`): Kreuzverhör von PR #1123.

## Fallstricke
- Edit-Tool ersetzt `{'\u00a0'}`-Absichten durch ein ROHES NBSP (C2 A0 im Quelltext) — nach dem Edit zwingend mit `grep -c $'\xc2\xa0'` gegenprüfen und per Python-Replace auf das Escape `{'\u00a0'}` umschreiben.
- **GATE GRÜN (2026-08-29, via gate-runner):** format ✓, prettier ✓, lint ✓, knip ✓, `pnpm test` = server 765 passed (1 skipped) + frontend 483 passed (13 skipped), e2e `issue-1121-geo-badge-title.spec.ts` + `issue-1063-geo-badge.spec.ts` + `issue-1066-nearby-card.spec.ts` = 14 passed. `pnpm format` hat TaskTree.tsx/app.css berührt (nur Whitespace/Zeilenumschlag) — End-Diff oben gültig, kein rohes NBSP im Quelltext (`grep -c $'\xc2\xa0'` = 0).
- Playwright-MCP-Layoutcheck (375/1280) entfällt: MCP-Server in diesem Lauf nicht verfügbar; 375px-Geometrie ist durch e2e AK2/AK7 (Bounding-Box-Assertions) abgedeckt — im PR-Body dokumentieren.
- `.ai-memory/issue-1121-{spec,triage}.md` liegen auf dem Branch TRACKED — lokales Auschecken scheitert an untracked Kopien; vorher verschieben und auf Byte-Identität prüfen statt zu löschen.
