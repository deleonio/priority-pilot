# Agent Instructions

Zentrale Anweisungen für KI-Agents in diesem Repo. Die ausführliche, **werkzeug-unabhängige**
Wissensbasis liegt in [`.ai-knowledge/`](.ai-knowledge/).

## Wissensbasis

- [Projekt & Aufbau](.ai-knowledge/project.md) — Zweck, Monorepo, Befehle, Datenbank
- [Konventionen](.ai-knowledge/conventions.md) — Formatierung, ESLint, TypeScript, Commits, Mobile-First
- [Ticket-Triage](.ai-knowledge/ticket-triage.md) — Analyse offener GitHub-Issues
- [Ticket-Spec](.ai-knowledge/ticket-spec.md) — rote Tests (Vertrag) für `ai:spec-ready`-Issues schreiben
- [Ticket-Umsetzung](.ai-knowledge/ticket-implementation.md) — freigegebene Issues (`ai:ready`) umsetzen
- [PR-Review (Kreuzverhör)](.ai-knowledge/pr-review.md) — Pull Requests kritisch prüfen, Findings kommentieren
- [TDD-Strategie](.ai-knowledge/tdd-strategy.md) — test-getriebene KI-Workflows (Stufen 1+2+3 adoptiert: AK-first + Red-Green + Spec-Gate)
- [Subagent-Ausführungsvertrag](.ai-knowledge/subagent-contract.md) — Vertrag für per Modell-Delegation gestartete Subagenten (`.claude/agents/`)
- [Kreuzverhör-Haltung](.ai-knowledge/kreuzverhoer-haltung.md) — Methode des adversarialen Hinterfragens (Chat-Trigger + PR-Review)
- [Deployment](docs/deployment.md) — Release-Build (GitHub Actions), Tarball, Host-Layout, systemd, Caddy, Rollback
- [Deployment: Repo-Plan](docs/deployment-repo-plan.md) — was im Repo zu bauen ist (Pack-Skript, Release-Workflow, Secrets)
- [Deployment: Server-Setup](docs/server-setup.md) — Schritt-für-Schritt-Einrichtung des Linux-Servers

## Kernregeln

- Monorepo mit **pnpm**.
- Formatieren: `pnpm format` (Prettier, eine zentrale Config im Root).
- Linten: `pnpm lint`.
- Bevorzugt gezielt statt repo-weit prüfen: `pnpm --filter priority-pilot build|lint`.
- TypeScript `strict`, ESM überall, Node `>=26`.
- Nicht automatisch committen ohne ausdrücklichen Wunsch. **Dokumentierte Ausnahme:** die
  Ticket-Workflows [`/spec-ticket`](.ai-knowledge/ticket-spec.md) und
  [`/implement-ticket`](.ai-knowledge/ticket-implementation.md) committen, pushen und
  erstellen/aktualisieren PRs als **ausdrücklichen Teil ihres Auftrags** — das gilt nur für diese
  beiden Workflows, nicht als allgemeine Erlaubnis.
- Alle Pull Requests müssen `pnpm format`, `pnpm lint` **und `pnpm test`** ausführen (Tests grün ist
  Pflicht, siehe [TDD-Strategie](.ai-knowledge/tdd-strategy.md) Stufe 2) und die Ergebnisse in der
  PR-Beschreibung dokumentieren.

## KI-Agent: Claude (Standard), GLM (Z.ai) oder Mistral Vibe

Alle KI-Workflows (Triage, Re-Triage, Umsetzung, PR-Review, PR-Fixup) laufen wahlweise mit
**Claude Code** (Standard), **GLM über Z.ai** oder **Mistral Vibe** — gesteuert über die
Repository-Variable **`AI_AGENT`**:

- nicht gesetzt **oder** `claude` → Claude Code (`anthropics/claude-code-action`, Secret
  `CLAUDE_CODE_OAUTH_TOKEN`).
- `glm` → GLM über Z.ai (`anthropics/claude-code-action` + Z.ai-Endpoint, Secret **`ZAI_API_KEY`**
  nötig). Nutzt denselben Anthropic-kompatiblen Endpoint von Z.ai — kein Proxy erforderlich.
