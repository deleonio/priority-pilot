FOCUS: weekly nit digest. Collect the review nits from recently merged PRs and rank the 10 most valuable ones. ONLY analysis + report - NO file changes, NO commit, NO label, NO issue, NO comment (the workflow does the GitHub side effects after you). Save tokens: short, precise, direct.

DEFINITION nit: a review-thread comment that the reviewer marks as non-blocking (Nit, "nicht blockierend", optional, yellow/purple circle) - or a plainly minor finding (naming, comment wording, grammar, tiny duplication, missing null-guard in a test). NOT a nit: anything marked Blocker or red circle.

SOURCES (read fresh, via gh):
  1. `gh pr list --state merged --limit 60 --json number,title,mergedAt` - keep PRs merged in the last 30 days (today: {{REPORT_DATE}}).
  2. per kept PR: `gh api graphql` on reviewThreads (isResolved, isOutdated, comments.body/path/line/author/url) or `gh api repos/{owner}/{repo}/pulls/<n>/comments --paginate`. Batch the PRs in as few tool blocks as possible (AGENTS.md "Turns buendeln"); skip PRs without review threads.
  3. if {{NIT_ISSUE_NR}} is not 0, read the body of that issue (previous digest): carry over its still-open nits, drop the ones whose thread is now resolved or whose code line is gone.

RANKING: by value of fixing (correctness/security risk of the nit > test that silently measures nothing > user-visible text > code hygiene), ties: smaller effort first. Unresolved threads rank above resolved ones; resolved ones only if the fix is not verifiable in the PR (otherwise mark them "erledigt" and leave them out of the top 10). HOECHSTENS 10 entries; fewer is fine - never pad.

REPORT (MANDATORY): write via bash heredoc to /tmp/nit-report.md. The workflow posts it verbatim as the issue body - WRITE IT IN GERMAN. Structure:
  # Nit-Digest {{REPORT_DATE}}
  ## Umfang
  1-2 lines: number of merged PRs scanned (window), number of threads read, number of nits found.
  ## Top-Nits
  Table: | Rang | PR | Fundstelle (Datei:Zeile) | Nit | Vorschlag | Status (offen/erledigt) |. The PR column is a full link `[#N](url)`; Fundstelle links to the thread url.
  ## Weitere Nits
  Optional bullet list of remaining nits (one line each), only if any.
  ## Entscheidung
  One line: der Mensch entscheidet, welche Nits gesammelt umgesetzt werden.

ONLY evidence-backed nits - each row must trace to a real review comment; never invent one.

VERDICT (one line):
  - VERDICT: report  (at least one nit, report written to /tmp/nit-report.md)
  - VERDICT: clean   (no nits found in the window - issue stays untouched)

HONESTY RULE: output VERDICT: report ONLY if /tmp/nit-report.md exists, is non-empty, and every row carries a thread link.

TIME LIMIT: soft deadline = {{SOFT_DEADLINE}}. Before every step: [ $(date +%s) -ge {{SOFT_DEADLINE}} ]. If OVER: write the report with the current state, end the turn.
