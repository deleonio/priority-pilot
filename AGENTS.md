# Agent Instructions

Zentrale Anweisungen für KI-Agents in diesem Repo. Die ausführliche, **werkzeug-unabhängige**
Wissensbasis liegt in [`.ai-knowledge/`](.ai-knowledge/).

## Wissensbasis

- [Projekt & Aufbau](.ai-knowledge/project.md) — Zweck, Monorepo, Befehle, Datenbank
- [Konventionen](.ai-knowledge/conventions.md) — Formatierung, ESLint, TypeScript, Commits
- [Ticket-Triage](.ai-knowledge/ticket-triage.md) — Analyse offener GitHub-Issues
- [Ticket-Spec](.ai-knowledge/ticket-spec.md) — rote Tests (Vertrag) für `ai:spec-ready`-Issues schreiben
- [Ticket-Umsetzung](.ai-knowledge/ticket-implementation.md) — freigegebene Issues (`ai:ready`) umsetzen
- [PR-Review (Kreuzverhör)](.ai-knowledge/pr-review.md) — Pull Requests kritisch prüfen, Findings kommentieren
- [TDD-Strategie](.ai-knowledge/tdd-strategy.md) — test-getriebene KI-Workflows (Stufen 1+2+3 adoptiert: AK-first + Red-Green + Spec-Gate)
- [Deployment](docs/deployment.md) — Release-Build (GitHub Actions), Tarball, Host-Layout, systemd, Caddy, Rollback
- [Deployment: Repo-Plan](docs/deployment-repo-plan.md) — was im Repo zu bauen ist (Pack-Skript, Release-Workflow, Secrets)
- [Deployment: Server-Setup](docs/server-setup.md) — Schritt-für-Schritt-Einrichtung des Linux-Servers

## Kernregeln

- Monorepo mit **pnpm**.
- Formatieren: `pnpm format` (Prettier, eine zentrale Config im Root).
- Linten: `pnpm lint`.
- Bevorzugt gezielt statt repo-weit prüfen: `pnpm --filter priority-pilot build|lint`.
- TypeScript `strict`, ESM überall, Node `>=26`.
- Nicht automatisch committen ohne ausdrücklichen Wunsch.
- Alle Pull Requests müssen `pnpm format` und `pnpm lint` ausführen und die Ergebnisse in der
  PR-Beschreibung dokumentieren.

## KI-Agent: Claude (Standard) oder Mistral Vibe

Alle KI-Workflows (Triage, Re-Triage, Umsetzung, PR-Review, PR-Fixup) laufen wahlweise mit
**Claude Code** (Standard) oder **Mistral Vibe** — gesteuert über die Repository-Variable
**`AI_AGENT`**:

- nicht gesetzt **oder** `claude` → Claude Code (`anthropics/claude-code-action`, Secret
  `CLAUDE_CODE_OAUTH_TOKEN`).
- `mistral` → Mistral Vibe (`mistralai/mistral-vibe`, Secret **`MISTRAL_API_KEY`** nötig).

Umschalten (gilt sofort für **alle** KI-Workflows, keine Datei-Änderung nötig):

```bash
gh variable set AI_AGENT --body mistral   # auf Mistral Vibe
gh variable set AI_AGENT --body claude     # zurück auf Claude (oder Variable löschen)
```

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

Statt jeden KI-Workflow fest auf `claude-opus-4-8` zu verkabeln **oder** eine zweite, vorgeschaltete
`claude-code-action` nur zur Modell-Klassifikation zu starten, startet jeder Workflow **genau eine**
Session deterministisch auf **`claude-sonnet-4-6`** (`--effort medium`). Dieser Sonnet-Lauf ist der
**Koordinator**: Er schätzt die Komplexität selbst ein und delegiert die eigentliche Abarbeitung per
**Agent-Tool** (`Task` in `--allowedTools`) an einen **Subagenten in derselben Session** — gleicher
Checkout, erhaltener Kontext, **kein** zweiter Action-Lauf. Die Subagenten sind in
[`.claude/agents/`](.claude/agents/) definiert und koppeln Modell an Komplexität:

