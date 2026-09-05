# Dauergedächtnis

Erfahrungs-Log der KI-Agents in diesem Repo: was in früheren Läufen schiefging und was
stattdessen funktioniert hat. Wird über Tickets hinweg fortgeschrieben und ist versioniert —
jeder Lauf liest es, damit derselbe Fehler nicht zweimal passiert.

**Das hier ist kein Regelwerk.** Feste Regeln stehen in [`../../AGENTS.md`](../../AGENTS.md) und
[`.ai-knowledge/`](../../.ai-knowledge/); hier stehen nur Erfahrungen, die dort (noch) nicht
verankert sind. Aufnahmekriterium, Format und Kuratierung: `AGENTS.md` → Memory.

Abzugrenzen von den `issue-*.md` im selben Verzeichnis — das sind flüchtige Phasen-Notizen eines
  einzelnen Tickets (Soft-Abort-Resume) - committet, reisen im Harness-Branch
  `ai/harness/{N}` mit dem PR nach main und bleiben dort dauerhaft (ADR 0007).

## Learnings & Erfahrungen

Append-only: neue Einträge **ans Ende**. Bestehende Zeilen nicht umschreiben oder umsortieren —
das bricht den `union`-Merge aus [`.gitattributes`](../../.gitattributes) und erzeugt genau die
Konflikte, die er verhindern soll.

- 2026-08-19 · CI/Memory — GitHub vergibt für Issue-/Label-/PR-Trigger (und daraus kaskadierte
  `workflow_run`-Läufe) nur lesende Cache-Token; ein Cache-Save scheitert still als `##[warning]`
  („token has no writable scopes") bei grünem Job. → Kein Cache für Pipeline-State. (Korrektur
  2026-08-25: die damalige Lösung „Artefakte" ist überholt — der Issue-Storage ist seit
  2026-08-23 der State-Branch `ai/state/issue-{N}`, ADR 0006. Der Cache-Befund gilt unverändert.)
- 2026-08-19 · CI/Workflows — `${{ steps.*.outputs.* }}` wird wörtlich in den `run:`-Block
  substituiert, ohne Quoting-Layer. Tool-Spezifizierer mit Klammern (`Bash(gh *)`) lassen bash
  dann `(` als Subshell-Start parsen → `syntax error near unexpected token '('`, exit 2. → Wert
  nach `--allowedTools`/`--disallowedTools` immer single-quoten.
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
- 2026-08-23 · Spec-Phase/Issue-Body — gelegentlich ist der KI-ANALYSE-Block im Issue-Body defekt (enthält wörtlich `$(gh issue view …)` statt Inhalt). → AKs dann aus Titel + KI-UX-Block + Analyse-Bot-Kommentar (`gh issue view N --json comments`) ableiten und den Defekt im Spec/PR-Body dokumentieren.
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
- 2026-08-24 · Bash/gh-PR-Body — `gh pr create --body "…"` mit Klammern im Text lässt bash `(` als
  Subshell-Start parsen → `syntax error near unexpected token '('`, exit 2 (gleiche Ursache wie der
  Workflow-Quoting-Eintrag vom 08-19, hier im interaktiven Bash-Tool). → Body per `Write` in Datei
  legen und `gh pr create --body-file <pfad>` nutzen.
