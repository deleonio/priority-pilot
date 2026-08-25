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
- 2026-08-23 · CI/Spec-Phase — der verify-Job läuft die (beabsichtigt roten) Spec-Tests und ist rot;
  das ist in der Spec-Phase der Normalzustand, kein Fix-Ziel. → Rot-Assertionen (Zielverhalten) NICHT
  auf 404-Status-quo zurückbauen, um CI grün zu bekommen — der Review-Workflow läuft trotz rotem
  verify weiter; erst die Impl-Phase macht die Tests grün.
- 2026-08-23 · Workflows/YAML — mehrzeilige String-Literale in `run:`-Blöcken mit
  fortsetzenden Zeilen ab Spalte 0 (z. B. zugewiesener Markdown-Block) brechen den YAML-
  Block-Skalar (Parser: "expected <block end>"). → Solche Blöcke per `printf '%s\n%s' "…" "…"`
  bauen (jede Zeile eingerückt) und danach `python3 -c "yaml.safe_load(...)"` + `bash -n` auf
  den extrahierten Step als Guard laufen lassen.
- 2026-08-23 · KoliBri/E2e — `KolTabs` (4.3.0) benennt die `slot`-Attribute seiner Light-DOM-Kinder
  zur Laufzeit um (JSX `slot="tab-1"` → DOM `slot="tabpanel-slot-1"`); CSS-Selektoren wie
  `[slot="tab-1"]` matchen daher 0 Elemente. → Panels via `[slot^="tabpanel-slot-"]` suchen,
  Trigger via `getByRole('tab', { name })` statt `getByText` (matcht sonst zusätzlich Panel-Headings
  → strict-mode violation). Baseline-Spiegel für zentrierte max-width-Seiten als Bounding-Box-Insets
  messen, nicht als computed Padding (sonst falsch bei Viewport > Seitenbreite).
- 2026-08-23 · E2E/Viewport — `waitForStableView(page, 'Priority Pilot')` scheitert auf `/` bei ≤375px: `.app-name` ist dort per CSS versteckt (app.css:288, Banner zeigt nur Logo-Img). → Auf Hauptansicht den Default-ReadyText `Dashboard` nutzen.
- 2026-08-24 · KoliBri/E2E — `KolInputCheckbox` rendert einen nativen `<input type="checkbox">`, dessen `aria-checked` IMPLIZIT ist (kein wörtliches Attribut) — `toHaveAttribute('aria-checked')` scheitert an „Received string: \"\"". → Zustand über `toBeChecked()`/`not.toBeChecked()` (Accessibility-Baum) prüfen; Rollen-Fallback `getByRole('switch').or(getByRole('checkbox'))`.
- 2026-08-24 · KoliBri/Flex-Row — KoliBri-Hosts sind block-level (`width:auto` = 100%): als
  Flex-Item in einer Row füllen sie die Zeile und zerquetschen Nachbarn auf min-content
  (45px-breiter, 3000px hoher Alert-Textblock) — dabei bleiben boundingBox-Reihenfolge-Assertions
  (Alert.x > Switch.rechts) trotzdem GRÜN. → Bei Row-Layout Breiten explizit teilen
  (`flex: 1 1 60%; min-width: 0` auf dem Host, `flex: 0 1 40%` auf dem Nachbar), nie
  `flex-shrink: 0` auf einem 100%-Host. Zusätzlich: `locator.boundingBox()` misst die Border-Box
  inkl. Padding — eine „≥95% der Container-Breite"-AK braucht Full-Bleed
  (`margin-inline: -1.5rem; padding-inline: 1.5rem`), sonst scheitert sie am Container-Padding.
- 2026-08-24 · E2E/Horizontal-Overflow — „kein horizontaler Scroll"-AKs sind in dieser App per
  `scrollWidth ≤ viewport` NICHT prüfbar: die App-Shell clippt mit `overflow-x: hidden`
  (app.css ~1290/1337), `scrollWidth` bleibt strukturell ≤ Viewport (Mutations-Probe: selbst
  `min-width: 340px` blieb grün). → Statt dessen Bounding-Box messen (`el.x + el.width ≤
  viewportWidth` = nichts geclippt); Card-Padding (~33px) schluckt Überlauf zusätzlich, deshalb
  schmale Viewports (320px) mitprüfen, sonst hat der Test keinen Biss.
- 2026-08-24 · Knip/QM-Gates — `knip` exit 1 mit nur „Configuration hints" (knip.json
  ignore-/entry-Vorschläge) ist pre-existing Rot auf main, kein Fix-Ziel der Phase. → Vor
  jedem „Reparieren"-Abstecher Gegenprobe per `git stash` + knip + `git stash pop`.
- 2026-08-24 · KoliBri/ESLint-Guard — TAG-Selektor `kol-icon` kollidiert mit dem #824-Guard-Regex
  `^(kol-icon|kolicon-…)` (meint die interne Shadow-DOM-Klasse, nicht den Host-Tag) → `eslint-disable-next-line
  no-restricted-syntax` mit Begründung statt Selektor-Verrenkung. Außerdem: `KolIcon` hat `_label` als
  Pflicht-Property; `_label=""` ist der dekorative Modus (aria-hidden + role=presentation).
- 2026-08-24 · Shell/Scripts — `--flag) X="$2"; shift 2` crasht unter `set -u` bei wert-losem
  Flag (unbound $2) UND bash shifft bei `shift 2` mit <2 Rest-Argumenten nichts → Endlosschleife.
  → `[ $# -ge 2 ] || die_usage` VOR dem Zugriff; gh `--paginate`-Output (konkatenierte
  JSON-Arrays) via `jq -s 'add // []'` zu einem Array flattening.
- 2026-08-24 · node:test — `it()`-Optionen (`{skip: …}`) werden synchron bei der REGISTRIERUNG
  ausgewertet; Flags, die ein `before`-Hook setzt, sind dort garantiert noch false → der Test ist
  IMMER geskippt, auch in CI (grüner Job maskiert das: Skips zählen nicht als Fail). → Skip
  dynamisch per `t.skip(reason)` im Test-Body; `{skip}`-Option nur mit Modul-Level-Flag.
- 2026-08-24 · Bash/gh-PR-Body — `gh pr create --body "…"` mit Klammern im Text lässt bash `(` als
  Subshell-Start parsen → `syntax error near unexpected token '('`, exit 2 (gleiche Ursache wie der
  Workflow-Quoting-Eintrag vom 08-19, hier im interaktiven Bash-Tool). → Body per `Write` in Datei
  legen und `gh pr create --body-file <pfad>` nutzen.
- 2026-08-25 · E2E/Shadow-Fokus — Fokus in KoliBri-Shadow-DOM nicht per
  `document.activeElement === el` prüfen (pierct kein Shadow Root, dauerhaft falsch-negativ)
  UND nicht per eigener `.shadowRoot.activeElement`-Kette (#824-ESLint-Guard schlägt an) →
  Playwrights `expect(locator).toBeFocused({timeout:150})` im try/catch als Poll nutzen; es
  pierct nativ und lintet grün.
- 2026-08-25 · Git/Mutationsprobe — nach sed-Mutationsprobe NICHT mit `git checkout -- <file>`
  aufräumen: das verwirft die eigene (ungesicherte) Änderung mit. → Vorher `cp` nach /tmp,
  Zurückkopieren statt checkout.
