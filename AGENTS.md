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
- [Subagent-Ausführungsvertrag](.ai-knowledge/subagent-contract.md) — historisch (bei Claude Code, nicht mehr aktiv)
- [Kreuzverhör-Haltung](.ai-knowledge/kreuzverhoer-haltung.md) — Methode des adversarialen Hinterfragens (Chat-Trigger + PR-Review)
- [Deployment](docs/deployment.md) — Release-Build (GitHub Actions), Tarball, Host-Layout, systemd, Caddy, Rollback
- [Deployment: Repo-Plan](docs/deployment-repo-plan.md) — was im Repo zu bauen ist (Pack-Skript, Release-Workflow, Secrets)
- [Deployment: Server-Setup](docs/server-setup.md) — Schritt-für-Schritt-Einrichtung des Linux-Servers
- [Workflow-Tool: Kosten-Reporting](docs/workflow-tool-costs.md) — Snippet für Token-/USD-EUR-Schätzung
- [OpenRouter-Kostenanalyse](.ai-knowledge/openrouter-cost-analysis.md) — Modellpreise, Alternativen, Kostenvergleich (DeepSeek/Gemini/GPT via OpenRouter)

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

## KI-Agent: Hermes Agent

Alle KI-Workflows (Triage, Re-Triage, Spec, Umsetzung, PR-Review, PR-Fixup) laufen auf
**Hermes Agent** (Nous Research) über **OpenRouter**. Die Modellwahl folgt der
Aufgaben-Strenge: **DeepSeek Pro** für Analyse/Spec/Review (präzises Reasoning),
**DeepSeek Flash** für Implementierung/Fixup (schnell und günstig).

