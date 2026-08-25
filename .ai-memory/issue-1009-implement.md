# Issue 1009 — Implement-Phase (Direkt-Modus) — ABGESCHLOSSEN

## Erledigt
- Analyse verifiziert: kein offener PR für 1009, Ampel 🟢, „Spec nötig: nein" → Direkt-Modus.
- `.github/actions/issue-state-save/action.yml` umgebaut: state.json-Merge NACH den Fetch verlagert. Merge-Basis = `git show FETCH_HEAD:.ai-memory/state.json` (`$base`), Workspace-Kopie nur Fallback ohne Branch, Neuanlage unverändert. Nur diese eine Datei geändert.
- Lokaler Smoke-Test (Simulations-Repo /tmp): AK1 stale Workspace `implement` + Branch `fixup` → Commit `[fixup, review]`, 1 Parent; AK2 orphan `{"phases":{"triage":…}}`.
- Checks: `pnpm lint:actions` ✔, `bash -n` auf extrahiertem Run-Block ✔, Prettier ✔; Pre-Commit-Hook (format/actions/knip/lint) komplett grün.
- Branch `fix/issue-1009-state-merge-basis-fetchhead`, Commit 84406e04, gepusht.
- **PR #1011 erstellt (nicht draft), Closes #1009, verifiziert OPEN/draft=false.**

## Relevante Stellen
- `.github/actions/issue-state-save/action.yml` — Merge-Block jetzt zwischen read-tree-Block und Staging-Loop; `$base`-Capture steht VOR `export GIT_INDEX_FILE`.
- Commit-Message des PR enthält Ursachenkette (Fixup setzt Label vor eigenem Save).

## Annahmen
- Aufrufer-Workflows 01–06 brauchen keine Änderung (nur Action-interna).
- Ökonomischer Nachweis (fixup→review-Kette) erfolgt per CI-Beobachtung, nicht durch diesen Lauf.

## Verworfen
- Merge vor dem Fetch belassen + Workspace-Refresh — Zeitfenster bliebe bestehen.

## Offen
- - (nichts Blockierendes)

## Nächster Schritt
- Keiner für diese Phase; Review-Phase prüft PR #1011.

## Fallstricke
- GIT_INDEX_FILE erst NACH dem Fetch exportieren (0-Byte-Index lässt fetch still scheitern) — Reihenfolge im neuen Code eingehalten, nicht umdrehen.
- Smoke-Test: Staging-Loop (`update-index --cacheinfo`) MUSS mitgetestet werden, sonst zeigt der Commit nur den alten FETCH_HEAD-Stand; Shell-Variablen gelten nur innerhalb EINES Bash-Calls.
- Tests: Carve-out (ADR-0001), kein Test-Vertrag; keine Tests geschrieben (nur CI/YML geändert).
