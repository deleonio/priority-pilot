FOCUS: monthly adversarial security run (red team, method see METHOD) against the LOCAL throwaway instance of this system. Goal: breach what the security goals protect — read other users' data (Vertraulichkeit), change or destroy other users' data and system state (Integrität), escalate role/plan/permissions (Zugriffskontrolle), crash or block the service (Verfügbarkeit). ONLY attack + report — NO file changes, NO commit, NO label, NO issue, NO comment (the workflow does the GitHub side effects after you). Save tokens: short, precise, direct.

METHOD: read and follow .claude/skills/hacker-team/SKILL.md (four attacker perspectives, safety rules, procedure, evidence rules). The report skeleton below is binding.

ATTACK ENVIRONMENT (workflow booted it; restart recipe at the end):
  - Frontend: http://localhost:4174 (Vite, proxies API to the backend). API: http://localhost:3001.
  - Auth is ACTIVE: unauthenticated API calls return 401. Mint real sessions via the test endpoint (NODE_ENV=test):
      curl -s -c /tmp/attacker.jar -H 'Content-Type: application/json' -d '{"email":"angreifer@example.com"}' -X POST http://localhost:3001/auth/test-login
    Mint at least one VICTIM session too (e.g. opfer@example.com) and seed recognizable victim data through the API with it.
  - Browser-Session: the browser (Playwright-MCP) has its own cookie store. Transfer a minted session in two steps: (1) read the full `connect.sid` value from your cookie jar via bash (INCLUDING `s%3A` prefix and signature), (2) inject it with `playwright_browser_run_code_unsafe`:
      async (page) => { await page.context().addCookies([{ name: 'connect.sid', value: '<sid-aus-schritt-1>', url: 'http://localhost:4174' }]); }
    Cookies are host-based, not port-based — one localhost cookie serves frontend AND API through the Vite proxy. Then navigate to http://localhost:4174/app/.
  - MONETIZATION_ENFORCED=1 is set: the plan gates (requirePlanFeature) are armed — attacks on plus/pro features are real. Without this flag every plan check would pass through (rollout switch, server/src/logics/plans.ts).
  - The DB is an in-memory throwaway with demo seed; NO real secrets exist — external providers (Google, PayPal, Play, LLM) are unreachable. Their surfaces (billing, Play review login, OAuth) are judged from CODE only, never attacked live.
  - POST /auth/test-login exists ONLY in NODE_ENV=test (production never registers it): minting admin role or pro plan through it is NOT a vulnerability — never report it as one. Use it to GET privileges for testing whether OTHER routes properly check them.

GOAL SOURCES (what counts as a breach — read them fully yourself, fresh state):
  1. docs/auth-setup.md
  2. docs/adr/0013-zahlungsweg-paypal-abos.md
  3. docs/adr/0017-store-billing-google-play.md
  4. docs/adr/0018-preismodell-free-plus-pro.md
  5. docs/adr/0019-zugang-launch-warteliste.md
  6. docs/mcp-admin.md

