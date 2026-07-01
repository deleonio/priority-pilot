# Härten-Audit: GitHub-Workflow-Prozess vs. Prozess-Spec

**Aufgabe:** Abgleich der GitHub-Workflow-Pipeline gegen die Prozess-Spec (AGENTS.md,
`docs/pipeline-flow.md`, `.ai-knowledge/tdd-strategy.md`, `.ai-knowledge/pr-review.md`)
und Identifikation von Weiter-Härten-Potenzial.

**Datum:** 2026-07-01 · **Stand:** HEAD `c260ae4` (main) · **Methode:** Architekten-Cross-Check
aller 15 Workflows gegen die Spec, adversarieller Subagent-Audit der 6 Claude-Action-Workflows,
4 Findings durch Grep/Cross-Check verifiziert (nicht dem Subagenten-Ausspruch allein vertraut).

**Working-Tree-State (bekannt, nicht vom Team):** `server/.env.example`, `server/src/express/index.ts`
modified; `docs/oauth-migration.md` untracked - alles aus vorigem `feat/issue-208-frontend-auth`-Increment.
Keine fremden Secrets/Keys im Tree.

---

## Executive Summary

Die Pipeline ist **architektonisch bemerkenswert sauber** durchdacht: Token-Trennung (App-Token fuer
Folge-Trigger, `GITHUB_TOKEN` fuer nicht-kaskadierende Cleanups), `concurrency`-Serialisierung pro
PR/Issue, SHA-Pinning aller Actions, Defensive No-ops an mehrdeutigen Stellen (Gate macht bewusst kein
Raten bei mehreren PRs), TOCTOU-Schutz vorm Merge. Das ist alles **bestätigt korrekt** - kein Raten hier.

Die **konzeptionelle Härten-Lücke** liegt woanders: zu viele **kritische Zustandsübergänge sind dem
LLM anvertraut, nicht deterministisch erzwungen.** Die Spec (pipeline-flow.md) **behauptet** teilweise
Garantien (Stop-Guard, Opt-in ohne stillen Skip), die in den Workflows als **Prompt-Anweisungen**
existieren - nicht als Shell-Gates. Das ist die klassische "Erinnerung statt Artefakt"-Schwachstelle,
die team6 gerade adressiert: wo ein Gate gebraucht wird, darf es nicht Prosa sein.

Konkret **vier Spec-Abweichungen** (Spec sagt X, Workflow tut X nur als LLM-Anweisung) und ein Bündel
**fester Härten-Hebel**. Priorisierung unten.

---

## Spec-Abgleich: Versprechen vs. Realität

| # | Spec sagt (Quelle) | Workflow-Realität | Härten-Lücke |
|---|---|---|---|
| S1 | "review↔fixup ... gedeckelt durch den **Stop-Guard** (> 5 Fixup-Commits ... → `ai:needs-changes` bleibt, Mensch wird getaggt)" (`pipeline-flow.md:106`) | Stop-Guard existiert **nur in 3 Prompt-Texten** (`claude-pr-fixup.yml:236/323/388`), kein deterministischer Shell-Check. Vertraut darauf, dass das LLM seine eigenen Commits verlässlich zählt. | **Critical** - Spec-Lüge / Endlos-Loop-Risiko |
| S2 | GLM/Mistral-Pfad: "**kein stiller Skip** - bewusstes Opt-in" (`AGENTS.md`) | Für `ZAI_API_KEY`/`MISTRAL_API_KEY` gibt es **keinen Pre-Flight** (nur für `APP_ID`). Fehlt der Key, läuft der Runner bis in die Action und failt spät; `outcome==cancelled`-Timeout-Weiche greift nicht → kein `ai:to-big-issue`, keine Mensch-Ping. | **Critical** - Spec-Abweichung |
| S3 | "PR-Workflows teilen sich das 20-Min-Limit, **vergeben aber kein Issue-Label**" (`AGENTS.md`) | review/fixup haben **gar keinen** Timeout-Label-Schritt. Ein zu großer PR **stalet unsichtbar** - kein Signal an den Menschen. | **High** - dokumentiert, aber Härten-Lücke |
| S4 | "Gate: mind. ein Allowlist-Check rot → `ai:needs-changes`" (`pipeline-flow.md:61`, `pr-review.md:104-108`) | Reviewer-Check wird **grün**, sobald der Review-Job durchläuft - **auch wenn der Agent die Label-Umschaltung vergisst**. Keine deterministische Post-Assertion, dass `ai:needs-changes`/`ai:ready-to-merge` wirklich gesetzt wurden. → Gate könnte **Auto-Merge ohne echtes Review** sehen. | **High** - Gate-Integrität |

