# Issue 1118 — Review (PR 1120), Stand 2026-08-29T11:4xZ

**ERGEBNIS: VERDICT reviewed, Ampel 🟢.** Runde 1 = Kreuzverhör über den Gesamtdiff (Kommentar 5461790301, 10:25:56Z, ohne Findings). Runde 2 (dieser Lauf) = **Fixup-Nachweis**: Marker vorhanden → kein erneutes Kreuzverhör, nur Delta über die Fixup-Runde. Sammelkommentar (ID 5461790301) aktualisiert — History-Tabelle mit 2 behobenen Punkten (Signal-Kontrast am Host übermalt; AK2-Testpflege), Footer `Review-Typ: Fixup-Nachweis`.

## Erledigt
- MODE-Bestimmung: `<!-- ai-review -->`-Kommentar gefunden (ID 5461790301, `gh api repos/deleonio/priority-pilot/issues/1120/comments`) → Fixup-Verifikation. Runde 1 hatte verdict `reviewed` + 0 offene Findings; Closing-Issue #1118 mit KI-ANALYSE vorhanden (kein „Review ohne Issue").
- Delta-Scoping: PR hat 14 Commits; seit updatedAt 10:25:56Z nur `200bdaa9`/`28257985`/`83292ca2` (reine Memory-Commits) + **`312d93ca`** (11:30:28Z, einziger Code-Commit der Fixup-Runde: `frontend/src/app.css`, `frontend/e2e/issue-1118-dashboard-section-cards.spec.ts`, `.ai-memory/issue-1118-implement.md`).
- Fixup-Inhalt verifiziert: Signal-Wash/-Ink/-Border vom `kol-card`-Host in den Card-Inhalt (Light-DOM) verlagert (`app.css:527` `.dashboard-next-task-content, .dashboard-next-task-empty`), `--kol-a11y-font-color`-Override und Host-`color`/1px-Rahmen entfernt; AK2-Messkonvention im E2E korrigiert (`:94` Attribut ODER `_level`-Property, `:145` h3-Assert via `querySelectorAll` statt `page.locator`).
- CSS-Ziele gegen Produkt-Markup geprüft: beide Klassen existieren (`frontend/src/components/Dashboard.tsx:182` `-empty`, `:186` `-content`) — Fixup ändert Dashboard.tsx nicht.
- CI zum Head-Commit `312d93ca`: `verify` **success** (format/lint/build/test); e2e (1–4) pending, `gate-merge` skipped, nichts rot → 🟢 zulässig nach SKILL-Regel („kein 🟢 bei rotem CI“).
- Titel-Gate: `feat(frontend): render dashboard sections as equal-height Kolibri cards` (71 Zeichen, conventional, lowercase subject) → kein Rename.
- Keine Review-Kommentare gepostet (keine Findings), keine Labels gesetzt.

## Relevante Stellen
- `frontend/src/app.css:515-535` — neuer Signal-Block im Light-DOM + Begründungskommentar (Shadow-DOM-Overpaint).
- `frontend/e2e/issue-1118-dashboard-section-cards.spec.ts:14-21` (Messkonventionen im Header), `:90-94` (level), `:141-146` (h3-Light-DOM-Assert).
- `frontend/src/components/Dashboard.tsx:178-190` — unverändertes Produkt-Markup, Ziel der neuen CSS-Regeln.
- Sammelkommentar ID 5461790301 — in-place gepatcht (`gh api --method PATCH repos/.../issues/comments/5461790301 -f body=@/tmp/ai-review-1120.md`).

## Annahmen
- Rot-became-green der beiden Kontrast-Specs basiert auf der lokalen Gate-Angabe im Commit („Playwright-Volllauf 493 grün / 4 übersprungen“) — eigener Playwright-Lauf nicht wiederholt (chromium-Install-Kosten; CI-e2e-Matrix deckt es ab).
- `review`-Check auf dem Head-Commit „pending“ ist dieser Lauf selbst.

## Verworfen
- Erneutes Kreuzverhör über den Gesamtdiff — Marker vorhanden, Fixup-Nachweis-Modus per Prompt/SKILL step 5 (Diff-Scoping).
- MEMORY.md-Eintrag („kol-card malt Host-Hintergrund über“) — repo-seitig bereits dokumentiert (`app.css:515`-Kommentar, Spec-Header, Commit-Message); Aufnahmekriterium „nicht im Repo erfasst“ nicht erfüllt.
- Inline-Finding zum Wegfall des 1px-Vollrahmens — Kosmetik ohne AK-Bezug, Wash + Signal-Border links liefern die visuelle Begrenzung; Pseudo-Finding.

## Offen
- e2e-Matrix (4 Shards) läuft noch beim Verlassen des Laufs; falls sie rot endet, greift der Merge-Gate/die nächste Review-Runde. Kein weiterer offener Punkt.

## Nächster Schritt
- Keine weitere Review-Aktion; Merge entscheidet der Gate (verify grün + e2e).

## Fallstricke
- Fixup ohne `ai-fixup`-Kommentar und ohne Fixup-Memory-Notiz im Worktree: Die Fixup-Begründung steht im Commit-Message-Body + `issue-1118-implement.md` (Abschnitt „Fixup 2026-08-29“) — dort suchen, nicht nach einem ai-fixup-Sammelkommentar.
- Worktree-Checkout kann älter als der PR-Head sein: `git show <sha>:<path>` statt Working-Tree-Lesen, wenn Zeilennummern für Kommentare gebraucht werden.
- „Runde 1 reviewed, trotzdem Fixup“ ist kein Widerspruch: Auslöser war das CI-Qualitäts-Gate (roter e2e-Kontrast), nicht ein Review-Finding.
