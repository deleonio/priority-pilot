# Review-Notiz — PR 1081 (Fixup-Verifikation, Runde 2 — abgeschlossen)

## Erledigt
- MODE ermittelt: `<!-- ai-review -->`-Marker vorhanden (Kommentar 5448118915, Runde 1) → Fixup-Verifikation, kein neues Kreuzverhör.
- Fixup-Commit `e768ae95` (2026-08-28 03:47 UTC, nach Review 03:42 UTC) geprüft: 2 Dateien, 1 Code-Zeile + Kommentare.
- Findung 1 als behoben verifiziert: `setup-claude/action.yml:299` hat jetzt `':(exclude).ai-memory/state.json'` im Restore-Pathspec; einzige Restore-Stelle; `git grep state.json` am PR-Head: kein Konsument mehr (`issue-state-save/action.yml:73` dokumentiert den Entfall) → nebenwirkungsfrei.
- Findung 2 als behoben verifiziert: `cache-cleanup.yml` Kopf- + Step-Kommentar jetzt „STORAGE-BRANCH-SWEEP (ADR 0007, Erbe aus 0006)" mit beiden Prefixen + Issue/PR-Status — deckt sich mit der Sweep-Logik (PR-Fallback `gh pr view`, delete nur bei closed + >7 Tage).
- Keine neuen Probleme im Fixup-Diff; kein Commit nach `e768ae95` nachgeschoben.
- Titel-Gate: `ci: harness-branch issue storage (ADR 0007) + adr-sync workflow` — konform, kein Rename.
- Sammelkommentar 5448118915 aktualisiert (Status reviewed, Behobene-Anmerkungen-Tabelle 1+2, Review-Typ: Fixup-Nachweis); VERDICT reviewed.

## Relevante Stellen
- `.github/actions/setup-claude/action.yml:299` — Restore-Pathspec mit beiden Excludes (MEMORY.md + state.json).
- `.github/workflows/cache-cleanup.yml:31-37,104-106` — aktualisierter Sweep-Kommentar; Logik unverändert aus Runde 1.
- Sammelkommentar: `issues/comments/5448118915` — einzige `<!-- ai-review -->`-Quelle.

## Annahmen
- PR-Head = `e768ae95` (letzter Commit laut `gh pr view`); Merge `e1404608` im Working Tree ist Harness-Zustand, für die Bewertung zählt der PR-Head.
- „Offene Issues werden nie angefasst" (Sweep-Kommentar) leicht unpräzise für PR-keyed Branches, aber logisch korrekt (offener PR → behalten) — bewusst kein Finding.

## Verworfen
- Neu-Kreuzverhör des Gesamtdiffs — Modus Fixup-Verifikation schreibt nur Fixup-Diff + offene Findings vor.
- MEMORY.md-Eintrag — nichts schiefgelaufen in diesem Lauf, Aufnahmekriterium (streng) nicht erfüllt.

## Offen
- -

## Nächster Schritt
- Keine — Review abgeschlossen (reviewed). Falls ein neuer Fixup-Commit auftaucht: erneut Fixup-Verifikation, Sammelkommentar 5448118915 weiterführen.

## Fallstricke
- Sammelkommentar EXAKT EINEN halten (Marker `<!-- ai-review -->`), Finding-Nummern stabil (1, 2).
- Review ohne Issue: PR-Beschreibung massgebend, Vermerk in Zeile 2 des Sammelkommentars bleibt.
- Labels NICHT selbst setzen (Workflow macht das).
