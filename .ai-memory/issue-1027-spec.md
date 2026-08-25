# Issue 1027 — Spec-Phase (2026-08-25, ERLEDIGT)

## Erledigt
- Spec `docs/spec/issue-1027.md` neu angelegt (Ziel/Vorbedingung/Schritte/Erwartetes
  Ergebnis + Test-Abdeckung, Format nach issue-1020.md).
- Rote Tests `frontend/e2e/issue-1027-forest-card-spacing.spec.ts` (2 Tests):
  AK1 Lücke ≥ 24 px (ROT, Ist-Messung **4 px**), AK2 375 px kein Clipping (grün, Regressions-
  schutz). Playwright-Lauf verifiziert, lint clean.
- Commit `8ffa99f7` (Spec+Tests gemeinsam) auf `feat/issue-1027-wald-card-abstand`,
  gepusht. Draft-PR **#1029** erstellt, Verknüpfung `closes 1027` verifiziert.
- VERDICT: ready ausgegeben.

## Relevante Stellen
- `frontend/src/app.css:793` — `.forest-node-card { margin-bottom: var(--pp-gap-tight) }`: die Regel, die Phase 4 anhebt.
- `frontend/e2e/issue-1027-forest-card-spacing.spec.ts:83` — die rote Kern-Assertion (`gap >= 24`).
- `frontend/e2e/issue-704-tree-layout.spec.ts:280-291` — AK3b misst Oberkanten-|Δy| ≥ 20 px (andere Metrik als AK1-Lücke → kein Duplikat, bleibt stehen).

## Annahmen
- Gemessene Ist-Lücke zwischen den KolCard-Host-Bounding-Boxen ist nur 4 px (nicht die
  vom Issue genannten ~12 px — die ergeben sich inkl. li-Margin/Padding optisch). Für den
  Vertrag irrelevant: gemessen wird die Host-BBox-Lücke, Soll ≥ 24 px.
- AK2 darf im Ist-Zustand grün sein (Regressionsschutz); die Rot-Signatur trägt AK1 allein.

## Verworfen
- Eigener AK3-Regressionstest (Einrückung): dedup — bestehende #704-Tests decken es ab.
- scrollWidth-Messung für AK2: falsch-grün wegen `overflow-x: hidden` (Learning 2026-08-24) → boundingBox.

## Offen
- -

## Nächster Schritt
- Phase 4 (Impl): `.forest-node-card` auf Token der 4er-Skala heben, bis AK1 grün wird; #704-Tests müssen unverändert grün bleiben.

## Fallstricke
- `.forest-node-children` (Einrückung) und `--pp-gap-tight` global NICHT anfassen.
- PR #1029 ist Draft mit rotem verify-Job — Normalzustand der Spec-Phase, nicht fixen.
- Zielwert ist Geometrie (≥ 24 px Host-Lücke), nicht ein bestimmtes Token.