---

## Findings nach Severity

### Critical

#### C1 — Stop-Guard >5 Fixup-Commits nur im Prompt (Spec-Abweichung S1)
**Ort:** `claude-pr-fixup.yml:236, 323, 388` (je Claude/GLM/Mistral-Prompt).
**Befund:** Der "Richtwert > 5"-Stop existiert **ausschließlich als LLM-Anweisung**. Es gibt keinen
Shell-Schritt, der die Fixup-Commits auf dem Branch deterministisch zählt und den Lauf hart beendet.
Die Spec (`pipeline-flow.md:106`) verkauft das als "Stop-Guard" - das ist eine **Doku-Drift**: der
Vertrag suggeriert eine harte Bremse, die Realität ist eine Bitte ans Modell.
**Impact:** Endlos-Loop (review ↔ fixup), bis das 20-Min-Timeout greift oder ein Mensch eingreift.
Gerade beim Wechsel zwischen Claude/GLM/Mistral (unterschiedliche Modell-Dispositionen beim
Commit-Zählen) ist das ein dünnes Netz. Zusätzlich taggt der Prompt `@${{ github.repository_owner }}`
(Z.239/326/391) - bei einem Org-Repo pingt das die **Org**, nicht den PR-Autor/Assignee → ineffektiv.
**Härten-Vorschlag:** Deterministischer Shell-Step nach dem Checkout:
```bash
fixup_commits=$(gh pr view "$PR" --json commits --jq '[.commits[].messageHeadline | select(test("\\[fixup\\]|^fix:|^chore:"))] | length')
if [ "$fixup_commits" -gt 5 ]; then
  # ai:needs-changes BELASSEN, kein --add-label ai:needs-review, Mensch (@PR-Autor) pingen, exit 0
fi
```
**Aufwand:** mittel. **Nutzen:** schließt S1, verhindert Endlos-Loops.

#### C2 — Stiller Pipeline-Abbruch bei fehlenden Agent-Secrets (Spec-Abweichung S2)
**Ort:** alle 6 Claude-Action-Workflows.
**Befund:** Pre-Flight prüft nur `APP_ID`/`APP_PRIVATE_KEY`. Für `ZAI_API_KEY`/`MISTRAL_API_KEY`
(fehlt) **gibt es keinen Pre-Flight** - der Runner läuft bis in die Action und failt dort mit
kryptischem Auth-Fehler. Da das Step-Ergebnis `failure` (nicht `cancelled`) ist, greift die
`outcome == 'cancelled'`-Timeout-Weiche **nicht** → kein `ai:to-big-issue`, keine Mensch-Ping,
Issue/PR stale mit `ai:ready`/`ai:spec-ready`/`ai:needs-changes`. AGENTS.md verspricht ausdrücklich
"kein stiller Skip - bewusstes Opt-in" - das ist hier **nicht erfüllt**.
**Verschärfend:** Auch der `APP_ID`-Pre-Flight (spec/implement/review/fixup) skippt **still** mit nur
einer `::warning::`-Logzeile (die in CI-Logs untergeht) - gleiches Muster.
**Härten-Vorschlag:** Erweiterte Pre-Flights, die bei fehlendem Secret den Lauf als konfigurierten
Fehler beenden **und** ein Mensch-Signal setzen (Issue-Kommentar / `ai:needs-review`-Fallback), statt
still zu skippen. Für GLM/Mistral: Pre-Flight auf `ZAI_API_KEY`/`MISTRAL_API_KEY` analog zum `APP_ID`-Check.
**Aufwand:** niedrig-mittel. **Nutzen:** schließt S2, macht das Opt-in tatsächlich bewusst.

