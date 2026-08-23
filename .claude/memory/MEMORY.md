# Dauergedächtnis

Erfahrungs-Log der KI-Agents in diesem Repo: was in früheren Läufen schiefging und was
stattdessen funktioniert hat. Wird über Tickets hinweg fortgeschrieben und ist versioniert —
jeder Lauf liest es, damit derselbe Fehler nicht zweimal passiert.

**Das hier ist kein Regelwerk.** Feste Regeln stehen in [`../../AGENTS.md`](../../AGENTS.md) und
[`.ai-knowledge/`](../../.ai-knowledge/); hier stehen nur Erfahrungen, die dort (noch) nicht
verankert sind. Aufnahmekriterium, Format und Kuratierung: `AGENTS.md` → Memory.

Abzugrenzen von den `issue-*.md` im selben Verzeichnis — das sind flüchtige Phasen-Notizen eines
einzelnen Tickets (Soft-Abort-Resume), gitignored und nach dem Merge weg.

## Learnings & Erfahrungen

Append-only: neue Einträge **ans Ende**. Bestehende Zeilen nicht umschreiben oder umsortieren —
das bricht den `union`-Merge aus [`.gitattributes`](../../.gitattributes) und erzeugt genau die
Konflikte, die er verhindern soll.

- 2026-08-19 · CI/Memory — GitHub vergibt für Issue-/Label-/PR-Trigger (und daraus kaskadierte
  `workflow_run`-Läufe) nur lesende Cache-Token; ein Cache-Save scheitert still als `##[warning]`
  („token has no writable scopes") bei grünem Job. → Artefakte statt Cache; sie unterliegen der
  Restriktion nicht.
- 2026-08-19 · CI/Workflows — `${{ steps.*.outputs.* }}` wird wörtlich in den `run:`-Block
  substituiert, ohne Quoting-Layer. Tool-Spezifizierer mit Klammern (`Bash(gh *)`) lassen bash
  dann `(` als Subshell-Start parsen → `syntax error near unexpected token '('`, exit 2. → Wert
  nach `--allowedTools`/`--disallowedTools` immer single-quoten.
- 2026-08-19 · CI/Tool-Permissions — Claude Code wertet für Datei-Schreibzugriffe nur
  `Edit(path)`-Regeln aus, `Write(path)` wird ignoriert (`Edit` deckt alle file-editing-Tools
  inkl. `Write` ab). Ein globales `Edit`-Disallow lässt sich per Allow-Regel nicht wieder
  punktuell öffnen — Disallow gewinnt. → Schreibrechte ausschliesslich über eine
  `Edit(path)`-Allowlist modellieren, nicht über Bypass + Disallow.
- 2026-08-19 · Build — repo-weites `pnpm build`/`pnpm lint` ist in den meisten Läufen unnötig
  teuer. → Gezielt filtern: `pnpm --filter server build`, `pnpm --filter server lint`.
- 2026-08-20 · Labels/Spec-Phase — der lokale `/spec-ticket`-Wrapper nennt generische
  Label-Namen "ai:ready"/"ai:spec-ready", die in diesem Repo nicht existieren. Die echte
  Konvention steht in `.github/workflows/03-claude-spec.yml`: bei Erfolg `ai:needs-spec`
  entfernen + `ai:needs-impl` setzen (Phase 4/7). → Vor dem Label-Setzen `gh label list`
  gegenprüfen statt Wrapper-Namen blind übernehmen.
- 2026-08-20 · Sandbox/Playwright — frische Sandbox hat kein Chromium für `pnpm exec playwright
  test` (`Executable doesn't exist … chromium_headless_shell-…`). → Einmalig
  `pnpm exec playwright install chromium --with-deps` vor dem ersten e2e-Lauf pro Sandbox.
- 2026-08-20 · Bash-Tool/GitHub-GraphQL — je `Bash`-Aufruf ist eine neue Shell: Shell-Variable
  (z. B. `BODY`) definiert in einem Call sind im nächsten leer. → Variablen immer im selben
  Call definieren+verwenden. Außerdem: GraphQL-`deletePullRequestReviewComment` will das
  Eingabefeld `id` (nicht `commentId`/`pullRequestReviewCommentId`); `addPullRequestReviewThreadReply`
  will `pullRequestReviewThreadId` (nicht `threadId`).
- 2026-08-20 · Prettier/Markdown — ein Zeilenumbruch mitten in einem Inline-Code-Span
  (`` `foo\nbar` ``) lässt sich NICHT per Einrückung/Blockquote-Präfix „reparieren": Prettier
  behandelt Code-Span-Inhalt über Zeilenumbrüche hinweg als literal und entfernt eingefügte
  Präfixe beim nächsten `--write` wieder kommentarlos. → Stattdessen den Umbruch aus der Mitte
  des Code-Spans herausziehen (ganzen Span in eine Zeile), dann wrapped Prettier den Absatz
  selbst korrekt. Nach jedem Markdown-Fix `prettier --write` + `git diff` gegenprüfen, ob die
  Änderung überlebt.
- 2026-08-23 · CI/Rerun — `gh run rerun <id> --failed` direkt nach einem Push landet in derselben
  Concurrency-Gruppe und CANCELLT den frisch gestarteten Run des neuen Commits („higher priority
  waiting request"). Der Rerun testet zudem den ALTEN SHA. → Erst Rerun abwarten, dann den gecancelten
  Run des neuen SHA per `gh run rerun <cancelled-run-id>` (ohne --failed) neu starten statt nachzu-
  pushen (Commit-Stop-Guard).
- 2026-08-23 · Spec-Phase/Pre-Commit — der Pre-Commit-Hook läuft `tsc --noEmit` über den
  ganzen Frontend-Workspace; rote Tests, die die noch NICHT existierende API benennen
  (`result.current.refresh`), sterben am Hook statt rot zu laufen. → Neue API im Test per
  Intersection-Typ optional deklarieren (`type T = ReturnType<typeof hook> & { neu?: … }`)
  und casten — Produktiv-Typ unangetastet.
- 2026-08-23 · Git/Sandbox — frische Runner-Sandbox hat kein `git config user.name/email`:
  `git commit` scheitert mit „empty ident name", ein vorher gestarteter `git push -u origin
  <branch>` legt trotzdem einen LEEREN Remote-Branch an. → Vor dem ersten Commit lokal
  `git config user.name/user.email` setzen und Commit-Ergebnis per `git log -1` verifizieren.
- 2026-08-23 · Vitest 4 — `--reporter=basic` existiert nicht mehr („Failed to load custom
  Reporter"); nur noch default/tap/etc. → Default-Reporter nutzen und Output per `tail`
  kürzen.
- 2026-08-23 · Spec-Phase/Issue-Body — gelegentlich ist der KI-ANALYSE-Block im Issue-Body defekt (enthält wörtlich `$(gh issue view …)` statt Inhalt). → AKs dann aus Titel + KI-UX-Block + Analyse-Bot-Kommentar (`gh issue view N --json comments`) ableiten und den Defekt im Spec/PR-Body dokumentieren.
- 2026-08-23 · GraphQL/Threads — Review-Threads auflösen: `resolvePullRequestReviewThread` existiert
  im Schema dieses Endpoints NICHT (`Field doesn't exist on type "Mutation"`); Introspektion ergab
  `resolveReviewThread(input:{threadId})`. Außerdem `body` als `$b:String!` deklarieren und der
  Reply-Payload hat kein `thread`-Feld — `comment{databaseId}` selektieren.
