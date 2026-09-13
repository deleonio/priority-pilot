FOCUS: weekly UX advisory for the app (team-of-perspectives method, see METHOD). Judge how the app feels to use: does it feel like it is there for the user, does it invite coming back? ONLY analysis + report — NO file changes, NO commit, NO label, NO issue, NO comment (the workflow does the GitHub side effects after you). Save tokens: short, precise, direct.

METHOD: read and follow .claude/skills/ux-team/SKILL.md (four perspectives, procedure, evidence rules, principles). The report skeleton below is binding.

GOAL SOURCES (define the philosophy you judge against — read them fully yourself, fresh state):
  1. docs/gesamtkonzept-monetarisierung.md
  2. docs/user-guide.md
  3. .ai-knowledge/ux-design.md

WORK SOURCES (rules and dedup — read fresh):
  4. docs/mobile-ui-rules.md
  5. docs/ux-pattern-sequential-confirmation.md
  6. docs/ux-pattern-master-detail-settings.md
  7. docs/design-optimierungsplan.md — its open findings are ALREADY known work; never re-report them, they are dedup material.

ORDER:
  1. BESTAND FIRST: if {{UX_ISSUE_NR}} is not 0, read the body of issue {{UX_ISSUE_NR}} (previous report) and list its carry-over items. Then run `gh issue list --state open --limit 200 --json number,title,labels` and keep the titles as the open-work dedup list.
  2. read ALL goal sources, then the work sources.
  3. LIVE WALKTHROUGH: the app runs at http://localhost:4174 (inspect instance, no login needed). Use the Playwright browser tools. Walk the key flows at 375px AND 1280px: dashboard, quick task creation, checklist completion, balance pillars + advisor, settings. Screenshot what you judge, store the screenshots under /tmp/ux-team-shots/ and reference their file names in the report.
  4. SESSION per METHOD: the perspectives judge the walked flows.
  5. CONSOLIDATION: rank by experience gain vs. effort, dedup against the open work, resolve the carry-over statuses.
  6. REPORT as below.

REPORT (MANDATORY): write via bash heredoc to /tmp/ux-team-report.md. The workflow posts this file verbatim as the issue body — WRITE THE REPORT IN GERMAN (headings and findings alike). Structure:
  # UX-Team — Wochenblick {{REPORT_DATE}}
  ## Methodik
  3-5 lines: perspectives applied, sources read (paths), walkthrough scope (flows x viewports).
  ## Übernahme aus Vorwoche
  Per carried item: status (offen | umgesetzt | weggefallen) + one-line reason. "umgesetzt" ONLY if you verified it in the walkthrough or the code; "weggefallen" if the flow/surface is gone or the item now lives in an open ticket. First run: "Erstlauf — keine Vorwoche."
  ## Kernerkenntnisse
  2-4 sentences: overall impression — does the app feel like it is there for the user, what is the biggest lever this week?
  ## Funde
  ALL findings ranked by experience gain (ties: smaller effort first). Per finding:
  `### Rang <n> — <Fluss/Kontext>`
  Beobachtung (with anchor: screenshot file name, file/line, or guide passage) — why it hurts the experience — concrete suggestion — **Erlebnisgewinn** (hoch/mittel/niedrig) — **Aufwand** (leicht/mittel/schwer). User language, not framework language.
  ## Umsetzungs-Kandidaten
  HÖCHSTENS 3 (weniger ist ausdrücklich in Ordnung — lieber zwei tragfähige als drei aufgefüllte). Each as a paste-ready ticket draft in the issue-template structure: **Was ist das Problem?** / **Wie soll es sein?** / **Wo tritt es auf?** / **Woran messen wir das?** (at least one dash-bullet, verifiable from outside) — plus **Thema**: UX/UI and **Komplexität** (Einfach | Mittel | Komplex).
  ## Entscheidung
  One line: der Mensch entscheidet, welche Kandidaten als Tickets angelegt werden.

ONLY evidence-backed findings — no speculation, no style nitpicks without a felt benefit for the user.

VERDICT (one line):
  - VERDICT: report  (at least one evidence-backed finding, written to /tmp/ux-team-report.md)
  - VERDICT: clean   (nothing worth reporting this week — no new findings, carry-over unchanged)

HONESTY RULE: output VERDICT: report ONLY if /tmp/ux-team-report.md exists, is non-empty, and every finding carries its anchor there.

TIME LIMIT: soft deadline = {{SOFT_DEADLINE}}. Before every step: [ $(date +%s) -ge {{SOFT_DEADLINE}} ]. If OVER: write the report with the current state, end the turn.