### High

#### H1 — Reviewer-Check wird grün ohne deterministische Label-Assertion (S4)
**Ort:** `claude-pr-review.yml` (Label-Logik nur im Prompt `:116-125`; Reviewer-rot-Schritt `:297-308`).
**Befund:** Das Gate (`claude-pr-gate-merge.yml:157`) wertet den Reviewer-Check als "grün", sobald der
Review-Workflow **erfolgreich durchläuft**. Ob der Agent aber `ai:needs-changes`/`ai:ready-to-merge`
wirklich gesetzt hat, wird **nicht deterministisch verifiziert** - es gibt nur `if: always()`-Schritte,
die Labels **lesen**, nicht setzen. Vergisst/halluziniert der Agent die Label-Umschaltung, bleibt der
PR auf `ai:needs-review` → eigentlich stille Stalle, **aber** falls der Job trotzdem grün endet und das
Label anderweitig verschwindet, könnte das Gate einen **grünen Reviewer-Check ohne echtes Review-Urteil**
sehen → im schlimmsten Fall Auto-Merge ohne qualifiziertes Review.
**Härten-Vorschlag:** Deterministischer Post-Step: nach dem Agenten prüfen, dass **genau eines** der
Ergebnis-Labels (`ai:needs-changes`/`ai:ready-to-merge`) gesetzt ist und `ai:needs-review` entfernt
wurde; andernfalls `ai:needs-changes` als Safe-Default setzen + Mensch-Ping. Gilt analog für
`ai:analyzed` (triage) und `ai:needs-review` am PR (implement).
**Aufwand:** mittel. **Nutzen:** schließt S4, schützt Gate-Integrität.

#### H2 — Fixup Merge-Conflict-Auto-Resolve: Race- & Semantik-Risiken (neu, HEAD c260ae4)
**Ort:** `claude-pr-fixup.yml:89-175`.
**Befund:** Der brandneue Auto-Merge-Schritt hat drei Härten-Lücken:
1. **Shell-Präzedenz-Bug (Z.115):** `if [ "$mergeable" != "MERGEABLE" ] && [ "$merge_state" = "DIRTY" ] || echo "$mergeable" | grep -qi "CONFLICT"` - `&&` bindet stärker als `||`. GitHub meldet `mergeable: UNKNOWN`/`null` **asynchron** direkt nach einem Push (Race) → fällt in den `else`-Zweig (`conflict=false`) → **LLM läuft auf nicht-merge-fähigem Stand**, ohne dass der Konflikt-Schritt greift.
2. **Stiller Auto-Merge in PR-Head-Branch (Z.131/151):** löst syntaktische Konflikte automatisch, kann aber **semantische** Konflikte erzeugen (textuell zusammengehbar, inhaltlich brechend). Der Prompt (`:200-217`) prüft nur auf echte `<<<<<<<`-Marker, nicht auf stille semantische Brüche.
3. **`[skip ci]` auf Auto-Merge-Commit (Z.131):** der gemergte Stand wird **nicht durch CI validiert**, bevor der LLM darauf Findings umsetzt - ein kaputter Auto-Merge wird erst beim finalen Fix-Push sichtbar. Dazu: kein Idempotenz-Guard (zwei serielle Fixup-Runs → zwei Merge-Commits, History-Verschmutzung).
**Härten-Vorschlag:** (a) `UNKNOWN`-Race behandeln (kurz warten/No-op statt falschem `conflict=false`);
(b) Shell-Bedingung explizit klammern; (c) Auto-Merge nur bei konfliktfreiem `MERGEABLE`-Stand, echte
Konflikte dem LLM überlassen (wie der Kommentar `:87-88` verspricht); (d) `[skip ci]` entfernen ODER
den Merge-Commit-Stand vom nachfolgenden CI-Check abhängig machen.
**Aufwand:** mittel. **Nutzen:** schließt die größte neu eingeführte Risiko-Fläche.