- [`light`](.claude/agents/light.md) → **`model: haiku`** — trivial / mechanisch (Abstufung).
- _(Koordinator selbst)_ → **`claude-sonnet-4-6`** — Standardaufgabe.
- [`heavy`](.claude/agents/heavy.md) → **`model: opus`** — komplex / architektonisch (Eskalation).

**Sichere Defaults:** Schätzt der Koordinator die Aufgabe als Standard ein, erledigt er sie selbst auf
**Sonnet** — es gibt also keinen separaten Klassifikations-Schritt mehr, der scheitern könnte. Ist
Opus über die Organisations-`availableModels`-Allowlist gesperrt, fällt der `heavy`-Subagent
automatisch auf das geerbte Sonnet-Modell zurück. Das harte `timeout-minutes: 20` jedes Workflows
bleibt davon **unberührt**.

**Warum kein JS-„Router" mehr:** Der frühere Ansatz (`.github/actions/model-router`, #149/#150/#153)
startete pro Workflow eine **zweite** `claude-code-action` nur für ein Token (`haiku|sonnet|opus`).
Dieser ungeschützte Vorschritt riss bei jedem transienten Fehler den ganzen Lauf ab, bevor echte
Arbeit lief — die Hauptursache der Unzuverlässigkeit. Die Subagent-Delegation erreicht dasselbe Ziel
(Sonnet entscheidet, Haiku/Opus führen aus) mit **einem** Lauf und **ohne** CI-JavaScript.

**Mistral-Pfad: nicht betroffen.** Die Delegation greift ausschließlich auf dem Claude-Pfad. Steht
`AI_AGENT=mistral`, kennt die Vibe-Action weder `--model` noch Claude-Subagenten — das Modell kommt
dort allein aus `~/.vibe/config.toml`.

## Ticket-Triage

Offene Issues **ohne** Label `ai:analyzed` analysieren (aus Titel + Beschreibung + Repo eine
Lösung konzipieren) → Beschreibung **lektorieren** (Form verbessern, Inhalt unverändert) → **Titel**
auf Konsistenz zur lektorierten Beschreibung/zum Ziel prüfen und bei Bedarf **inhaltlich treu
optimieren** (kein Edit „pro forma", keine Titel-Drift) → zu große Tickets in verknüpfte
**Sub-Issues** zerlegen (max. eine Ebene, Rekursionsschutz via `ai:analyzed`)
→ deutscher Lösungs-Kommentar mit prüfbaren **Akzeptanzkriterien + Testfällen** und
Umsetzbarkeits-**Ampel** (🟢/🟡/🔴) → Label `ai:analyzed` setzen
(**bei klarer Analyse 🟢 zusätzlich `ai:spec-ready`** → die Spec-Stufe schreibt rote Tests und gibt
per `ai:ready` frei; bei 🟡/🔴 nicht).
Liegt bereits eine Analyse vor, wird sie auf Passung/Vollständigkeit geprüft und bei Bedarf
aktualisiert (Re-Triage). Vollständiger Ablauf:
[.ai-knowledge/ticket-triage.md](.ai-knowledge/ticket-triage.md).
Konkreter Command: `/triage-ticket` (analysiert, lektoriert, optimiert den Titel, zerlegt,
kommentiert und markiert in einem Durchlauf).

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

In **GitHub Actions** läuft das über **Labels** (stabiles Ping-Pong statt Event-Kaskaden): Der
Umsetzungs-Workflow labelt den PR mit `ai:needs-review`;
[`claude-pr-review.yml`](.github/workflows/claude-pr-review.yml) reviewt ihn und setzt
`ai:needs-changes` (Findings) bzw. `ai:ready-to-merge` (🟢);
[`claude-pr-fixup.yml`](.github/workflows/claude-pr-fixup.yml) arbeitet `ai:needs-changes` ab und
schaltet zurück auf `ai:needs-review` — bis 🟢. Diese Workflows nutzen ein GitHub-App-Token
(Secrets `APP_ID` + `APP_PRIVATE_KEY`), damit die Label-Wechsel die Folge-Workflows auslösen.

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
