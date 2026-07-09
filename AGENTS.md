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
- [Workflow-Tool: Kosten-Reporting](docs/workflow-tool-costs.md) — Snippet für Token-/USD-EUR-Schätzung am Ende eines Claude-Code-Workflow-Skripts
- [CI-Kosten-Zusammenfassung](docs/ci-cost-summary.md) — Token-/USD-EUR-Schätzung je GitHub-Actions-Lauf der KI-Pipeline (`.github/actions/cost-summary`)

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

## KI-Agent: Claude Code

Alle KI-Workflows (Triage, Re-Triage, Umsetzung, PR-Review, PR-Fixup) laufen fest auf
**Claude Code** (`anthropics/claude-code-action`, Secret `CLAUDE_CODE_OAUTH_TOKEN`).

### Kolibri MCP-Server für Frontend-Implementierung

Für die Umsetzung von Frontend-Komponenten steht den KI-Agenten der **KoliBri MCP-Server** zur
Verfügung, der Zugriff auf 200+ KoliBri-Komponenten-Beispiele, Szenarien und Dokumentation bietet.

**Remote HTTP Server (empfohlen, zero installation):**

- URL: `https://public-ui-kolibri-mcp.vercel.app/mcp`
- Typ: `http` (StreamableHTTP Transport)

**Verfügbare Tools:**

- `hello_kolibri` — Testverbindung und Server-Metadaten
- `search` — Suche nach KoliBri-Komponenten (Samples, Szenarien, Dokumente)
- `fetch` — Hole spezifisches Beispiel/Dokument per ID

**Verfügbare Resources:**

- `kolibri://info` — Informationen über verfügbare Samples
- `kolibri://best-practices` — Wichtige Richtlinien für KoliBri Web Components

**Nutzung im Workflow:**

Die KI-Agenten sollen den MCP-Server aktiv nutzen, um:

1. Passende Komponenten-Beispiele für die Umsetzung zu finden
2. Best Practices und Integrationsrichtlinien zu prüfen
3. Code-Beispiele direkt in die Implementierung zu übernehmen
4. Validierung und Barrierefreiheits-Anforderungen zu verstehen

**Beispiel-Anfrage an den MCP-Server:**

```
@kolibri Zeige mir Beispiele für die Umsetzung eines Button mit Icon
@kolibri Wie integriere ich KoliBri Web Components richtig?
@kolibri Suche nach Table-Komponenten mit Paginierung
```

**Konfiguration:**

- Claude Code: `.claude/settings.json` (MCP-Server in Git committed)
- Mistral Vibe: `.vibe/config.toml` (MCP-Server in Git committed)
- Lokale Entwicklung: `kolibri-mcp` CLI oder Remote-URL verwenden

**Hinweis für GitHub Actions (CI):**
Die Workflows laufen im `--bare`-Modus, in dem MCP-Server standardmäßig deaktiviert sind. Um den
KoliBri MCP-Server in CI zu nutzen, müssen die Workflows angepasst werden:

**Option A (empfohlen):** MCP-Server direkt per CLI-Flag in den Workflow-Arguments angeben:

```yaml
claude_args: >-
  --model claude-sonnet-4-6 --effort medium
  --mcp https://public-ui-kolibri-mcp.vercel.app/mcp
  ...
```

**Option B:** Den `--bare`-Flag aus den Workflows entfernen (verliert Startgeschwindigkeitsvorteil).

Derzeit sind die Workflows im Bare-Modus konfiguriert — eine Anpassung ist für MCP-Nutzung in CI
notwendig. Lokale Entwicklung und Nicht-CI-Läufe nutzen die Konfiguration aus `settings.json` bzw.
`config.toml`.

**Remote-Server:** Immer aktuell, keine Installation erforderlich.
**Offline-Nutzung:** Server lokal installieren: `npx @public-ui/mcp` oder `npm install -g @public-ui/mcp`.