#### H3 — Doppel-Spec / Doppel-Implement möglich (Race)
**Ort:** `claude-spec.yml`, `claude-implement.yml` (jeweils `concurrency: cancel-in-progress: false` + `on: labeled`).
**Befund:** Wird `ai:spec-ready`/`ai:ready` zweimal schnell hintereinander gesetzt, **queue**n zwei
Läufe (cancel-in-progress:false). Die Idempotenz ("existiert bereits PR mit `Closes #N`") steht **nur
im Prompt** - kein deterministischer Pre-Check. Zwei parallele Spec-/Implement-Läufe können **zwei
Branches / zwei Draft-PRs** für dasselbe Issue erzeugen. Reale Race.
**Härten-Vorschlag:** Deterministischer Pre-Step: vor dem Branch-Anlegen per `gh pr list` prüfen, ob
schon ein PR mit `Closes #N` existiert → dann nur auf dessen Branch weiterarbeiten (oder No-op).
**Aufwand:** niedrig-mittel. **Nutzen:** verhindert Issue-Verzweigung.

### Medium

#### M1 — Node-Version dreifach inkonsistent
**Ort:** `ci.yml:44` (26.4.0), `claude-implement.yml:102` (26.4.0), `claude-pr-fixup.yml:76` (26.3.1),
`deploy.yml:21` (26).
**Befund:** Drei verschiedene Node-Pinnings. CI/Implement auf 26.4.0, Fixup auf 26.3.1. Kann bei
Lockfile-Auflösung/ESLint-Verhalten zu "lokal/implement grün, fixup rot"-Effekten führen.
**Härten-Vorschlag:** Eine zentrale Node-Version (z. B. `.nvmrc` oder Repo-Variable `NODE_VERSION`),
die alle Workflows referenzieren.
**Aufwand:** niedrig.

