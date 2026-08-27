# Issue 1067 — Implementierungs-Notizen

## Erledigt
- Branch `feat/issue-1067-search-focus` (Spec-Branch) fortgesetzt, Commit `cc3d681c` „feat(search): Fokus nach Suche im Filterfeld des Aufgaben-Tabs (#1067)" gepusht.
- `frontend/src/App.tsx` (einzige Änderung, +27): Ref `taskFilterInputRef` auf das Filter-`KolInputText`; Helfer `focusTaskFilter()` (KoliBri-Host-`focus()` + Retry bis 20 rAF-Frames, Start hinter `setTimeout(0)`); Aufruf im `SearchModal`-`onSearch`-Handler.
- Draft PR #1069 → `gh pr ready`, Body um Implementierungs-/Gate-Abschnitt erweitert, `Closes #1067` bleibt.
- e2e `search-modal.spec.ts`: 7/7 grün (AK1–AK4 + 3 Bestandstests), KEIN Test geändert.
- Frontend Unit-Tests: 421 passed / 13 skipped.

## Relevante Stellen
- `frontend/src/App.tsx` — Filterfeld-Ref (bei `deleteFallbackRef`, ~Zeile 258), `focusTaskFilter` direkt danach, Ref-Prop am `KolInputText.task-filter-search__field` (~Zeile 547), `focusTaskFilter()` im `onSearch` (~Zeile 665).
- `frontend/src/components/Modal.tsx:136-145` — Unmount-Fokus-Rückgabe `setTimeout(0)` auf den Trigger; Quelle des Races.
- `frontend/e2e/search-modal.spec.ts:120-226` — AK1–AK4-Tests (Contract, unverändert).

## Annahmen
- `pnpm test`-Serverfehler (`server/src/express/session.test.ts`, Redis-Integrationstest) ist umgebungsbedingt — kein Redis lokal, Testausgabe nennt selbst den CI-Redis-Service; im PR-Body dokumentiert.
- Retry-Fenster von 20 rAF-Frames überdauert die Modal-Fokus-Rückgabe zuverlässig (e2e grün, aber ohne Timing-Konkurrenz-Messung).

## Verworfen
- Einmaliges `focus()` ohne Retry — verliert das Race gegen die Modal-`setTimeout(0)`-Rückgabe (Fokus landet auf dem Toolbar-Button).
- Shadow-DOM-Griff wie in `SearchModal.tsx:24-29` — KoliBri-Host-`focus()` ist die dokumentierte Variante (Kommentar `Modal.tsx:99-118`); nur für den `document.activeElement`-Check wird gepierct.
- KoliBri-Host-`focus()` OHNE eigenen Retry — der spätere Trigger-Fokus könnte das letzte Retry-Fenster überdauern; eigener Loop ist die sichere Variante.

## Offen
- Impeccable-Detector (`.claude/skills/impeccable/scripts/detect.mjs`) existiert in diesem Repo nicht → entfiel, im PR-Body begründet.

## Nächster Schritt
- Review-Phase (Phase 5, Cross-Examination gegen PR #1069).

## Fallstricke
- Fokus darf NICHT synchron im `onSearch` gesetzt werden — Modal ist dann noch offen (natives `showModal()` zieht zurück) und der Cleanup überschreibt danach. Immer Delay + Retry.
- `git commit` scheitert ohne Identity → `git config user.name/email` aus `origin/main`-Commit setzen (bot-Identität).
- `pnpm test` (Repo-Root) endet rot wegen des Redis-Tests — nicht als eigener Fehler werten, sondern gegen frontend-/e2e-Ergebnisse prüfen.
