## Erledigt
- 2026-08-25 UX-Phase: Design-System-Regeln gelesen (.ai-knowledge/ux-design.md, docs/mobile-ui-rules.md), KoliBri-Spec `table-stateful` geladen, UX-Beratung in Issue-Body zwischen <!-- KI-UX:START --> und <!-- KI-UX:END --> geschrieben, VERDICT: ux-ready gesetzt.

## Relevante Stellen
- `.ai-knowledge/ux-design.md` — Design-Sprache (Farbrollen, Skalen, Komponentenwahl KoliBri zuerst, Regel 4)
- `docs/mobile-ui-rules.md` — Mobile-First (375px Basis, Touch-Targets ≥44px, keine horizontales Scrollen für Kerninhalte, aber KolTable mit internem Scroll erlaubt per Nutzer-Entscheidung)
- KoliBri-Spec `table-stateful` — Properties: _label, _data, _headers (horizontal: KoliBriTableHeaderCellWithLogic[][]), _fixedCols, _pagination
- `frontend/src/components/TaskTable.tsx:172-173` — Vorbild für KolTableStateful-Umbau

## Annahmen
- Header-Kürzung: Max. 15–20 Zeichen, title-Attribut mit Volltext (UX-Entscheidung)
- Breiten-Steuerung: CSS auf Host mit min-width für Titel-Spalte (KoliBri zeigt keine Breiten-Props explizit)
- Touch-Targets ≥44px sind durch KoliBri-Standard erfüllt
- Kontrast-Regeln (≥4.5:1 Text, ≥3:1 UI) sind durch --pp-* Tokens und KoliBri-Theme-Erbe erfüllt

## Verworfen
-

## Offen
-

## Nächster Schritt
- Spec-Phase: Rote Tests schreiben (Vitest in Dashboard.test.tsx + e2e-Umbau AK-6/AK-307-5/td[data-label]-Selektoren)

## Fallstricke
- e2e td[data-label]-Selektoren (spec.ts:274) matchen nach Umbau nichts mehr — mit ändern, sonst falsch-grün/Timeout
- AK-6-Streichung im Spec/PR begründen mit Nutzer-Kommentar 2026-08-25 12:50Z
- app.css geteilt — nur .completed-tasks*-Blöcke anfassen
