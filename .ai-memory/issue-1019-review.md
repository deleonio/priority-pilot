# PR 1019 Review (CI-Phase 5) — VERDICT-Parser-Härtung

## Erledigt
- KREUZVERHÖR abgeschlossen, VERDICT: needs-fixup (Review-Runde 1, 2026-08-25)
- Titel-Gate angewendet: `fix(ci): make VERDICT parser ignore prose after token` ({{TITLE_OK}}=false, deutschsprachiges Subject)
- Inline-Review gepostet (Review-ID 5018555723): F1 implement.md:7, F2 04-claude-implement.yml:800, F3 review.md:47 (F3-Body per PATCH 3852677610 korrigiert — Python-\`-Escape-Falle)
- ai-review-Sammelkommentar angelegt: issuecomment-5409993735 (Marker gesetzt, 3 offene Findings)
- Parser live verifiziert: beide echten #1017-Zeilen → ux-ready; GNU grep 3.11 leftmost-longest (`spec-ready`≠`ready` ✓); Fail-safe-Leerzeile ✓; Aufwandsklasse „sonnet (mittel)" → sonnet ✓
- CI grün: verify, e2e ×4, label, precheck pass (implement/fixup/gate-merge skipping = trigger-bedingt normal)
- Repo-weit keine weitere `tr -d -c`-VERDICT-Stelle außer den 2 bewusst unberührten Dateikanälen (04:796, 05:306)

## Relevante Stellen
- `.github/workflows/04-claude-implement.yml:800` — Fixup-Fallback `grep -oE 'needs-human'` ohne `already-done` (Finding 2)
- `.github/prompts/fixup.md:67-76` — lehrt Output-Fallback `VERDICT: needs-human` bzw. `already-done`
- `.github/scripts/fixup-verdict.sh:59-96` — Decision-Table: already-done + Review-Delta → Re-Review, sonst Parken
- `.github/prompts/{ux,spec,implement,review}.md` — komplett umgeschrieben (−188 Zeilen), Verluste s. Finding 1
- `05-claude-pr-review.yml:258-260` — Workflow hängt memory-read/write-Snippets an Prompt an (Memory-Pflicht bleibt wirksam trotz entferntem Hinweis in review.md)
- Workflow-Trigger 01–05: `issues/pull_request: labeled(/unlabeled)` — Grund für Labels-Guardrail-Bewertung

## Annahmen
- {{TITLE_OK}}=false korrekt interpretiert (Prompt zeigte wörtlich „Bei `false=false` umbenennen")
- ADR 0001 gilt → keine Workflow-Tests gefordert; MEMORY.md-Eintrag im PR regelkonform (committende Phase)

## Verworfen
- „Memory-Hinweis-Wegfall in review.md ist Finding" — 05 hängt memory-write.md an den Prompt, Pflicht bleibt wirksam
- „Mehrtoken-Echo ist Blocker" — nur noch Konsistenz-Finding F3 (Echo parkt vorher wie nachher beim Menschen)
- „Trailing-Newline-Verlust der 4 Prompts ist Finding" — CI/verify grün, Prettier akzeptiert

## Offen
- Erwartet: Fixup-Runde setzt F1–F3 um (F1: Prompts restore + nur VERDICT-Zeilen ändern ODER Side-Scope im Body deklarieren; F2: `grep -oE 'needs-human|already-done'`; F3: Beispielzeile marker-frei)
- Issue #1017 bleibt vom Menschen zu entblocken (im PR-Body deklariert, kein Scope dieses PR)

## Nächster Schritt
- Fixup-Nachweis-Runde: ai-review-Kommentar 5409993735 laden, Fixup-Diff seit updatedAt auf F1–F3 prüfen + neue Probleme im Fixup-Diff

## Fallstricke
- Python-JSON-Payload mit `\``in normalen Strings produziert Literal-Backslash im geposteten Markdown → raw-Strings (r""") oder Code-Blöcke nutzen
- Der 04-Fixup-Fallback (Z. 800) ist ein ANDERER Parser als der Implement-Parser (Z. 328) — Vokabulare differieren absichtlich (fixup.md vs. implement.md lehren unterschiedliche Tokens)
- Dauer-Gedächtnis-Kandidat für Fixup/Spec-Phase: „PRs mit Prompt-Rewrite-Nebenscope müssen diesen im Body deklarieren" — Review hat es als F1 etabliert; falls das Fixup es umsetzt, könnte ein künftiger Lauf das als Konvention hochstufen
