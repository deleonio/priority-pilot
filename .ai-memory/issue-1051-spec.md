## Erledigt
- Spec `docs/spec/issue-1051.md` erstellt (AK1/AK2/AK3)
- Rote E2E-Tests `frontend/e2e/issue-1051-header-toolbar-mic-align.spec.ts` geschrieben (3 Tests: AK1, AK2, AK3)
- Commit `278a0556` gepusht, Draft-PR #1054 erstellt mit `Closes #1051`

## Relevante Stellen
- `frontend/e2e/issue-1051-header-toolbar-mic-align.spec.ts` — 3 rote Tests
- `docs/spec/issue-1051.md` — Spezifikation
- `frontend/src/App.tsx:402` — `_variant: 'primary'` (zu aendern auf 'secondary')
- `frontend/src/app.css:1279-1283` — Mic-Button Positionierung (zu korrigieren)

## Annahmen
- `getComputedStyle(el).backgroundColor` auf dem Host-Element unterscheidet primary/secondary (Shadow-DOM rendert die Variante visuell auf dem Host)
- `.voice-field--input > .mic-button` ist der korrekte Selektor fuer den Mic-Button im Such-Dialog
- `page.getByRole('searchbox')` findet das Input im KoliBri-Shadow-DOM

## Verworfen
- Dedup-Check: `header-toolbar.spec.ts` deckt keine Varianten-Konsistenz ab (nur Semantik, Icon-only, Reihenfolge) → kein Duplikat
- `search-modal.spec.ts` hat keinen Mic-Button-Alignment-Test → kein Duplikat

## Offen
- -

## Nächster Schritt
- Impl-Phase: App.tsx:402 variant aendern + app.css Mic-Button CSS korrigieren

## Fallstricke
- Toolbar-Buttons im KoliBri-Shadow-DOM: `getComputedStyle` auf dem Host prueft die Variante
- Auf 375px koennen Toolbar-Buttons im Overflow-Menue liegen; Test klickt direkt auf den Button-Rollen-Namen
- CSS-Korrektur fuer Mic-Button wirkt global auf alle `variant="input"` VoiceFields (TaskForm, QuickCapture, PillarAdvisor)