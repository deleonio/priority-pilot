# Umsetzung Issue #1021 — Bilder aus Issues/PRs entfernen (Documenter)

## Erledigt
- DIREKT-MODUS (Analyse: Spec nötig = nein). Branch feat/issue-1021-bildentfernung angelegt.
- `.github/scripts/strip-images.mjs` NEU: reine `stripImages()` + `PLACEHOLDER`
  ('[Bild entfernt – Datenschutz]'), CLI stdin→stdout und `--in-place <file>` (gibt
  changed=0|1 aus). Schützt fenced/Inline-Code (bewusste Entscheidung).
- `.github/scripts/pr-image-strip.sh` NEU: Remote-Sweep über gh — PR-Body (gh pr edit
  --body-file), PR-Kommentare + Issue-Kommentare (PATCH issues/comments/<id>),
  Closing-Issue-Bodies (PATCH issues/<n>, ALLE closingIssuesReferences). PATCH nur bei
  changed=1 → idempotent. Best-effort/::warning, nie exit 1 (ai:documented-Invariante).
- `pr-doc-render.sh`: Sweep-Aufruf an 2 Stellen — Fallback-Pfad vor exit 0 (Zeile ~160)
  und Normalpfad nach Labels (Abschnitt 5, Zeile ~335), je `|| ::warning`,
  --dry-run wird weitergegeben.
- `06-claude-pr-documenter.yml`: Shortcut-Step (⏭️ Bot/Ignore) ruft pr-image-strip.sh
  direkt auf (Datenschutz unabhängig von Doku).
- `.github/scripts/strip-images.test.ts` NEU (node:test): AK1 Funktion, AK1 CLI,
  AK3 Fixpunkt, AK2/AK3 Sweep mit gh-PATH-Stub (Fixtures in Dateien, Writes in Log).
- Smoke-verifiziert (manuell, kein node --test laut Ablauf): Funktion, Sweep Erstlauf
  (4 Zielarten gepatcht, bildfreie Objekte nicht), Idempotenz (Log leer), render.sh
  Fallback+Normalpfad mit Stub — Sweep erfasst auch den neuen ai-documenter-Kommentar.

## Relevante Stellen
- strip-images.mjs — AK1-Kernlogik, von beiden Shell-Skripten via `node --in-place` genutzt.
- pr-image-strip.sh — der Sweep; Stub-Muster für Tests daraus ableitbar.
- pr-doc-render.sh:~160,~335 — die zwei Integationsstellen (Fallback/Normalpfad).
- 06-claude-pr-documenter.yml Shortcut-Step (~Zeile 203) — dritter Aufrufort.
- label-transition.test.ts — Stil-Vorbild für gh-Stub-Tests.

## Annahmen
- node ist auf ubuntu-latest vorhanden (render.sh/sweep laufen dort) — geprüft via command -v-Guard im Sweep.
- Nur Markdown-Syntax-Entfernung nötig; Binär-Attachments (gh-Assets selbst) werden nicht gelöscht,
  nur Verweise ersetzt (Interpretation aus Triage).
- PLACEHOLDER ohne Bild-Syntax → Fixpunkt garantiert Idempotenz (AK3).

## Verworfen
- Integration in documenter.md (LLM-Prompt) — siehe Triage: Prompt darf keine Writes.
- Eigenes Backfill-Skript für historische Issues — Ausbaustufe, kein AK.
- render-Test in der Suite — kein bestehender render-Test, AK4 über bestehende Suite grün.

## Offen
- -

## Nächster Schritt
- Erledigt: Commit 306e5e0d auf feat/issue-1021-bildentfernung gepusht,
  PR #1023 (OPEN, nicht Draft, closingIssuesReferences=1021) erstellt.
  Nächste Phase: Review.

## Fallstricke
- gh-Stub muss PATCH-Body-Argument als `body=@<file>` matchen (MIT '='), sonst ist das
  Write-Log leer und die Platzhalter-Assertions failen.
- Env-Variablen (PATH/Stub) persistieren NICHT zwischen Bash-Tool-Calls — immer im selben
  Call exportieren.
- Der Sweep im render.sh Normalpfad muss NACH Body-Splice + Kommentar laufen, sonst
  schreibt der Splice ungestrippten CUR_BODY zurück.
