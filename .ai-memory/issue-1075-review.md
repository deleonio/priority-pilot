# PR #1075 — Review (Kreuzverhör Runde 1, 2026-08-27)

MODE: CROSS-EXAMINATION (kein `<!-- ai-review -->`-Marker vorhanden bei Start).
Kein Closing-Issue (`closingIssuesReferences | length` = 0) → „Review ohne Issue - PR-Beschreibung ist massgebend".
ERGEBNIS: 🟢 reviewed. Sammelkommentar gepostet (Marker verifiziert: genau 1), Review-Body als COMMENT-Review (ID 5045376955). Verdict `reviewed` in /tmp/claude-verdict.

## Erledigt
- Modus bestimmt: Kreuzverhör (kein Marker auf PR 1075).
- PR-Diff vollständig gelesen (680 Zeilen, 16 Dateien, +187/−212; 1 Commit 80b41f43).
- Heredoc↔Datei-Fidelität: Basis-Workflows (`git show origin/main:…`) Heredoc extrahiert vs. neue Prompts gedifft — guide-sync bytidentisch; prompt-audit/spec-sync nur die im PR-Body dokumentierten Änderungen + 1 Wortänderung („nitpicking"→„nitpicks", prompt-audit.md:28, belanglos).
- Sammel-PR-Behauptung verifiziert: claude-spec-sync.yml:183-184 „EINEN Sammel-PR" (alte Heredoc-Zeile „pro Datei ein PR" war stale — Fix korrekt).
- Checkout-Präsenz: actions/checkout in allen 3 Nightly-Workflows vor dem `cp` (guide-sync:112<186, prompt-audit:75<120, spec-sync:105<168).
- Adapter-Nachlieferung geprüft: documenter.md:1-19 (`/tmp/doc.json`, {{PR_NR}}/{{LINKED_ISSUES}}/{{TITLE_OK}}/{{SUGGESTED_*}}, TIME LIMIT {{SOFT_DEADLINE}}); implement.md:39-43 (VERDICT needs-review/not-ready); spec.md Label-Flow passend zu 03-claude-spec.yml:281-322 (inkl. spec-partial); triage.md ai:model-Notiz.
- Neutralitäts-Grep über alle 6 SKILL.md: nur die 2 dokumentierten Ausnahmen (ticket-spec:41 Carve-out-Bereiche, ticket-ux:52 VERDICT-Abgrenzung).
- Kein Test/Skript parsen SKILL.md-Inhalte (grep über --include="*.test.*" + .github/scripts → nur Kommentar-Erwähnung in resolve-spec-skip.sh:6).
- .prettierignore:25,30 deckt .github/prompts/ + .claude/skills/ (PR-Behauptung stimmt).
- CI: 0 Fails (gh pr checks; „review"-Job pending = dieser Lauf).
- Titel-Gate: „chore(ci): move pipeline protocol from skills to .github/prompts" (64 Z., CC-konform) — PASS, kein Rename.

## Relevante Stellen
- .github/prompts/{guide-sync,prompt-audit,spec-sync}.md — neue extrahierte Nightly-Prompts (sed-Platzhalter {{SYNC_DATE}}/{{AUDIT_DATE}}/{{SOFT_DEADLINE}} alle substituiert).
- .github/workflows/claude-{guide-sync,prompt-audit,spec-sync}.yml — Heredocs ersetzt durch `cp .github/prompts/…`.
- .github/prompts/{documenter,implement,spec,triage}.md — Adapter, die das aus den Skills entfernte Protokoll tragen.
- .claude/skills/{pr-documenter,review-kreuzverhoer,ticket-implementation,ticket-spec,ticket-triage,ticket-ux}/SKILL.md — neutralisiert.
- AGENTS.md:58-63 — neue Kernregel „Schichten-Trennung Pipeline"; docs/ci-architecture.md:234-238 Prompt-Aufzählung erweitert.

## Annahmen
- Lokaler HEAD (Merge 15b30792 enthält PR-Head 80b41f43) repräsentiert den PR-Dateizustand für alle On-Disk-Prüfungen.
- e2e-Checks (3)/(4) pass (Tally zeigte keine fail-Zeile; grep -ci fail = 0).

## Verworfen
- MEMORY.md-Eintrag — striktes Kriterium, nichts lief schief, nichts generalisierbar Neues (Heredoc-Diff-Technik ist Routine, kein Fehler→Lösung-Paar).

## Offen
-

## Nächster Schritt
- Keiner aus Review-Sicht. Falls Fixup-Push kommt: MODE FIXUP VERIFICATION, Delta seit Sammelkommentar-UpdatedAt (2026-08-27), Befund-Nummerierung beginnt bei 1 (keine vergeben).

## Fallstricke
- PR hat KEIN Issue → in jeder Folgerunde „Review ohne Issue - PR-Beschreibung ist massgebend" in Status + Bestätigung nennen (AK-Verifikation unmöglich).
- Sammelkommentar-Format: Zeile 1 Marker, Zeile 2 `🎯 Review-Status: **reviewed** — …` (fett, ohne `##`), Footer `---\nReview-Typ: …\nUpdated: …` — Präzedenz PR #1068 kopiert.
- Helper-Dateien .ai-memory/review-body-1075.md + collected-1075.md nach dem Posten wieder löschen (matchen nicht das issue-*-gitignore-Muster).