**Logging:** Für Debugging kann `MCP_LOGGING=true` gesetzt werden (Logs gehen nach stderr). GLM (Z.ai) und
Mistral Vibe waren als alternative Agent-Pfade über die Repo-Variable `AI_AGENT` waehlbar und wurden
am 2026-07-08 ersatzlos entfernt (M11, `.ai-knowledge/workflow-optimization-plan.md`) — die drei
Pfade brachten keine Laufzeit-/Tokenersparnis (nur einer lief je Lauf), aber realen
Wartungs-/Drift-Aufwand ueber bis zu drei Prompt-Kopien je Datei.

Der Canceller `claude-pr-cancel.yml` ist reiner `gh`-Aufruf und unverändert.

### Optionales Backend: z.ai statt Anthropic (Issue #403)

Seit M11 gibt es bewusst nur **einen** Agent-Pfad (Claude Code). Wer trotzdem GLM (Z.ai) fahren will,
startet keinen zweiten Pfad, sondern lenkt Claude Codes API-Calls um — gesteuert pro Lauf über das
Label **`ai:use-zai`**:

- **Default (kein Label):** Claude-Code läuft gegen **Anthropic** via OAuth
  (`CLAUDE_CODE_OAUTH_TOKEN`). Nichts ändert sich.
- **Label `ai:use-zai` am Issue:** die Composite-Action
  [`configure-ai-backend`](.github/actions/configure-ai-backend/action.yml) leitet den Lauf auf den
  Anthropic-kompatiblen **z.ai**-Endpoint (`https://api.z.ai/api/anthropic`) um. Auth wechselt auf
  `ANTHROPIC_AUTH_TOKEN` (Bearer, aus dem Secret **`ZAI_API_KEY`**), das das OAuth-Token sauber
  out-rankt. Die Alias-Map (`ANTHROPIC_DEFAULT_OPUS_MODEL=glm-5.1` u. a.) greift für die
  Subagent-Delegation (`heavy`=opus, `light`=haiku).
- **Ein Label steuert die ganze Pipeline:** Issue-Stufen (Triage/Spec/Implement) lesen die Labels des
  Issues; PR-Stufen (Review/Fixup) lesen die Labels des PR **zusätzlich** zu denen des verlinkten
  Issues (`Closes #N`). Fail-open: ist nichts auflösbar, gilt der Claude-Default.

