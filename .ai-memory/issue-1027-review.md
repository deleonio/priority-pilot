# Issue #1027 — Review-Phase (2026-08-25, LAUFEND)

## Erledigt
- MODUS bestimmt: KEIN ai-review-Marker vorhanden → MODUS = KREUZVERHÖR (Erst-Review, ganzer PR adversarial prüfen).
- Vollständigen Diff geladen (Spec + rote Tests + CSS-Änderungen).
- PR-Titel geprüft: „Spec #1027: Vertikaler Abstand der Wald-Cards (rote Tests) (#1027)" — CONVENTIONAL COMMIT COMPLIANT.
- Adversariale Prüfung komplett: Problem gelöst, Edge Cases bedacht, Einfachheit geprüft, Regression ausgeschlossen, KoliBri-First eingehalten, Code-Qualität hoch.
- TITEL-GATE bestanden: Keine Umbenennung nötig.

## Relevante Stellen
- `docs/spec/issue-1027.md` — neue Spec, sehr detailliert (Ziel/Vorbedingung/Schritte/AKs/Test-Abdeckung).
- `frontend/e2e/issue-1027-forest-card-spacing.spec.ts` — 2 e2e-Tests: AK1 (Lücke ≥ 24px, rot → grün), AK2 (375px kein Clipping, grün, Regressionsschutz).
- `frontend/src/app.css:788-790` — `.forest-panel li { margin: var(--pp-space-6) 0 }`: von 0.25rem (4px) auf 24px erhöht.
- `frontend/src/app.css:792-795` — `.forest-panel .forest-node-card { margin-bottom: var(--pp-space-8) }`: von var(--pp-gap-tight) (8px) auf 32px erhöht.
- `frontend/src/app.css:118-119` — Spacing-Tokens (`--pp-space-6` = 1.5rem = 24px, `--pp-space-8` = 2rem = 32px).
- `.ai-memory/issue-1027-spec.md` — Notizen zur Spec-Phase (rote Tests Signatur, Bounding-Box-Messung, scrollWidth-Falle).
- `.ai-memory/issue-1027-implement.md` — Notizen zur Implementierungs-Phase (CSS-Regeln, GATE durchlaufen, AK3 protected).

## Annahmen
- Die resultierende Lücke von 56px (24px li-Margin + 32px card-margin-bottom) ist beabsichtigt und entspricht dem Design-System („Generous Separation" laut ux-design.md).
- Die erhöhte CSS-Spezifität (`.forest-panel .forest-node-card`) ist nötig, um die li-Margin zu überschreiben — Alternativen wären umständlicher.
- Der PR-Titel entspricht bereits dem Conventional Commits-Format (type: subject) — weitere Prüfung entfällt.

## Verworfen
- 32px card-margin-bottom als „zu viel" — liegt auf der 4er-Skala und folgt Design-System-Prinzipien.
- CSS-Spezifität als unnötig komplex — nötig für Überschreibung, einfacher als Alternative.
- Potential für false positives bei verschachtelten Aufgaben — `.forest-node-children` unangetastet, Einrückung durch #704-Tests geschützt.

## Offen
- -

## Nächster Schritt
- Sammelkommentar mit <!-- ai-review --> posten (Status-Zeile, Behobene Anmerkungen, Entscheidungs-Findings, Offene Findings, Footer).
- VERDICT: reviewed ausgeben (DATEI: /tmp/claude-verdict, AUSGABE: letzte Zeile).

## Fallstricke
- KEINE Labels setzen — Workflow übernimmt das automatisch.
- KEINE Pseudo-Findings bei 🟢 — knappe Bestätigung im Sammelkommentar genügt.
- Verdict-Begriff als EINZIGES Wort in /tmp/claude-verdict schreiben (Bash: printf 'reviewed' > /tmp/claude-verdict).
- Letzte Output-Zeile exakt „VERDICT: reviewed“ — kein Text dahinter.
