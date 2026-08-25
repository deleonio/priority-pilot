# Issue 1027 — Implementierungs-Phase (2026-08-25, ERLEDIGT)

## Erledigt
- CSS-Regeln angehoben: `.forest-panel li { margin: var(--pp-space-6) 0 }` (24px) und `.forest-panel .forest-node-card { margin-bottom: var(--pp-space-8) }` (32px) → Lücke ≥ 24px erreicht.
- GATE komplett durchlaufen: format ✅, prettier ✅, lint ✅, knip ✅, e2e ✅.
- Commit `0de1f541` gepusht, PR #1029 review-bereit gemacht (`gh pr ready`).
- AK1 (Lücke ≥24px): grün (4px → ≥24px).
- AK2 (375px kein Clipping): grün (Regressionsschutz).
- AK3 (Einrückung): alle #704-Tests grün (8 passed).

## Relevante Stellen
- `frontend/src/app.css:788-790` — `.forest-panel li { margin: var(--pp-space-6) 0 }`: angehoben von 0.25rem (4px) auf 24px.
- `frontend/src/app.css:792-795` — `.forest-panel .forest-node-card { margin-bottom: var(--pp-space-8) }`: angehoben von var(--pp-gap-tight) (8px) auf 32px.
- `frontend/e2e/issue-1027-forest-card-spacing.spec.ts:83` — AK1-Assertion (`gap >= 24`): jetzt grün.
- `frontend/e2e/issue-704-tree-layout.spec.ts` — alle 8 Tests grün (AK3 protected).

## Annahmen
- Li-Margin (4px) plus Card-Margin-bottom (8px) ergaben optisch ~12px, aber Bounding-Box-Lücke war nur 4px (because li-Margin ist outside der Card-BBox).
- Lösung: Beide Margen hochziehen → Li-Margin 24px + Card-Margin 32px = BBox-Lücke ≥24px.
- Spezifität `.forest-panel .forest-node-card` nötig, um li-Margin nicht zu überschreiben.

## Verworfen
- Nur `.forest-node-card` margin-bottom ändern: reicht nicht (li-Margin dominate die BBox-Lücke).
- Nur li-Margin ändern: nicht genug, Card-Margin muss auch hoch für konsistente Rhythmik.

## Offen
- -

## Nächster Schritt
- Workflow setzt Label `ai:needs-review` automatisch (bei VERDICT: needs-review).

## Fallstricke
- `.forest-node-children` (Einrückung) NICHT angefasst — bleibt bei 24px pro Ebene.
- Server-Tests (Redis-Integration) rot — erwartet, läuft in CI mit Redis-Service.
- Konsolen-Errors (duplicate React keys) sind Altlasten, nicht durch dieses PR verursacht.