Vollständige `--model`-IDs (`claude-opus-4-8`, `claude-sonnet-4-6`) verlassen Claude Code **literal**
und vertrauen auf z.ai serverseitiges Mapping (Entscheidung Endpoint-only, Issue #403). Lehnt z.ai
einen Modellnamen ab, ist der dokumentierte Fallback, `--model` zu parametrisieren (Follow-up).

### Modell-Wahl per Subagent-Delegation (Claude-Pfad)

Statt jeden KI-Workflow fest auf ein Modell zu verkabeln **oder** eine zweite, vorgeschaltete
`claude-code-action` nur zur Modell-Klassifikation zu starten, startet jeder Workflow **genau eine**
Session. Für die Modell-Wahl gilt dabei:

**Ausnahme — Triage & Re-Triage laufen fest auf Opus, Effort abhängig vom Auslöser:**
`claude-triage.yml` (deckt BEIDE Trigger — Issue-Anlegen/Label-Entfernen UND `@claude`-Kommentar —
in einem Workflow ab) startet die Session deterministisch auf **`claude-opus-4-8`**, ohne
Koordinator-Delegation. Die **Reasoning-Tiefe unterscheidet sich per Trigger** (`--effort
${{ github.event_name == 'issue_comment' && 'high' || 'max' }}`, M3): Die **Erst-Analyse**
(`issues`-Event: Issue angelegt/Label entfernt) läuft auf **`--effort max`** — sie ist die
kontextlose Wurzel, die Spec → Implement → Review → Fixup speist, hier zählt maximale
Analysequalität am meisten. Eine **Re-Triage** (`issue_comment`-Event, `@claude`-Kommentar) läuft
auf **`--effort high`** — dort ist bereits ein Mensch mit Korrektur-Kontext aktiv, der
Grenznutzen von `max` gegenüber `high` ist geringer. Nur triviale mechanische Nebenschritte dürfen
an `light` (Haiku) delegiert werden; eine `heavy`-Eskalation entfällt, da die Session bereits auf
Opus läuft.

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

### Bare-Modus (--bare) für alle Workflows

**Alle fünf Claude-Workflows** (Triage, Spec, Implement, PR-Review, PR-Fixup) nutzen standardmäßig den
`--bare`-Flag der Claude-Code-CLI. Dies bewirkt:

- **Bis zu 10x schnellerer Start:** Keine Suche nach lokalen Konfigurationen, Hooks oder Plugins
- **Erzwungene Verwendung von Umgebungsvariablen:** Blockiert den automatischen OAuth-Login von Anthropic,
  sodass Claude Code **ausschließlich** die gesetzten Variablen (`ANTHROPIC_BASE_URL`, `ANTHROPIC_API_KEY`)
  verwendet — entscheidend für Drittanbieter wie **z.ai/DeepSeek** (siehe Issue #403)
- **Reiner Fokus:** Nur Kernwerkzeuge verfügbar (Bash, Read, Edit, Write); MCP-Server, Skills und
  Plugins sind deaktiviert → deterministisches, reproduzierbares Verhalten

Dies ist besonders in CI/CD-Umgebungen wie GitHub Actions essenziell: schneller Start, sauberes
Verhalten ohne "Hintergrundgeräusche" und Garantie, dass z.ai-Läufe (Label `ai:use-zai`) tatsächlich den
DeepSeek-Endpoint nutzen. Vollständige Dokumentation: [.ai-knowledge/bare-mode.md](.ai-knowledge/bare-mode.md).

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

In **GitHub Actions** wird die Triage zusätzlich **ereignisgesteuert** angestoßen —
[`.github/workflows/claude-triage.yml`](.github/workflows/claude-triage.yml) ruft den Triage-Ablauf
automatisch für genau dieses eine Issue auf, sobald ein **Issue angelegt** wird (nur von Personen mit
Schreibzugriff, damit Außenstehende den OAuth-Token-Lauf nicht auslösen), das Label
**`ai:analyzed` entfernt** wird (erzwingt eine Neu-Analyse, z. B. nach geänderter Beschreibung), oder
jemand mit Schreibzugriff einen **Issue-Kommentar mit `@claude`** hinterlässt (Re-Triage auf Zuruf —
zweiter Trigger desselben Workflows, kein separater).

**Named Session Resume (alle 5 Phasen):** Jeder der fünf Claude-Code-Workflows
(`claude-triage.yml`/`analyse`, `claude-spec.yml`/`spec`, `claude-implement.yml`/`impl`,
`claude-pr-review.yml`/`review`, `claude-pr-fixup.yml`/`fix`) archiviert die Claude-Code-Session
jedes Laufs im GitHub Actions Cache über die Composite Actions
[`.github/actions/session-restore`](.github/actions/session-restore/action.yml) und
[`session-save`](.github/actions/session-save/action.yml). **Zwei getrennte Key-Namensraeume**
(Kreuzverhoer-Finding M3, 2026-07-08): Issue-basierte Phasen (`analyse`/`spec`/`impl`) nutzen
`claude-session-issue-<N>`; PR-basierte Phasen (`review`/`fix`, kein Issue-Bezug im Event) nutzen
`claude-session-pr-<N>` (`id-type: pr`-Input) — dadurch ist EIN Archiv NICHT ueber alle 5 Phasen
eines Tickets konsolidiert, sondern es existieren zwei unabhaengige Archive (eines pro Issue,
eines pro zugehoerigem PR); Kontinuitaet gilt jeweils NUR innerhalb derselben Phase ueber
wiederholte Laeufe hinweg (das ist auch der eigentliche Anwendungsfall: Re-Triage bzw. die
Review-/Fixup-Ping-Pong-Runden). Ein Folgelauf derselben Phase laedt das jeweilige Archiv vor dem
Agent-Schritt und haengt bei Treffer `--resume <session-id>` an `claude_args` — er setzt dann den
Konversationskontext des letzten Laufs fort, statt kontextlos neu zu beginnen; das
Delta-seit-`stand`-Vorgehen der Triage oben bleibt unveraendert die Fallback-/Grundregel. Rein
additiv und fail-open: Cache-Miss oder ein korruptes Archiv liefern leere Outputs, der Lauf startet
dann wie bisher frisch. Der Save-Schritt braucht `actions: write` (Workflow-Permission bzw. an der
GitHub-App-Installation zusaetzlich zu Contents/Issues/Pull requests) fuer `gh cache delete` (der
Cache-Key ist pro Issue/PR stabil/immutable, daher vor jedem Save ein Loeschen des alten
Eintrags) — fehlt sie, degradiert das Archiv fail-open zu read-only (Restore vom alten Stand, Save
no-opt still). `claude-triage.yml` (einziger Workflow mit `cancel-in-progress: true`) hat
zusaetzlich einen Elapsed-Guard: ein durch einen neueren Trigger verdraengter, fruehzeitig
abgebrochener Lauf speichert NICHT, um einen bereits gespeicherten frischeren Stand nicht zu
ueberschreiben. Die tragenden Annahmen (Claude Codes Sitzungsordner-Mangling, Pfadstabilitaet
zwischen Laeufen auf `ubuntu-latest`) sind bislang nur lokal verifiziert, nicht gegen einen echten
Runner — ein dauerhafter Diagnose-Log im Save-Schritt (`ls` des Claude-Projektordners) belegt das
beim naechsten natuerlichen Trigger.

Dieses Entfernen von `ai:analyzed` geschieht auch **automatisch beim Merge eines Vorgänger-Issues**:
Sind Sub-Issues über native GitHub-Issue-Dependencies (`blocked-by`) sequenziell verkettet (A1 → A2 →
A3, gesetzt bei der Zerlegung in der Triage), gibt
[`.github/workflows/claude-issue-unblock.yml`](.github/workflows/claude-issue-unblock.yml) den
nächsten Nachfolger frei, sobald **alle** seine Blocker gemergt/geschlossen sind (Fan-in-Gate) — indem
es dessen `ai:analyzed` **per App-Token** entfernt und so die Re-Triage gegen den nun gemergten
Code-Stand anstößt (die dann 🟢 → `ai:spec-ready` setzt oder mit Hinweisen beim Menschen bleibt). So
laufen aufeinander aufbauende Tickets Glied für Glied, ohne dass „gleiche Dateien"-Sub-Issues
gleichzeitig in Umsetzung kollidieren.

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
selbst test-getrieben zuerst schreiben) → **KoliBri MCP-Server nutzen für Frontend-Aufgaben** (siehe
[Kolibri MCP-Server](#kolibri-mcp-server-für-frontend-implementierung)) → `pnpm format` + Lint + `pnpm test` →
den Draft-PR **review-bereit** machen (Fallback: PR neu erstellen), via `Closes #<nr>` mit dem
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
einem **harten Zeitlimit von `timeout-minutes: 20`** — GitHub killt den Prozess dabei ohne jede
Vorwarnung (kein SIGTERM-Handling, siehe unten).

**Soft-Abort (weiches Zeitlimit, 2026-07-08):** Da weder `anthropics/claude-code-action` noch die
Claude-Code-CLI selbst einen echten Soft-Timeout unterstützen (offener Upstream-Bug
[#29096](https://github.com/anthropics/claude-code/issues/29096) — Prozesse werden bei
SIGTERM/SIGINT verwaist, kein SessionEnd-Hook), bekommt Claude in allen fünf Workflows stattdessen
eine **präzise, selbst prüfbare Deadline**: ein `starttime`-Step berechnet `soft_deadline_epoch =
jetzt + 840s` (14 Min, 6 Min Puffer bis zum harten 20-Min-Kill) und rendert diesen Epoch-Wert als
literale Zahl in den Prompt. Claude prüft vor jedem größeren Teilschritt `date +%s` dagegen und
folgt bei Erreichen einer konkreten **Stopp-Checkliste**: laufenden Schritt zu Ende bringen →
Zwischenstand sichern (committen/pushen bzw. Body-Block) → kurze Notiz was fertig/offen ist →
**kein** Abschluss-Label setzen → eigenes Auslöser-Label entfernen+neu setzen (löst per
`labeled`-Event einen Folgelauf aus, der per Session-Resume an derselben Stelle fortsetzt, s. o.) →
Turn beenden. Bei `claude-triage.yml` entfällt der Selbst-Retrigger (ihr Trigger ist das _Entfernen_
eines Labels, kein einfacher Toggle) — dort bleibt es beim bisherigen Verhalten: Body-Block mit
Teil-Analyse sichern, kein Label, kein Ping-Kommentar.

**Obergrenze (Marker-Label `ai:continued`):** Ein deterministischer Workflow-Step nach dem
Claude-Schritt erkennt einen bewussten Zwischenstopp und begrenzt automatische
Selbst-Fortsetzungen auf **genau eine**, bevor er auf den Erschöpfungs-Pfad zurückfällt (verhindert
eine Endlosschleife bei einem grundsätzlich zu großen Ticket). Bei `claude-spec.yml`/
`claude-implement.yml` erkennt dieser Step den Zwischenstopp anhand des Label-/PR-Zustands
(Auslöser-Label wieder da, Abschluss-Signal fehlt); bei `claude-pr-fixup.yml`/`claude-pr-review.yml`
setzt Claude das Marker-Label `ai:continued` als expliziten Teil der Stopp-Checkliste selbst (sonst
wäre der Fall nicht vom bestehenden „Findings sind mehrdeutig, nichts geändert"-Pfad unterscheidbar,
der ebenfalls das Auslöser-Label unverändert lässt).

Läuft ein Issue-Job (Umsetzung, Spec, Triage, Re-Triage) dennoch in den 20-Minuten-Timeout — oder ist
die Obergrenze von einer automatischen Fortsetzung bereits ausgeschöpft —, ist das Issue zu groß für
einen Lauf: Der Job setzt am Issue das Label **`ai:to-big-issue`** (und die Umsetzung entfernt
zusätzlich `ai:ready`, die Spec `ai:spec-ready`, damit es nicht erneut aufgegriffen wird) — als
Kandidat zum **Aufteilen** in Sub-Issues (Triage-Schritt „Zerlegen"). Die PR-Workflows
(Review/Fixup) teilen sich dasselbe 20-Minuten-Limit und dieselbe Obergrenzen-Logik, vergeben bei
Erschöpfung aber bewusst **kein** Issue-Label — nur einen Alarm-Kommentar (Review entfernt zusätzlich
sein Auslöser-Label `ai:needs-review`, ohne ein neues Ergebnis-Label zu setzen, damit weder ein
Fixup mit erfundenen Findings noch ein falsches `ai:ready-to-merge` ausgelöst wird).

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
Umsetzungs-Workflow macht den PR review-bereit (`gh pr ready` bzw. neuer Nicht-Draft-PR) und
labelt ihn erst danach **selbst** mit `ai:needs-review` — als expliziten, kontrollierten letzten
Schritt (erst nachdem Beschreibung + Testergebnisse vollständig sind). Der separate
[`pr-needs-review-label.yml`](.github/workflows/pr-needs-review-label.yml) reagiert bewusst
**NICHT** auf diese bot-erzeugten Draft→ready-Übergänge (nur auf menschliche Aktoren) — sonst
würde er der Umsetzung zuvorkommen und den Review auf einem noch unfertigen PR starten;
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
