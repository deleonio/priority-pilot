# Issue 1219 — Review (Phase 5, Fixup-Nachweis Runde 2), Stand 2026-09-05T09:0xZ

**ERGEBNIS: VERDICT reviewed (🟢).** Modus markerbasiert (`<!-- ai-review -->` = issuecomment-5550353239, Stand Runde 1 needs-fixup) → Fixup-Nachweis, kein neues Kreuzverhör. Sammelkommentar per PATCH auf dieselbe ID aktualisiert (Statuszeile reviewed, alle 4 Claim-Zeilen der `<!-- ai-fixup-decisions -->`-Tabelle als Behoben verifiziert, Footer „Review-Typ: Fixup-Nachweis"). Titel-Gate: `feat(frontend,server): editable display name in settings (#1219)` erfüllt Conventional Commits — keine Umbenennung.

## Erledigt
- Claim-Checkliste der ai-fixup-decisions (issuecomment-5550430667) Zeile für Zeile gegen die Fixup-Diffs verifiziert:
  - **Finding 1** (`git show c76e4272`): KolInputText + KolButton jetzt in `.settings-profile`-Wrapper (SettingsPage.tsx), `.settings-profile { display:flex; flex-direction:column; gap: var(--pp-gap-base) }` in app.css; `--pp-gap-base` = `--pp-space-4` (1rem/16px, app.css:119). #843-Control-Liste `issue-843.spec.ts:33` misst `.settings-general > kol-button` → Button raus aus der Liste. Locatoren #843/#1017 unangetastet.
  - **Finding 2**: `profile-display-name.spec.ts:44` jetzt `toHaveAttribute('_label', uniqueName)` auf `.app-header__user kol-avatar` inkl. Begründungskommentar; in Runde 1 freigegebene Spek-Korrektur (keine Duties-Verletzung).
  - **Nit**: SettingsPage.test.tsx-Kommentar auf PROFILE_CHANGED_EVENT korrigiert (bestätigt).
  - **CI**: `git show 360e5540` — issue-969.spec.ts AK4 boundingBox-Abfrage jetzt `expect.poll(... !== null).toBeTruthy()`, ±1px-Assertion unverändert (kein Aufweichen).
- CI auf Head 1528d30c geprüft: verify PASS, e2e (1)–(4) alle PASS (inkl. ehemals rotem Shard 3); „review" pending = dieser Lauf selbst.
- Delta seit Review-updateAt 07:41 nur: c76e4272, 360e5540, 3 memory-Commits, Merge 1528d30c. Merge bringt #1231 von main (SessionExpiredDialog, silent-login) — fremder, bereits reviewedinhalt aus main, kein Konflikt-Schaden (CI grün beweist es).
- Keine neuen Findings, keine Inline-Kommentare nötig.

## Relevante Stellen
- `frontend/src/components/SettingsPage.tsx` (~:313) — `.settings-profile`-Wrapper um Anzeigename-Feld + Speichern-Button.
- `frontend/src/app.css` (~:1734) — `.settings-profile`-Regel; `:119` `--pp-gap-base`.
- `frontend/e2e/profile-display-name.spec.ts:44` — Avatar-`_label`-Assertion (AK7).
- `frontend/e2e/issue-969.spec.ts:~112` — pollende boundingBox-Abfrage.
- Sammelkommentar issuecomment-5550353239, Fixup-Decisions issuecomment-5550430667.

## Annahmen
- Merge-Inhalt #1231 aus main ist außerhalb des Fixup-Deltas (eigener PR, eigener Review) — nur Konfliktfreiheit via CI beurteilt, nicht inhaltlich.
- „CI grün auf 1528d30c" aus `gh pr checks` (e2e/verify vom Head-Lauf 33957418037).

## Verworfen
- Erneutes Voll-Kreuzverhör des PR-Diffs — SKILL Schritt 5 Diff-Scoping: nur Fixup-Delta + Claims; Runde-1-Fundings 1+2 dadurch abgedeckt.
- MEMORY.md-Eintrag — kein neuer Fehler/Experience-Kriterium erfüllt.

## Offen
- Wegwerf-Artefakte NICHT committen: `issue-1219-review-collected.md` (dieser Lauf; Patch-Body der gesendeten Fassung) + ältere `issue-1219-review-{body,c1,c2}.md` falls noch vorhanden. Nur diese Datei ist die Phasen-Notiz.

## Nächster Schritt
- Workflow übernimmt (Label-Pflege automatisch, kein Label-Handgriff): bei grünem CI → ready-to-merge/merge durch die Pipeline; sonst Mensch.

## Fallstricke
- Phase ist abgeschlossen (reviewed) — ein Folge-Lauf mit vorhandenem Marker ist wieder Fixup-Nachweis; bei erneutem needs-fixup-Zyklus Finding-Nummern 1/2 NICHT neu vergeben (stabil).
- KEINE Labels setzen — Workflow macht das selbst.