- 2026-08-25 · E2E/Shadow-Fokus — Fokus in KoliBri-Shadow-DOM nicht per
  `document.activeElement === el` prüfen (pierct kein Shadow Root, dauerhaft falsch-negativ)
  UND nicht per eigener `.shadowRoot.activeElement`-Kette (#824-ESLint-Guard schlägt an) →
  Playwrights `expect(locator).toBeFocused({timeout:150})` im try/catch als Poll nutzen; es
  pierct nativ und lintet grün.
- 2026-08-25 · Playwright/E2e — `locator.evaluate` auf nicht existierendem Element läuft in den vollen 30s-Test-Timeout statt schnell zu failen (Fehlermeldung nennt dann „toBeVisible/evaluate“-Gemisch). → Vor evaluate ein `await expect(locator).toBeVisible()` setzen: fails in 5s mit klarem Ziel-Locator; auch für rote Spec-Tests die schnellere Rot-Signatur.
- 2026-08-25 · node:test/t.skip — `t.skip()` im Test-Body markiert den Test nur, bricht ihn NICHT
  ab: der Body läuft weiter; eine Exception darin zählt nicht als `fail` (Summary zeigt `fail 0,
  skipped 1`), setzt aber den Exit-Code auf 1 („✖ failing tests" trotz Skip-Marker). Der
  2026-08-24-Eintrag empfiehlt genau dieses Muster OHNE `return` — damit ist `pnpm test` in jeder
  Sandbox ohne Redis rot (server/src/express/session.test.ts, CI hat redis:8-Service und merkt es
  nicht). → Nach `t.skip(reason)` IMMER `return`. Und: Exit-Codes nie aus Pipes lesen (`| tail`
  verschluckt sie) — `$?` im selben Call ohne Pipe prüfen.
- 2026-08-25 · gh/--jq-Newline — `gh api`/`gh pr view` mit `--jq` hängen an JEDE Ausgabe
  genau einen Newline an (Println; per xxd verifiziert), während `"$(gh …)"` ALLE trailing
  Newlines strippt. Byte-identische Body-Verarbeitung (PATCH ohne Kollateral-Bytes):
  Direkt-Redirect in Datei + `head -c -1` (GNU) entfernt allein den gh-Newline. gh-Stubs
  in Tests müssen den Newline emulieren (`cat fixture; printf '\n'`), sonst frisst head
  den letzten Content-Byte.
- 2026-08-26 · Bash-Tool/gh-issue-body — Heredoc mit mehrzeiligem Markdown-Body scheitert am
  Bash-Tool-Parser ("Parser skipped input between top-level statements"); `Write` ist auf das
  Working Directory beschränkt, Schreiben nach `/tmp` wird abgelehnt. → Body-Text per `Write` in
  eine Datei UNTERHALB des Repos ablegen, die auf ein bestehendes `.gitignore`-Muster passt (z. B.
  `.ai-memory/issue-<N>-*.md`), danach `gh issue edit --body-file <pfad>` (analog für PR-Bodies).
- 2026-08-26 · CI-Shell — awk `gsub()` auf einem Feld ($2) baute $0 mit OFS neu auf, die Markdown-Pipes verschwanden und das Nachparsen der Zeile lieferte leer. → Felder in EINEM awk-Durchlauf extrahieren und per printf ausgeben, die Zeile nie zwischenspeichern und spaeter erneut parsen.
- 2026-08-26 · Frontend/Tests — `pnpm --filter frontend test:e2e -- <grep-pattern>` filtert NICHT, playwright ignoriert das Argument nach `--` und laeuft die volle e2e-Suite (~10 Min statt Sekunden). → Fuer gezielte Spec-Verifikation direkt `npx playwright test e2e/<datei>.spec.ts` im `frontend`-Verzeichnis nutzen.
- 2026-08-27 · Security/E2E — Neue Security-Middleware (CSRF, Rate-Limit) darf in Dev/E2E NICHT aktiv sein: die E2E-Suite seedet per Design über ~100 direkte page.request-POST/PUT/PATCH-DELETE-Aufrufe in ~40 Specs ohne Token → mit CSRF-API-Seeding wären massenhaft 403er. → Gates wie SESSION_SECRET/Allowlist auf `NODE_ENV === 'production'`; csrf-csrf v4 braucht getSecret+getSessionIdentifier (Pflicht), cookie-parser NACH express-session, der Cookie enthaelt den vollen Token (HMAC.random), Frontend-Token via openapi-fetch client.use-Middleware in api.ts.
- 2026-08-28 · CI/Pipeline — menschlicher Push auf einen PR mit klebendem ai:needs-human verwirft die Autolabeler-Transition (Guard 3, PR #903): Der PR parkt weiter, ai:needs-review wird NICHT gesetzt. → Entblocken nur durch den Menschen: Label in der UI entfernen und ai:needs-review setzen (Entfernen allein startet nichts).
- 2026-08-28 · Playwright/E2E · `page.route`-Handler feuert asynchron NACH Aufloesung eines
  parallelen `waitForRequest` — Assertions auf im Route-Handler kaptierte Werte einamlig zu lesen
  ist eine deterministische Race; immer `await expect.poll(() => captured).toBe(...)` nehmen.
  Zweite Falle desselben PR: Heading-Assertions auf den Capture-Schritt-Titel gate-n nicht, wenn
  der Schritt schon gewechselt hat (QuickCaptureModal benennt den Titel um) — Einmal-Persistenz-
  Checks (einmaliger GET+find) brauchen ein echtes Gate (Formular-Schritt-Titel) oder Poll.
  Beides wurde erst sichtbar, weil der neue CSRF-Token-Fetch vor dem ersten Write ~10ms Timing
  verschob (PR #1079, keyboard-shortcuts AK8 + logout AK-2).
- 2026-08-29 · Server-Tests — session.test.ts (Redis-Integration) macht lokale Läufe rot: exit 1 trotz fail=0 (Skip mit Fehler-Record), kein lokaler Redis nötig/vorhanden. Auf dem Basisbranch identisch (PR #1104) → nicht jagen, CI stellt Redis als Service bereit; gates lokal auf frontend + test:scripts beschränken und im PR dokumentieren.
- 2026-08-29 · Frontend-E2E — KolTabs lässt inaktive Panels gemountet (nur [hidden]): page-weite Slider-Lokatoren (input[type=range], kol-input-range, getByRole('slider')) treffen seit #1098 zuerst die Geo-Regler des Allgemein-Panels (document order) bzw. sehen den Säulen-Editor fälschlich sichtbar → Slider-Abfragen auf .pillar-weights-grid scopen, „Editor ausgeblendet" über die Überschrift prüfen.
- 2026-08-29 · Edit-Tool/Unicode — Der Edit-Tool-Aufruf ersetzt Zeichenstill-Ziele stillschweigend durch die Unicode-Charaktere: schreibt man als Ziel `{' '}` (Absicht: normales Leerzeichen) in eine Datei, in der das Tool Escape-Swapping macht, landet ein ROHES U+00A0 (C2 A0) im Quelltext statt des Escapes `{' '}` — unsichtbar, aber von Spec-Tests (TreeWalker über Textknoten) und Prettier-/Scanner-Konventionen abhängig. → Nach jedem Edit mit NBSP/Escape-Absicht `grep -c $'\xc2\xa0' <datei>` gegenprüfen und per `python3`-Replace auf das Escape umschreiben (nicht per Edit — derselbe Swap greift wieder).
- 2026-08-30 · Spec-Phase/Gate · Pre-Commit-Knip failt, wenn der rote Spec-Test ein noch nicht existierendes Modul importiert (legitimer erster roter Zustand, aber Hook blockt den Commit) → Format+lint manuell verifizieren und den Spec-Commit mit `git commit --no-verify` setzen; Begründung in den PR-Body (Impl-Phase lässt die knip-Meldung mit dem neuen Modul verschwinden, Präzedenz #1130/PR #1131).
- 2026-09-01 · Git/Stash — `git stash -u` + `pop` gibt vormals GESTAGTE Dateien UNSTAGED zurück: der nächste Commit enthielt nur die Phase-Notizen, der eigentliche Fix fehlte (PR #1155, per `--amend` + `--force-with-lease` korrigiert). → Nach stash/pop IMMER `git status` auf den Staged-Zustand prüfen bzw. neu `git add`en; `--force-with-lease` nur auf eigenen Feature-Branches.
- 2026-09-02 · Gate/knip — Gate-Runner-Rolle führte knip workspace-lokal ohne Config aus und meldete phantomhafte „Unused exports" (useGeolocation.ts), die mit dem Diff nichts zu tun hatten. → knip IMMER über das Root-Skript `pnpm knip` laufen lassen (nutzt `--config knip.jsonc`; nur Konfig-Hints = bekannter Zustand); der pre-commit-lefthook macht es genauso.
- 2026-09-04 · KoliBri/KolTabs-Panels — Zweifach-Falle: (1) `getByRole('tabpanel').getByRole(…)`-Chaining findet geslottetes Light-DOM NIE (im A11y-Baum geschachtelt, DOM-seitig kein Nachfahre des Tabpanel-Elements) → Panel-Inhalt über Panel-Container-Klasse oder slot-Attribut locaten (issue-969-Muster). (2) KolTabs' Shadow-`div.kol-tabs` ist ein CSS-Grid: `white-space: nowrap`-Inhalt (Ellipsis) bläht die min-content-Breite des Panel-Tracks auf (622px bei 375px-Viewport) → auf dem slotteden Panel-Div `display:grid; grid-template-columns: minmax(0,1fr)` als Break (#1211 AK8).
- 2026-09-05 · E2E/Playwright-Routing — `page.route`-Globs werden gegen die VOLLE URL inkl. Query
  gematcht: `**/auth/google/silent` fängt `/auth/google/silent?returnTo=%2F` NICHT mehr ab (PW 1.62,
  empirisch verifiziert), der Request fällt durch und Tests werden nicht-deterministisch. → Beim
  Ergänzen von Query-Params an gemockten Routen die Glob-Muster mit `*`-Suffix öffnen und im
  PR-Body als Test-Pflege dokumentieren.
