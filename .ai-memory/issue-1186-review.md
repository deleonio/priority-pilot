# Issue 1186 — Review (Kreuzverhör, Runde 1), Stand 2026-09-03

**ERGEBNIS: VERDICT reviewed, Ampel 🟢.** PR #1189 (Branch `ai/harness/1186`). Marker `<!-- ai-review -->` fehlte → Modus Kreuzverhör (Erstreview). Titel via Title-Gate auf `feat(frontend): fix clipped focus outline in task popover (#1186)` umbenannt (war Issue-Titel verbatim, deutsch, ohne Conventional-Commits-Format).

## Erledigt
- Modus-Bestimmung: kein existierender ai-review-Kommentar (API-Suche leer) → Kreuzverhör.
- Kompletten PR-Diff gelesen: Fix (`popoverAlign.ts`), E2E-Spec, `docs/spec/issue-1186.md`, 3 Phasen-Notizen (adr-0007-Muster).
- AK1–AK3 aus Harness-Kommentar des Issues geladen und gegen Diff + PR-Body abgeglichen: alle 3 Kriterien durch je einen E2E-Test abgedeckt.
- Commit-Reihenfolge verifiziert: `test: red spec tests for #1186` (23:47) VOR `fix(frontend)` (00:11) → testgetriebene Reihenfolge erkennbar.
- Sammelkommentar (Marker Zeile 1) als neuer PR-Kommentar erstellt — Review-Status reviewed, Review-Typ: Kreuzverhör.

## Relevante Stellen
- `frontend/src/lib/popoverAlign.ts:33-36` — der Fix: bewachtes `panel.style.overflow = 'visible'` (gleiches Guard-Muster wie `width`), nur 4 Zeilen inkl. `#1186`-Kommentar.
- `frontend/e2e/issue-1186-popover-focus-outline.spec.ts:284-316` — `clippingAncestorInPopover`: Ancestor-Walk (endet am kol-popover-button-Host, durchquert verschachtelte Shadow Roots) + separates Panel-Overflow-Check via Promise.all; substanziell, nicht tautologisch (Rot-Stand mit exakten Fehlermeldungen im PR-Body belegt).
- `gh pr checks 1189` — e2e/verify zum Review-Zeitpunkt pending (nicht rot); Content-Verdict 🟢, CI-Gate degradiert deterministisch, falls doch rot.

## Annahmen
- Lokale Gate-Ergebnisse im PR-Body (3/3 E2E grün, lint/test/knip exit 0) sind korrekt; CI-pending gilt nicht als rot (SKILL-Regel: kein 🟢 bei rotem CI — pending ausgenommen).
- Additiver Inline-Style gefährdet Alt-Popover-E2Es (crud/keyboard-shortcuts/dependency-editor) nicht — nur computed overflow am Panel geändert, kein Layout-Eingriff; Alt-Specs wurden nicht neu laufen gelassen (Impl-Notiz: „nur bei Bedarf"), Risiko als gering bewertet.
- Stale Versionsangabe „v4.2.1" im Doc-Kommentar (popoverAlign.ts, Kontextzeile, Pins sind 4.3.0) = vorbestehend, außerhalb Diff-Scope → kein Finding.

## Verworfen
- Finding „overflow: visible kann Panel-Scrollfähigkeit entfernen" — Panel hat bereits erzwungenes `width: max-content` + Links-/Viewport-Korrektur; AK3-Test @375px grün; theoretischer Extremfall (< Panelbreite) nicht beobachtbar und vom Issue-Pfad bewusst akzeptiert.
- Finding zu in PR committeten `.ai-memory/`-Phasen-Notizen — etabliertes Muster (ADR 0007, Präzedenz-PRs).
- MEMORY.md-Eintrag — kein neuer Fehler, Kriterium nicht erfüllt.

## Offen
- -

## Nächster Schritt
- Workflow: CI-Gate (e2e/verify grün → `ai:ready-to-merge`, sonst `ai:needs-changes`). Bei Fixup-Runde: Modus Fixup-Nachweis (Sammelkommentar jetzt vorhanden), Delta-Review ab `updatedAt`.

## Fallstricke
- Sammelkommentar-ID beim Update per `<!-- ai-review -->`-Markersuche finden (nicht `--edit-last`).
- Finding-Nummerierung entfällt (Runde 1 hatte keine Findings) — falls später doch welche entstehen, bei F1 beginnen.
