# Issue 1009 — Review-Phase (PR #1011) — ABGESCHLOSSEN

## Erledigt
- Modus bestimmt: kein `<!-- ai-review -->`-Kommentar vorhanden → Kreuzverhör-Erstreview.
- Kompletter Diff geprüft (nur `.github/actions/issue-state-save/action.yml`, 60 Diff-Zeilen) + Issue-1009-AKs aus KI-ANALYSE-Block. Ergebnis: 🟢 reviewed, keine Findings.
- AK1 verifiziert: `action.yml:57` (`base="$(git show FETCH_HEAD:…)"`), Merge `:70–72` auf `$base`.
- AK2 verifiziert: Erst-Phase-Pfad (orphan `:60–63`, Workspace-Fallback/Neuanlage `:73–78`) unverändert.
- AK3 verifiziert: Retry/Re-Parenting `:114–122` unberührt; Staging-Loop `:90–95` staged die frisch gemergte Workspace-Datei → Reihenfolge Merge→Stage korrekt.
- PR-Titel war deutsch → auf `fix(ci): use FETCH_HEAD as base for state.json merge` umbenannt (gh pr edit).
- Sammelkommentar `<!-- ai-review -->` mit Status reviewed gepostet (einziges Vorkommen, für Fixup-Nachweis-Runden auffindbar).
- Verdict `reviewed` nach /tmp/claude-verdict geschrieben.

## Relevante Stellen
- `.github/actions/issue-state-save/action.yml:55-78` — der komplette geänderte Block (Fetch → $base-Capture → read-tree → Merge auf Branch-Basis).
- `.github/actions/issue-state-save/action.yml:114-122` — Push-Retry/Re-Parenting, von AK3 gefordert unverändert.

## Annahmen
- state.json auf dem Branch ist immer ein JSON-Objekt (nur diese Action schreibt sie) → Nicht-Objekt-Basen (`[]`, Skalare) können organisch nicht auftreten; der jq-Fehlerpfad dafür ist identisch zum Altcode.
- Keine automatisierten Tests nötig (Carve-out ADR-0001); ökonomischer Nachweis bleibt CI-Beobachtung eines realen fixup→review-Durchlaufs, wie im PR-Body beschrieben.

## Verworfen
- Finding gegen den non-FF-Retry (Konkurrenz-Save im Fetch→Push-Fenster wird vom Re-Parenting überschlagen): bewusst KEIN Finding — vorbestehendes Verhalten, von AK3 explizit ausgenommen, durch den PR nicht verschlechtert (Fenster schrumpft von „seit Job-Restore" auf Sekunden). Als nicht-blockierende Beobachtung im Sammelkommentar dokumentiert.
- Finding „jq schlägt fehl → mv übersprungen → stale Datei gestaged": identischer Fehlerpfad wie im Altcode, organisch nicht erreichbar → verworfen.

## Offen
- - (nichts Blockierendes)

## Nächster Schritt
- Keiner — Review abgeschlossen (reviewed). Falls ein Fixup kommt: Fixup-Nachweis-Modus, bestehenden `<!-- ai-review -->`-Kommentar fortschreiben.

## Fallstricke
- Modus-Bestimmung via `gh api repos/{owner}/{repo}/issues/1011/comments` + Filter auf `ai-review` — Issue-Comments-API, nicht Pulls-Reviews (der Sammelkommentar ist ein Issue-Kommentar).
- Titel-Gate prüft auch Sprache: deutsches Subject = nicht konform, obwohl type/scope stimmten.