ATTACK SURFACE (recon first, then attack live): server/src/express/** (routes, middleware — requireAuth, requireRole, planGuard, ownerScope), server/src/logics/** where attacked routes use it, frontend/src rendering sinks for stored XSS (browser). .github/scripts/** only if an attack would need CI-level mechanisms (report only, CI layer is not fixable here).

ORDER:
  1. BESTAND FIRST: if {{HACKER_ISSUE_NR}} is not 0, read the body of issue {{HACKER_ISSUE_NR}} (`gh issue view {{HACKER_ISSUE_NR}} --json body --jq .body`) — the previous report; take over its open findings with their numbers. Then `gh issue list --state open --limit 200 --json number,title` and `gh pr list --state open --limit 100 --json number,title` as the open-work dedup list.
  2. read ALL goal sources. Batch them in ONE tool block (AGENTS.md "Turns bündeln").
  3. verify the attack environment (unauthenticated GET http://localhost:3001/tasks must answer 401; frontend must load), mint attacker + victim sessions, seed victim data.
  4. AUFKLÄRUNG: read routes and middleware, build the attack map (route → guard → logic). Every finding you chase later needs this map as context.
  5. ANGRIFFE per METHOD: all four perspectives attack via curl and browser. Log every attempt (method, path, body, status, response excerpt) — failed attacks are `bestanden` results. If the server crashes: secure evidence FIRST (log excerpt /tmp/hacker-instance.log + last request), then restart:
       HACKER_NO_WATCH=1 nohup ./hacker-instance.sh > /tmp/hacker-instance.log 2>&1 &
     and wait for readiness (401 on /tasks).
  6. consolidation per METHOD (only reproduced breaches), then report.

REPORT (MANDATORY): write via bash heredoc to /tmp/hacker-team-report.md. The workflow posts this file verbatim as the issue body — WRITE IT IN GERMAN (headings and findings alike). Keep the headings EXACTLY as given (the workflow checks them). Structure:
  # Hacker-Team — Angriffsbericht (Stand {{REPORT_DATE}})
  ## Methodik
  3-5 lines: perspectives applied, goal sources read (paths), attack scope (which surface, how many attacks attempted/defended).
  ## Übernahme aus Vorlauf
  Per carried finding: status (offen | umgesetzt | weggefallen) + one-line reason. "umgesetzt" ONLY if re-verified in this run's attack. First run: "Erstlauf — keine Übernahme."
  ## Angriffsziele-Check
  One table, columns: Ziel | Status (geknackt | gehärtet | unklar) | Beleg (Angriff mit Ergebnis oder Datei:Zeile). Exactly these four rows are mandatory: Vertraulichkeit (Fremddaten lesen) · Integrität (Fremddaten ändern/löschen) · Zugriffskontrolle (Rolle/Plan/Rechte eskalieren) · Verfügbarkeit (Dienst crashen/blockieren). Sub-rows allowed.
  ## Kernerkenntnisse
  2-4 sentences: the biggest hole this month, in one breath.
  ## Schwachstellen
  ALL reproduced findings ranked by damage (ties: smaller fix first). Per finding:
  `### Rang <n> — <Perspektive/Ziel>`
  Beobachtung mit vollständiger Reproduktion (konkrete Requests + beobachtete Responses: Status und Body-Auszug) — Ort der fehlenden/schwachen Prüfung (Datei:Zeile) — Schadensszenario (was gewinnt ein Angreifer wirklich) — **Schwere** (hoch | mittel | niedrig) — **Aufwand der Behebung** (leicht | mittel | schwer).
  If none: `keine — alle Angriffe dieser Sitzung wurden abgewehrt.`
  ## Umsetzungs-Kandidaten
  HÖCHSTENS 3 (weniger ist ausdrücklich in Ordnung). Each as a paste-ready ticket draft in the issue-template structure: **Was ist das Problem?** / **Wie soll es sein?** / **Wo tritt es auf?** / **Woran messen wir das?** (at least one dash-bullet, verifiable from outside) — plus **Thema**: Sicherheit und **Komplexität** (Einfach | Mittel | Komplex).
  ## Entscheidung
  One line: der Mensch entscheidet, welche Kandidaten als Tickets angelegt werden.

ONLY evidence-backed findings — no reproduced attack, no Schwachstelle. No style lecture, no generic security advice without a concrete anchor in this repo.

VERDICT (one line, the very LAST line of your reply):
  - VERDICT: report  (at least one reproduced breach — or an unklar result worth human eyes — findings written to /tmp/hacker-team-report.md)
  - VERDICT: clean   (every attack defended — report still written, Schwachstellen section states it)

HONESTY RULE: output a VERDICT ONLY if /tmp/hacker-team-report.md exists, is non-empty, the Angriffsziele-Check table has all four rows, and every Schwachstelle carries its reproduction and a Datei:Zeile anchor.

SAFETY (binding, per METHOD): attack ONLY the local instance on localhost:4174/3001. No external hosts, no scanning beyond these ports, no real credentials. Restart only per the recipe above.

TIME LIMIT: soft deadline = {{SOFT_DEADLINE}}. Before every step: [ $(date +%s) -ge {{SOFT_DEADLINE}} ]. If OVER: write the report with the current state (attacks not yet run go into the Ziel-Check as unklar), end the turn.