- [Hermes Agent Docs](https://hermes-agent.nousresearch.com/docs/)
- Modelle:
  - `deepseek/deepseek-v4-pro` (Analyse, Spec, Review — präzises Reasoning)
  - `deepseek/deepseek-v4-flash` (Umsetzung, Fixup — schnell, günstig)
- Secret: `OPENROUTER_API_KEY` (https://openrouter.ai/keys)
- CLI: `hermes chat -q '<prompt>'` (single-query, non-interactive)

Hermes wird im CI-Lauf frisch installiert (keine dedizierte GitHub Action nötig):

```bash
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
echo "$HOME/.local/bin" >> $GITHUB_PATH
hermes config set model.provider openrouter
hermes config set model.base_url https://openrouter.ai/api/v1
```

**CI-Flags:**

| Flag                    | Zweck                                                                |
| ----------------------- | -------------------------------------------------------------------- |
| `-q '<prompt>'`         | Single-query, non-interactive                                        |
| `-Q`                    | Quiet — keine Banner/Spinner                                         |
| `--yolo`                | Keine Gefahren-Bestätigung (headless)                                |
| `--provider openrouter` | API-Routing über OpenRouter                                          |
| `-m <modell>`           | Modell-Festlegung (Pro oder Flash)                                   |
| `-t "terminal,file"`    | Nur Terminal und Datei-Tools                                         |
| `--ignore-user-config`  | Nur bei Triage (kein MCP nötig), sonst weggelassen zugunsten von MCP |
| `--max-turns 90`        | Tool-Call-Obergrenze                                                 |
| `--accept-hooks`        | Shell-Hooks automatisch freigeben                                    |

**Prompt:** Per Heredoc in eine Datei geschrieben, dann via `-q "$(cat /tmp/hermes-prompt.txt)"` übergeben — vermeidet Shell-Quoting-Probleme.

Fünf Workflows teilen sich zwei Modelle nach Aufgaben-Strenge:

- **Analyse (Triage) + Spec + Review** → `deepseek/deepseek-v4-pro`
- **Umsetzung (Implement) + Fixup** → `deepseek/deepseek-v4-flash`

### Kolibri MCP-Server für Frontend-Implementierung

Der KoliBri MCP-Server ist in Hermes' `config.yaml` als MCP-Server konfiguriert und steht
den Agenten automatisch zur Verfügung:

```yaml
mcp_servers:
  kolibri:
    url: https://public-ui-kolibri-mcp.vercel.app/mcp
    type: http
```

**Verfügbare Tools:** `search` (Komponenten-Suche), `fetch` (Beispiel/Dokument holen).

**Hinweis für GitHub Actions (CI):** Der MCP-Server wird in den CI-Workflows (spec,
implement, review, fixup) nach der Installation via `pip install mcp` und
`hermes mcp add kolibri` eingerichtet — siehe den Schritt „Hermes konfigurieren" in
jedem Workflow. Die Tools heißen `mcp_kolibri_search` und `mcp_kolibri_fetch` und
stehen dem Agenten automatisch zur Verfügung, sobald der MCP-Server läuft.
Die Workflows nutzen seit der MCP-Aktivierung **nicht mehr** `--ignore-user-config`,
damit die `mcp_servers`-Konfiguration wirkt.

### OpenRouter (Modell-Provider)

Hermes unterstützt OpenRouter **nativ** — kein Workaround, keine `configure-ai-backend`-Action.
Einfach `--provider openrouter` + `OPENROUTER_API_KEY`.
Preise: DeepSeek Pro $0.43/$0.87, DeepSeek Flash $0.09/$0.18 pro 1M Tokens (Input/Output).

### Weiches Zeitlimit (Soft-Abort)

Der `starttime`-Step berechnet `soft_deadline_epoch = now + 840s` (14 Min, 6 Min Puffer
bis zum harten 20-Min-Kill). Der Prompt weist Hermes an, vor jedem größeren Teilschritt
`date +%s` gegen den Soft-Deadline-Wert zu prüfen. Bei Erreichen: Zwischenstand sichern,
Selbst-Retrigger (Label entfernen + sofort neu setzen), Turn beenden.

**Obergrenze (Marker-Label `ai:continued`):** Ein deterministischer Workflow-Step nach
dem Hermes-Schritt begrenzt automatische Selbst-Fortsetzungen auf genau eine.

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
[`.github/workflows/hermes-triage.yml`](.github/workflows/hermes-triage.yml) ruft den Triage-Ablauf
automatisch für genau dieses eine Issue auf, sobald ein **Issue angelegt** wird (nur von Personen mit
Schreibzugriff), das Label
**`ai:analyzed` entfernt** wird (erzwingt eine Neu-Analyse, z. B. nach geänderter Beschreibung), oder
jemand mit Schreibzugriff einen **Issue-Kommentar mit `@claude`** hinterlässt (Re-Triage auf Zuruf —
zweiter Trigger desselben Workflows, kein separater).

### Named Session Resume (aktuell nicht aktiv)

Die Session-Resume-Funktionalität (MIG-002) ist noch nicht migriert. Derzeit startet
jeder Lauf frisch ohne Kontext aus vorherigen Läufen derselben Phase.

Dieses Entfernen von `ai:analyzed` geschieht auch **automatisch beim Merge eines Vorgänger-Issues**:
Sind Sub-Issues über native GitHub-Issue-Dependencies (`blocked-by`) sequenziell verkettet (A1 → A2 →
A3, gesetzt bei der Zerlegung in der Triage), gibt
[`.github/workflows/hermes-issue-unblock.yml`](.github/workflows/hermes-issue-unblock.yml) den
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
automatisch an — [`.github/workflows/hermes-spec.yml`](.github/workflows/hermes-spec.yml) (eigener
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
[`.github/workflows/hermes-implement.yml`](.github/workflows/hermes-implement.yml) (Schritte 1–4; den
Kreuzverhör-Review übernimmt ein eigener Workflow). Hermes läuft dabei direkt im Runner mit
einem **harten Zeitlimit von `timeout-minutes: 20`**.

**Soft-Abort (weiches Zeitlimit, 2026-07-08):** Da Hermes keinen echten
Soft-Timeout unterstützt, bekommt der Agent in allen fünf Workflows eine
**präzise, selbst prüfbare Deadline**: ein `starttime`-Step berechnet `soft_deadline_epoch =
jetzt + 840s` (14 Min, 6 Min Puffer bis zum harten 20-Min-Kill) und rendert diesen Epoch-Wert als
literale Zahl in den Prompt. Hermes prüft vor jedem größeren Teilschritt `date +%s` dagegen und
folgt bei Erreichen einer konkreten **Stopp-Checkliste**: laufenden Schritt zu Ende bringen →
Zwischenstand sichern (committen/pushen bzw. Body-Block) → kurze Notiz was fertig/offen ist →
**kein** Abschluss-Label setzen → eigenes Auslöser-Label entfernen+neu setzen (löst per
`labeled`-Event einen Folgelauf aus) →
Turn beenden. Bei `hermes-triage.yml` entfällt der Selbst-Retrigger (ihr Trigger ist das _Entfernen_
eines Labels, kein einfacher Toggle) — dort bleibt es beim bisherigen Verhalten: Body-Block mit
Teil-Analyse sichern, kein Label, kein Ping-Kommentar.

**Obergrenze (Marker-Label `ai:continued`):** Ein deterministischer Workflow-Step nach dem
Hermes-Schritt erkennt einen bewussten Zwischenstopp und begrenzt automatische
Selbst-Fortsetzungen auf **genau eine**, bevor er auf den Erschöpfungs-Pfad zurückfällt (verhindert
eine Endlosschleife bei einem grundsätzlich zu großen Ticket). Bei `hermes-spec.yml`/
`hermes-implement.yml` erkennt dieser Step den Zwischenstopp anhand des Label-/PR-Zustands
(Auslöser-Label wieder da, Abschluss-Signal fehlt); bei `hermes-pr-fixup.yml`/`hermes-pr-review.yml`
setzt Hermes das Marker-Label `ai:continued` als expliziten Teil der Stopp-Checkliste selbst (sonst
wäre der Fall nicht vom bestehenden "Findings sind mehrdeutig, nichts geändert"-Pfad unterscheidbar,
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

1. **Chat/REPL (interaktiv):** Trigger-Phrasen aktivieren den Agenten direkt:
   „Kreuzverhör", „nimm das auseinander", „stress-teste das", „challenge mich".
2. **Slash-Command:** `/kreuzverhoer-review [PR-Nummer]` — führt das Review eines konkreten PRs
   im Session-Modell des Aufrufers durch.
3. **GitHub Actions (automatisch):** `hermes-pr-review.yml` feuert, wenn ein PR das Label
   `ai:needs-review` trägt — Hermes reviewt den PR.

In **GitHub Actions** läuft das über **Labels** (stabiles Ping-Pong statt Event-Kaskaden): Der
Umsetzungs-Workflow macht den PR review-bereit (`gh pr ready` bzw. neuer Nicht-Draft-PR) und
labelt ihn erst danach **selbst** mit `ai:needs-review` — als expliziten, kontrollierten letzten
Schritt (erst nachdem Beschreibung + Testergebnisse vollständig sind). Der separate
[`pr-needs-review-label.yml`](.github/workflows/pr-needs-review-label.yml) reagiert bewusst
**NICHT** auf diese bot-erzeugten Draft→ready-Übergänge (nur auf menschliche Aktoren) — sonst
würde er der Umsetzung zuvorkommen und den Review auf einem noch unfertigen PR starten;
[`hermes-pr-review.yml`](.github/workflows/hermes-pr-review.yml) reviewt ihn und setzt
`ai:needs-changes` (Findings) bzw. `ai:ready-to-merge` (🟢);
[`hermes-pr-fixup.yml`](.github/workflows/hermes-pr-fixup.yml) arbeitet `ai:needs-changes` ab und
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
