# Issue 1027 — Triage-Notizen (2026-08-25, ERLEDIGT)

## Erledigt
- Erst-Triage komplett: Body lektoriert + KI-ANALYSE-Block (stand=2026-08-25T15:10:25Z) via
  `gh issue edit 1027 --body-file` geschrieben; Titel präzisiert („Vertikaler Abstand … erhöhen");
  1 Ping-Kommentar gepostet; VERDICT: spec-ready ausgegeben. Keine Zerlegung nötig.
- Body-Entwurf liegt noch unter `.ai-memory/issue-1027-body.md` (kann gelöscht werden).

## Relevante Stellen
- `frontend/src/app.css:793` — `.forest-node-card { margin-bottom: var(--pp-gap-tight) }`: DER Drehknopf.
- `frontend/src/app.css:784` — `.forest-panel li { margin: 0.25rem 0 }`: zweiter Abstands-Anteil (~12px gesamt).
- `frontend/src/components/ForestPanel.tsx:44` — KolCard mit Klasse `forest-node-card`, Testid `forest-node-<id>`.
- `frontend/src/App.tsx:607` — Wald-Tab rendert ForestPanel (VIEW_TABS App.tsx:51).
- `frontend/src/app.css:118-119` — Spacing-Tokens (Vorschlag: `--pp-gap-base` = 1rem).
- `frontend/e2e/issue-704-tree-layout.spec.ts:280-286` — boundingBox-Muster für Abstands-AK; existierende
  Assertion „≥ 20px vertikal" bleibt bei mehr Abstand grün.

## Annahmen
- Screenshot zeigt Wald-Tab (via Bild-Analyse bestätigt: Cards „#id – Titel", P-Badge, Wert/Gesamtaufwand).
- Zielabstand 1 rem (`--pp-gap-base`) als Vorschlag; „etwas" nicht quantifiziert → als offene, nicht
  blockierende Frage im Block vermerkt.

## Verworfen
- Zerlegung in Sub-Issues: nur eine Schicht (CSS + e2e), ein PR — Kriterium nicht erfüllt.
- TaskTree.tsx (`task-list`) als Ziel: falscher Tab — „Aufgaben"-Liste, keine Cards.

## Offen
- -

## Nächster Schritt
- Phase UX/Spec (Workflow übernimmt Label-Routing via VERDICT).

## Fallstricke
- `.forest-node-children` (Verschachtelung, 24px-Einrückung) nicht anfassen — nur Top-Level-Rhythmik erhöhen.
- Kein `--pp-gap-tight`-Token global ändern (wird überall genutzt) — nur die Card-Regel.
- Body-Block bei Re-Triage in-place ersetzen (Stand 2026-08-25T15:10:25Z).