- `mistral` → Mistral Vibe (`mistralai/mistral-vibe`, Secret **`MISTRAL_API_KEY`** nötig).

Umschalten (gilt sofort für **alle** KI-Workflows, keine Datei-Änderung nötig):

```bash
gh variable set AI_AGENT --body glm       # auf GLM (Z.ai)
gh variable set AI_AGENT --body mistral   # auf Mistral Vibe
gh variable set AI_AGENT --body claude     # zurück auf Claude (oder Variable löschen)
```

**Voraussetzung GLM-Pfad:** Repo-Secret `ZAI_API_KEY` (API-Key von
<https://api.z.ai> — Coding Plan). Steht `AI_AGENT=glm`, fehlt aber der Key, schlägt der
GLM-Schritt fehl (kein stiller Skip — bewusstes Opt-in wie beim Mistral-Pfad).

**Merkmale des GLM-Pfads:**

- **Gleiche Action wie Claude:** Der GLM-Pfad nutzt ebenfalls `anthropics/claude-code-action`,
  aber mit `anthropic_api_key` statt `claude_code_oauth_token` und den Env-Variablen
  `ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic` sowie
  `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` (kein Telemetry zu Anthropic).
- **Automatisches Modell-Mapping:** Z.ai mappt Claude-Modellnamen (z. B. `claude-sonnet-4-6`)
  transparent auf GLM-Modelle — kein hartkodiertes Modell-Mapping nötig oder gewünscht (würde
  automatische Updates auf neuere Modelle verhindern).
- **Subagent-Delegation unverändert:** Prompts und `claude_args` sind identisch zum Claude-Pfad;
  die Subagent-Delegation (Sonnet-Koordinator → `heavy`/`light`) funktioniert auf dem GLM-Pfad
  wie auf dem Claude-Pfad.
- **Längeres API-Timeout:** `API_TIMEOUT_MS=3000000` (50 Min intern, GitHub-Limit bleibt 20 Min).

**Voraussetzung Mistral-Pfad:** Repo-Secret `MISTRAL_API_KEY` (aus <https://console.mistral.ai>,
separat vom Server-LLM-Key). Steht `AI_AGENT=mistral`, fehlt aber der Key, schlägt der Vibe-Schritt
fehl (kein stiller Skip — der Mistral-Pfad ist ein bewusstes Opt-in).

**Bewusste Unterschiede / Grenzen des Mistral-Pfads** (die Vibe-Action reicht keine Extra-Flags
wie `--model`/`--allowedTools`/`--append-system-prompt` durch):

- **Auto-Approve erzwungen:** Headless ohne Approval-Callback würde Vibe jedes
  genehmigungspflichtige Tool als „Tool execution not permitted" überspringen. Ein Vorab-Schritt
  schreibt daher `~/.vibe/config.toml` mit `default_agent = "auto-approve"` /
  `bypass_tool_permissions = true`. Folge: Der Mistral-Pfad läuft mit **vollem Tool-Zugriff** — die
  enge `--allowedTools`-Restriktion des Claude-Pfads ist hier **nicht erzwingbar**; die Grenzen
  setzt der Prompt (z. B. „committe keinen Produktivcode", im Review „ändere keinen Code").
- **Modell:** nicht pro Workflow wählbar; Vibe nutzt sein Default-Modell. Pinnen ginge über
  `~/.vibe/config.toml` (`active_model`). Die **Subagent-Modell-Delegation** (s. u.) ist auf dem
  Mistral-Pfad **nicht betroffen** — die Vibe-Action reicht kein `--model`-Flag durch und kennt keine
  Claude-Subagenten; das Modell kommt allein aus `~/.vibe/config.toml`.
- **System-Prompt:** wird als führender `[KONTEXT/REGELN]`-Block in den `prompt` gefaltet.
- **Keine `session_id`/`--resume`** in der Job-Summary. Das harte 20-Min-Timeout
  (`ai:to-big-issue`) greift unverändert über `timeout-minutes` + Schritt-`outcome`.

Der Canceller `claude-pr-cancel.yml` ist agent-unabhängig (reiner `gh`-Aufruf) und unverändert.

### Modell-Wahl per Subagent-Delegation (Claude-Pfad)

Statt jeden KI-Workflow fest auf ein Modell zu verkabeln **oder** eine zweite, vorgeschaltete
`claude-code-action` nur zur Modell-Klassifikation zu starten, startet jeder Workflow **genau eine**
Session. Für die Modell-Wahl gilt dabei:

**Ausnahme — Triage & Re-Triage laufen fest auf Opus max:** `claude-triage.yml` und
`claude-retriage.yml` starten die Session deterministisch auf **`claude-opus-4-8`** mit
**`--effort max`** (tiefstes Reasoning). Die Triage-Analyse ist die Grundlage aller Folgestufen
(Spec → Implement) — hier ist bewusst das stärkste Modell ohne Koordinator-Delegation verdrahtet,
damit die Analyse optimal ausfällt. Nur triviale mechanische Nebenschritte dürfen an `light`
(Haiku) delegiert werden; eine `heavy`-Eskalation entfällt, da die Session bereits auf Opus läuft.

**Alle übrigen Claude-Workflows** (Spec, Implement, PR-Review, PR-Fixup) starten deterministisch auf
**`claude-sonnet-4-6`** (`--effort medium`). Dieser Sonnet-Lauf ist der
**Koordinator**: Er schätzt die Komplexität selbst ein und delegiert die eigentliche Abarbeitung per
**Agent-Tool** (`Task` in `--allowedTools`) an einen **Subagenten in derselben Session** — gleicher
Checkout, erhaltener Kontext, **kein** zweiter Action-Lauf. Die Subagenten sind in
[`.claude/agents/`](.claude/agents/) definiert und koppeln Modell an Komplexität:

- [`light`](.claude/agents/light.md) → **`model: haiku`** — trivial / mechanisch (Abstufung).
- _(Koordinator selbst)_ → **`claude-sonnet-4-6`** — Standardaufgabe.
- [`heavy`](.claude/agents/heavy.md) → **`model: opus`** — komplex / architektonisch (Eskalation).

Beide Subagent-Definitionen verweisen für den eigentlichen Ausführungsvertrag (Scope-Disziplin,
Ergebnis-Übergabe, Eskalation) nur auf [subagent-contract.md](.ai-knowledge/subagent-contract.md) —
das ist die einzige Stelle, an der dieser Vertrag gepflegt wird.

**Sichere Defaults:** Schätzt der Koordinator die Aufgabe als Standard ein, erledigt er sie selbst auf
**Sonnet** — es gibt also keinen separaten Klassifikations-Schritt mehr, der scheitern könnte. Ist
Opus über die Organisations-`availableModels`-Allowlist gesperrt, fällt der `heavy`-Subagent
automatisch auf das geerbte Sonnet-Modell zurück. (Achtung: Für die **fest** auf Opus verdrahteten
Triage-/Re-Triage-Sessions gibt es diesen Fallback nicht — eine Opus-Sperre lässt diese Läufe
fehlschlagen.) Das harte `timeout-minutes: 20` jedes Workflows bleibt davon **unberührt**.

**Warum kein JS-„Router" mehr:** Der frühere Ansatz (`.github/actions/model-router`, #149/#150/#153)
startete pro Workflow eine **zweite** `claude-code-action` nur für ein Token (`haiku|sonnet|opus`).
Dieser ungeschützte Vorschritt riss bei jedem transienten Fehler den ganzen Lauf ab, bevor echte
Arbeit lief — die Hauptursache der Unzuverlässigkeit. Die Subagent-Delegation erreicht dasselbe Ziel
(Sonnet entscheidet, Haiku/Opus führen aus) mit **einem** Lauf und **ohne** CI-JavaScript.

**Mistral-Pfad: nicht betroffen.** Die Delegation greift ausschließlich auf dem Claude- und
GLM-Pfad. Steht `AI_AGENT=mistral`, kennt die Vibe-Action weder `--model` noch Claude-Subagenten —
das Modell kommt dort allein aus `~/.vibe/config.toml`.

## Ticket-Triage

Offene Issues **ohne** Label `ai:analyzed` analysieren (aus Titel + Beschreibung + Repo eine
Lösung konzipieren) → Beschreibung **lektorieren** (Form verbessern, Inhalt unverändert) → **Titel**
auf Konsistenz zur lektorierten Beschreibung/zum Ziel prüfen und bei Bedarf **inhaltlich treu
optimieren** (kein Edit „pro forma", keine Titel-Drift) → zu große Tickets in verknüpfte
**Sub-Issues** zerlegen (max. eine Ebene, Rekursionsschutz via `ai:analyzed`)
→ die Analyse mit prüfbaren **Akzeptanzkriterien + Testfällen** und Umsetzbarkeits-**Ampel**
(🟢/🟡/🔴) in einen markierten **Body-Block** der Beschreibung schreiben
(`<!-- KI-ANALYSE:START stand=… -->` … `<!-- KI-ANALYSE:END -->`, bei jeder (Re-)Triage **in-place
ersetzt** — statt eines angehängten Kommentars) + **einen kurzen Ping-Kommentar** als
Benachrichtigung (bei offenen Fragen mit `@author`) → Label `ai:analyzed` setzen
(**bei klarer Analyse 🟢 zusätzlich `ai:spec-ready`** → die Spec-Stufe schreibt rote Tests und gibt
per `ai:ready` frei; bei 🟡/🔴 nicht).
Liegt bereits eine Analyse vor (Body-Block), wird beim **Re-Triage** nur das **Delta** der Kommentare
seit dem `stand` gelesen (nicht der ganze Thread), der Block auf Passung/Vollständigkeit geprüft und
bei Bedarf in-place aktualisiert. Vollständiger Ablauf:
[.ai-knowledge/ticket-triage.md](.ai-knowledge/ticket-triage.md).
Konkreter Command: `/triage-ticket` (analysiert, lektoriert, optimiert den Titel, zerlegt, schreibt
die Analyse in die Beschreibung, pingt und markiert in einem Durchlauf).

Eine **Re-Triage** lässt sich auch per **Issue-Kommentar mit `@claude`** anstoßen: Die
GitHub-Action [`.github/workflows/claude-retriage.yml`](.github/workflows/claude-retriage.yml) ruft
den Triage-Ablauf automatisch für genau dieses eine Issue auf (nur bei Kommentaren von Personen mit
Schreibzugriff).

In **GitHub Actions** wird die Triage zusätzlich **ereignisgesteuert** angestoßen —
[`.github/workflows/claude-triage.yml`](.github/workflows/claude-triage.yml) ruft den Triage-Ablauf
automatisch für genau dieses eine Issue auf, sobald ein **Issue angelegt** wird (nur von Personen mit
Schreibzugriff, damit Außenstehende den OAuth-Token-Lauf nicht auslösen) oder das Label
**`ai:analyzed` entfernt** wird (erzwingt eine Neu-Analyse, z. B. nach geänderter Beschreibung).

## Ticket-Spec (rote Tests vor der Umsetzung)

Issues mit Label `ai:spec-ready` (von der Triage bei 🟢 gesetzt) bekommen **vor** der Umsetzung ihre
**roten Tests** — die ausführbare Spezifikation. Ein eigener Lauf legt einen Branch an, schreibt je
Akzeptanzkriterium echte, **fehlschlagende** Tests (keinen Produktivcode), eröffnet einen
**Draft-PR** (`Closes #<nr>`) und gibt das Issue per `ai:ready` (statt `ai:spec-ready`) zur Umsetzung
frei. Das ist die **Gewaltenteilung** der TDD-Strategie (Stufe 3): Wer die Tests schreibt, schreibt
**nicht** den Code — die Umsetzung macht die Tests grün, ohne sie zu ändern. Vollständiger Ablauf:
[.ai-knowledge/ticket-spec.md](.ai-knowledge/ticket-spec.md). Konkreter Command: `/spec-ticket`.

In **GitHub Actions** stößt das Setzen von `ai:spec-ready` (bei vorhandenem `ai:analyzed`) die Spec
automatisch an — [`.github/workflows/claude-spec.yml`](.github/workflows/claude-spec.yml) (eigener
headless Lauf, getrennt von der Umsetzung → Gewaltenteilung gilt auch in der Automatik).

## Ticket-Umsetzung

Offene Issues mit Label `ai:ready` (von der Spec-Stufe nach den roten Tests gesetzt, ersatzweise vom
Menschen), die **nicht zugewiesen** sind: sich selbst zuweisen → den **Draft-PR der Spec-Stufe
aufgreifen** und dessen rote Tests **grün machen, ohne sie zu ändern** (Fallback ohne Spec-PR: Tests
selbst test-getrieben zuerst schreiben) → `pnpm format` + Lint + `pnpm test` → den Draft-PR
**review-bereit** machen (Fallback: PR neu erstellen), via `Closes #<nr>` mit dem
Ticket verknüpft (erscheint im „Development"-Bereich, schließt es beim Merge) → **PR verfolgen**
(abonnieren) und im **Kreuzverhör-Loop** in Runden kritisch prüfen (`/kreuzverhoer-review`) und
nachbessern **sowie automatisch auf eingehende Review-Anmerkungen reagieren** (zutreffende Findings
fixen, mehrdeutige rückfragen, sonst begründet kommentieren), **bis das Urteil 🟢 ist und keine
Anmerkung mehr offen** ist (nach max. 3 Runden mit offenen Punkten den Menschen entscheiden lassen);
die Verfolgung läuft weiter bis **Merge/Schließen**. Vollständiger Ablauf:
[.ai-knowledge/ticket-implementation.md](.ai-knowledge/ticket-implementation.md).
Konkreter Command: `/implement-ticket`.

In **GitHub Actions** stößt das Setzen des Labels `ai:ready` (bei vorhandenem `ai:analyzed`) die
Umsetzung automatisch an —
[`.github/workflows/claude-implement.yml`](.github/workflows/claude-implement.yml) (Schritte 1–4; den
Kreuzverhör-Review übernimmt ein eigener Workflow). Claude Code läuft dabei direkt im Runner mit
einem **harten Zeitlimit von `timeout-minutes: 20`**; der Prompt weist Claude an, bei drohendem
Limit (~18 Min) rechtzeitig den Zwischenstand zu sichern (committen/pushen, ggf. Draft-PR), statt
einen vollen Durchlauf zu erzwingen.

Läuft ein Issue-Job (Umsetzung, Spec, Triage, Re-Triage) dennoch in den 20-Minuten-Timeout, ist das
Issue zu groß für einen Lauf: Der Job setzt am Issue das Label **`ai:to-big-issue`** (und die
Umsetzung entfernt zusätzlich `ai:ready`, die Spec `ai:spec-ready`, damit es nicht erneut
aufgegriffen wird) — als Kandidat zum
**Aufteilen** in Sub-Issues (Triage-Schritt „Zerlegen"). Die PR-Workflows (Review/Fixup) teilen sich
dasselbe 20-Minuten-Limit, vergeben aber kein Issue-Label.

Label-Kette: `ai:analyzed` (analysiert) → `ai:spec-ready` (bei 🟢 — Spec-Stufe schreibt rote Tests)
→ `ai:ready` (freigegeben — von der Spec-Stufe gesetzt, ersatzweise vom Menschen) → Umsetzung macht
die Tests grün (Draft-PR → PR ready to review), der den Kreuzverhör-Loop (`/kreuzverhoer-review`)
durchläuft und bis Merge/Schließen verfolgt wird.

## PR-Review (Kreuzverhör)

Implementierte Pull Requests werden **kritisch wie im Kreuzverhör** geprüft: Titel/Beschreibung und
**vollständigen Diff** lesen → kritische Fragen stellen (Löst der PR das Problem? Edge Cases?
einfachster Weg? Performance/Security?) → Code-Qualität prüfen (Benennung, Testabdeckung,
Projekt-Konventionen) → je Finding einen an Datei/Zeile **verankerten** Review-Kommentar (Was,
warum, konkreter Vorschlag) → abschließendes Urteil mit Umsetzbarkeits-**Ampel** (🟢/🟡/🔴). Kein
formales Approve/Request-Changes — der Merge bleibt beim Menschen. Vollständiger Ablauf:
[.ai-knowledge/pr-review.md](.ai-knowledge/pr-review.md).
Konkreter Command: `/kreuzverhoer-review`.

### Aufrufpfade

Der Kreuzverhoer-Agent wird auf drei Wegen aufgerufen:

1. **Chat/REPL (interaktiv):** Trigger-Phrasen aktivieren den Agenten direkt in Claude Code:
   „Kreuzverhör", „nimm das auseinander", „stress-teste das", „challenge mich".
2. **Slash-Command:** `/kreuzverhoer-review [PR-Nummer]` — führt das Review eines konkreten PRs
   im Session-Modell des Aufrufers durch.
3. **GitHub Actions (automatisch):** `claude-pr-review.yml` feuert, wenn ein PR das Label
   `ai:needs-review` trägt — Sonnet-Koordinator, der an `heavy`/`light` delegiert.

In **GitHub Actions** läuft das über **Labels** (stabiles Ping-Pong statt Event-Kaskaden): Der
Umsetzungs-Workflow labelt den PR mit `ai:needs-review`;
[`claude-pr-review.yml`](.github/workflows/claude-pr-review.yml) reviewt ihn und setzt
`ai:needs-changes` (Findings) bzw. `ai:ready-to-merge` (🟢);
[`claude-pr-fixup.yml`](.github/workflows/claude-pr-fixup.yml) arbeitet `ai:needs-changes` ab und
schaltet zurück auf `ai:needs-review` — bis 🟢. Diese Workflows nutzen ein GitHub-App-Token
(Secrets `APP_ID` + `APP_PRIVATE_KEY`), damit die Label-Wechsel die Folge-Workflows auslösen.

Den **vollständigen Label-getriebenen Ticket-Flow** (Issue → Spec → Implement → Review ↔ Fixup →
Gate/Auto-Merge) als Diagramm samt Label-Referenz: [docs/pipeline-flow.md](docs/pipeline-flow.md).

Die im Review entstehenden Kommentare werden vom Umsetzungs-Workflow (`/implement-ticket`,
Schritt 5) im **Kreuzverhör-Loop** abgearbeitet — der den PR zusätzlich **abonniert und automatisch
auf eingehende Review-Anmerkungen reagiert**: zutreffende Punkte fixen, mehrdeutige rückfragen, sonst
begründet kommentieren — danach erneut kreuzverhören, bis nichts mehr offen ist (Verfolgung bis
Merge/Schließen).

## Tests (Server)

`pnpm --filter priority-pilot test` — Node.js `node:test` + `tsx`, In-Memory-SQLite, alle Testdateien unter `server/src/**/*.test.ts`.

## Tests (Frontend)

`pnpm --filter frontend test` — Vitest + jsdom + Testing Library, Testdateien unter `frontend/src/**/*.test.tsx`.

`pnpm --filter frontend test:e2e` — Playwright-E2E (nur Chromium), Specs unter `frontend/e2e/`.
**Funktionale** Specs gegen das **echte** Backend (`smoke.spec.ts`, `crud.spec.ts` —
anlegen/bearbeiten/löschen + Säulen-Gewicht; Playwright startet Backend mit temporärer In-Memory-DB +
Vite, `crud.spec.ts` räumt in `afterEach` über die API auf). Es wird nicht via `page.route` gemockt.

Die E2E-Specs laufen **nicht** als Teil von `pnpm -r test` bzw. `pnpm --filter frontend test`
(Vitest schließt `e2e/` aus), sondern ausschließlich separat über `test:e2e` (benötigen die
installierten Playwright-Browser).
