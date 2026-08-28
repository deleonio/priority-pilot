# Fixup-Notiz — PR 1081 (Kreuzverhör Runde 1 → Fixup-Verifikation)

## Erledigt
- Keine Konflikte: `git status` sauber (nur ungetrackte Phasen-Notizen), Branch
  `feat/harness-branch-architecture` per `git merge --ff-only` auf `origin/…` → `e768ae95`
  gebracht (lokal war `b2e641c7`, Remote hatte 3 Commits mehr, u. a. `8715e7cd`, `3771f809`,
  `e768ae95 fix: review-finding 1+2`).
- Beide Findings aus Runde 1 als BEHOBEN verifiziert (Fixup-Verifikation, kein neues
  Kreuzverhör):
  - Finding 1: `.github/actions/setup-claude/action.yml:299` enthält jetzt
    `':(exclude).ai-memory/state.json'` im Restore-Pathspec (neben dem bestehenden
    `':(exclude).ai-memory/MEMORY.md'`) — exakt die empfohlene Fix-Variante 1; ADR-0007-
    Punkt-3-Invariante (state.json nie nach main) wieder geschlossen. `.gitignore` enthält
    weiterhin kein `state.json` (Autor wählte Pathspec-Variante, nicht die Gitignore-Alternative).
  - Finding 2: `.github/workflows/cache-cleanup.yml:31-38` (Header-Kommentar „STORAGE-BRANCH-SWEEP
    (ADR 0007, Erbe aus ADR 0006)“, beide Prefixe `ai/harness/{N}` + legacy `ai/state/issue-{N}`)
    und `:104-106` (Step-Kommentar „ADR 0007 (Erbe 0006) … ai/harness/* + legacy ai/state/*“)
    — Kommentar-Drift beseitigt, Scope-Angabe stimmt jetzt mit dem Sweep (`:121-124`, `:154-156`)
    überein.
- Beide Inline-Threads (`PRRT_kwDONloM186dDX8v` path setup-claude/action.yml,
  `PRRT_kwDONloM186dDX8x` path cache-cleanup.yml:103) sind bereits
  `isResolved=true` + `isOutdated=true`; der Autor hat je mit „Behoben in e768ae95“ geantwortet.
- Sammelkommentar (`<!-- ai-review -->`, Issue-Kommentar-ID 5448118915) aktualisiert: Findings 1+2
  in die Tabelle „✅ Behobene Anmerkungen“ verschoben (via `e768ae95`, 2026-08-28), Status-Zeile
  `needs-fixup` → `reviewed`, Abschnitt „📋 Offene Findings“ entfernt, Review-Typ um
  „Fixup-Nachweis“ ergänzt. PATCH per `gh api --method PATCH repos/.../issues/comments/5448118915`.
- Kein eigener Commit nötig — die Fixes lagen schon auf dem Branch; Gate-Lauf entfällt.

## Relevante Stellen
- `.github/actions/setup-claude/action.yml:296-301` — Memory-Load-Loop (Legacy-Fallback
  `ai/state/issue-{N}`); Zeile 299 = Restore-Pathspec mit beiden Excludes.
- `.github/workflows/cache-cleanup.yml:31-38,103-106,121-124,154-160` — Sweep-Kommentare und
  -Implementierung über beide Storage-Prefixe.
- `.ai-memory/issue-1081-review.md` — Review-Notiz der Vorphase (Findings 1+2, Methode, Fallstricke).

## Annahmen
- CI auf `e768ae95` wird grün: beim Notiz-Schreibzeitpunkt `precheck` pass, `verify`/`e2e (1-4)`
  pending (Run 33139935243), `review` in_progress (Run 33140037062); nichts rot, kein Fix-Ziel.
- Kein weiteres Finding: nur 2 Review-Threads existieren; die beiden COMMENTED-Reviews von
  `deleonio` haben leere Bodies (nichts abzuleiten).
- Verdict `already-done` ist hier korrekt: Fixes sind committet (nicht von mir), Threads resolved,
  kein Commit in diesem Lauf.

## Verworfen
- Eigener Fix-Commit für die Findings — bereits durch den Autor in `e768ae95` erledigt
  (Doppel-Commit wäre no-op mit Merge-Konfliktrisiko).
- Neues Kreuzverhör des vollen Diffs — Skill-Kontrakt: Fixup-Runde = Verifikation der
  gemeldeten Findings, keine Neu-Bewertung; Review-Run 33140037062 lief parallel.
- `ai-fixup-decisions`-Kommentar — nur für needs-human (Entscheidungs-Findings) vorgesehen;
  hier keine.
- Worktree/Preview-Checks (UI-Tools, Playwright) — PR berührt keinen UI-/App-Code, nur
  Workflows/Composite-Actions.

## Offen
- Nichts Blockierendes. Beobachtung: `verify`/`e2e` waren beim Laufende noch pending — falls sie
  rot gehen, ist das ein eigener Fixup-Nachlauf (dann according to Prompt-Schritt 5 behandeln).

## Nächster Schritt
- `VERDICT: already-done` (Datei `/tmp/claude-verdict` als letzte Aktion + Ausgabezeile), mit
  Begründung pro Finding: Finding #1 — fixed in e768ae95; Finding #2 — fixed in e768ae95.

## Fallstricke
- Sammelkommentar per PATCH (ID 5448118915), NICHT neu anlegen — Marker `<!-- ai-review -->`
  bleibt erste Zeile, Kommentar-ID unverändert (Konsolidierungs-Kontrakt).
- Body-Datei für den PATCH NICHT nach `.ai-memory/` legen: das Verzeichnis ist seit ADR 0007
  nicht mehr gitignored (`.gitignore:1-4` sagt es ausdrücklich) — eine Temp-Datei dort würde als
  ungetracktes Artefakt im nächsten Commit landen. `dist/` ist ignored und liegt im Working-Dir
  (Write-Tool), danach löschen.
- Finding-Nummern stabil halten (1, 2) — die Tabelle „Behobene Anmerkungen“ ist die Historie
  über Runden.
- Keine Labels setzen (Workflow macht das); kein `ai-review`-Kommentar-Konflikt mit dem
  parallel laufenden Review-Run — dessen Ergebnis (falls abweichend) überschreibt legitimerweise.