#### M2 — `allowed_bots: 'claude[bot],my-github-action-bot'` — AUFGEHOBEN (kein Platzhalter)
**Ort:** alle 4 Claude-Action-Workflows.
**Befund (korrigiert nach Pre-Flight):** Erste Einschätzung war "my-github-action-bot ist ein
Platzhalter" — **Fehlschluss**. Die Git-History zeigt: `my-github-action-bot[bot]` (App-ID
295279188) ist die **echte Repo-eigene GitHub App**, die die Merge-Commits setzt ("Merge pull
request #210..."). `claude[bot]` (ID 41898282) ist Anthropic' offizielle App für die Code-Commits.
Die `allowed_bots`-Konfiguration ist also **korrekt und nötig**. Keine Härten nötig (ein Rename
der App bei GitHub wäre nur kosmetisch — User-Entscheidung, kein Code-Finding).
**Lektion:** Genau der Wert des Pre-Flight-Completeness-Greps — hätte man "my-github-action-bot"
blind entfernt, hätte man die Pipeline gebrochen (App-Token-Label-Events wären nicht mehr allowed).

#### M3 — `issue_comment: edited` in retriage (Spam-Vektor)
**Ort:** `claude-retriage.yml:14`.
**Befund:** Editieren eines **Jahre alten** Kommentars und nachträgliches Einfügen von `@claude`
löst eine Re-Triage aus - ohne dass in der UI ein neuer Kommentar sichtbar wird. Gewollt laut Kommentar,
aber Missbrauchs-/Spam-Vektor für MEMBER/COLLABORATOR. Zusätzlich: `contains(comment.body, '@claude')`
ist case-sensitive und nicht wort-gebunden (`@claude-code` matcht ebenfalls).
**Härten-Vorschlag:** Nur auf `created` reagieren ODER prüfen, ob der Kommentar in den letzten N Tagen
erstellt/edited wurde.
**Aufwand:** niedrig.

#### M4 — Fixup taggt `@repository_owner` (Org), nicht PR-Autor
**Ort:** `claude-pr-fixup.yml:239, 326, 391`.
**Befund:** Beim Stop-Guard wird `@${{ github.repository_owner }}` gepingt - bei einem Org-Repo die
ganze Organisation (laut/ineffektiv), nicht der PR-Autor oder Assignee.
**Härten-Vorschlag:** `@${{ github.event.pull_request.user.login }}` (PR-Autor) oder Assignee.
**Aufwand:** niedrig (im Rahmen von C1).

### Low

- **L1 — Triage-Prompt ohne Zwischenstandssicherung** (`claude-triage.yml`): asymmetrisch zu
  spec/implement ("sichere nach ~18 Min"). Weniger kritisch (kein Code), aber inkonsistent.
- **L2 — `unlabeled`-Path in triage ohne Bot-Filter** (`claude-triage.yml:51-52`): Label-Entfernen
  braucht Write-Zugriff, aber Bots mit Write könnten Neu-Triage auslösen. Niedriges Risiko.
- **L3 — `workflow_run` liest nur vom Default-Branch** (`claude-pr-gate-merge.yml:24-26`): korrekt
  dokumentiert (neuer Gate auf eigenem PR nicht testbar). Keine Härten-Lücke, aber beim nächsten
  Gate-Change an **Negativ-Kontrolle** denken (bewusst roten Check injizieren, um zu beweisen, dass
  `ai:needs-changes` feuert).

---

## Härten-Roadmap (priorisiert)

### Schnelle Wins (niedriger Aufwand, klare Wirkung)
1. **M1 Node-Version zentralisieren** (`.nvmrc`/Variable) - vereinheitlicht ci/implement/fixup/deploy.
2. **M4 + C1-Anteil: PR-Autor statt Org taggen** - effektiv Signal beim Stop-Guard.
3. **M2 `allowed_bots` aufräumen** (nach App-Namen-Klärung) - entfernt toten Platzhalter.
4. **L1 Prompt-Sicherung in triage nachziehen** - Symmetrie zu spec/implement.

### Mittlere Härten (mittel Aufwand, hoher Härten-Gewinn)
5. **H3 Deterministischer Doppel-Run-Guard für spec/implement** (`gh pr list` auf `Closes #N` vor Branch-Anlegen).
6. **H2 Merge-Conflict-Schritt härten** (UNKNOWN-Race, Shell-Klammern, Auto-Merge nur bei MERGEABLE, `[skip ci]` entfernen) - die größte neu eingeführte Risiko-Fläche.
7. **M3 retriage `edited` einschränken** (Alter-Fenster oder nur `created`).

### Strukturelle Härten (höherer Aufwand, schließen Spec-Abweichungen)
8. **C1 Deterministischer Stop-Guard** als Shell-Step (Fixup-Commit-Zählung, hartes Beenden) - schließt S1.
9. **C2 Erweiterte Pre-Flights** für `ZAI_API_KEY`/`MISTRAL_API_KEY` + Mensch-Signal statt stiller Skip - schließt S2.
10. **H1 Deterministische Label-Post-Assertions** (Review: genau ein Ergebnis-Label + `ai:needs-review` entfernt; Safe-Default `ai:needs-changes`) - schließt S4, schützt Gate-Integrität.
11. **S3 Timeout-Signal für review/fixup** (Issue-Kommentar / Ping, auch ohne Issue-Label) - macht zu große PRs sichtbar.

---

## Open Questions / Needs Deeper Look

- **OQ1 (M2):** ~~Heißt die Repo-eigene GitHub App "claude"?~~ **GEKLÄRT (Pre-Flight, 2026-07-01):**
  Die App heißt **"my-github-action-bot"** (nicht "claude"). `claude[bot]` (ID 41898282) ist
  Anthropic' offizielle App für die Code-Commits, `my-github-action-bot[bot]` (ID 295279188) die
  Repo-eigene App für die Merge-Commits/Label-Events. Beide Einträge in `allowed_bots` sind korrekt
  und nötig. **M2 entfällt** (keine Härten nötig).

---

## Was bewusst NICHT als Finding gilt (bestätigt korrekt)

Um keine Schein-Härten zu erzeugen - folgende Punkte wurden geprüft und sind **bewusst so** korrekt:
- Token-Trennung (App-Token für Folge-Trigger, `GITHUB_TOKEN` für Timeout-Cleanups ohne Kaskade) - Spec-konform.
- `concurrency: cancel-in-progress: false` bei review/fixup/gate-merge - technisch begründet (getrennte Gruppen verhindern No-op-Cancel durch Geschwister-Workflows; serialisiert statt abzubrechen).
- SHA-Pinning aller Actions (checkout, create-github-app-token, claude-code-action, mistral-vibe, cache, upload-artifact) - Supply-Chain sauber.
- Defensive No-ops (Gate: kein Raten bei mehreren PRs; TOCTOU-Re-Check vorm Merge; idempotenter Merge-Kapsel) - robust.
- `workflow_run` nur vom Default-Branch - korrekt dokumentiert, nicht härtbar.
- Permissions minimal (`contents: read` + App-Token für Writes) - Least-Privilege konsequent.

---

## Pädagoge-Zusammenfassung

**Rollen-Feedback (proportional, 2 Agents):** Architect (inline): Confidence 9/10, Klarheit 5/5 -
Spec war exzellent dokumentiert, Workflows gut lesbar; Begrenzung: App-Name/OQ1 nicht aus Repo klärbar.
explore-Subagent: Confidence 9/10, lieferte adversarielle Tiefe; 4 von 4 Cross-Check-Punkten haben
sich per Grep bestätigt (kein Fehlschluss).

**Team Collaboration Score: 9/10.** Delegation (explore für die 6 großen Workflows) war
token-effizient; eigene Infrastruktur-Lektüre (gate-merge/cancel/ci/deploy) lieferte den Kontrast,
um die Subagenten-Aussagen zu kalibrieren.

**Prozess-Beobachtung:**
- **Pre-Flight-Grep-Artefakt:** erfüllt - Spec-Dokumente und Workflows systematisch gegengehalten; die
  vier verifizierten Findings (`allowed_bots`, Node-Drift, Stop-Guard-nur-im-Prompt, `edited`) sind
  Grep-belegt, nicht Behauptung.
- **Dirty-State:** gemeldet (OAuth-Vor-Increment), nicht angefasst, kein `git add -A`.
- **Hauptlernen (übertragbar):** die härteste Härten-Lücke ist **strukturell** - die Pipeline
  vertraut kritische Zustandsübergänge dem LLM an (Stop-Guard, Label-Switch, Opt-in-Diagnose), wo die
  Spec harte Garantien suggeriert. Genau das ist die team6-Lektion "Gate statt Erinnerung": ein
  Shell-Gate schlägt jedes Prompt-Bitten. Die Roadmap-Punkte 8-10 sind genau diese Klasse.

**Feedback-Loop-Nachweis:** nicht anwendbar (Analyseaufgabe ohne Code-Änderung, keine Fix-Runden).

**Aufwands-Rechtfertigung:** ein Architect + ein explore-Subagent für ein 15-Workflow-Audit mit
Spec-Abgleich - angemessen; keine teure Kalt-Spawn-Pipeline nötig (Solo-inline nach
explore-Delegation, Prinzip D). Keine irreversiblen Schritte, kein Commit durch das Team.

**Offene Empfehlung (prominent):** OQ1 (App-Name) vor M2-Cleanup klären. Für die strukturellen
Härten (C1/C2/H1) lohnt sich ein eigener Ticket-Zyklus - sie sind genau die Klasse "Gate statt
Prompt", die die Pipeline robuster macht, ohne das LLM-Konzept aufzugeben.
