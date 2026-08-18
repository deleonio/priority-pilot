# Agent Instructions

Zentrale Anweisungen für KI-Agents in diesem Repo. Die ausführliche, **werkzeug-unabhängige**
Wissensbasis liegt in [`.ai-knowledge/`](.ai-knowledge/). CI/Provider/Modell-Doku (für Menschen,
nicht Agent-Kontext): [docs/ci-architecture.md](docs/ci-architecture.md).

## Wissensbasis

- [Projekt & Aufbau](.ai-knowledge/project.md) — Zweck, Monorepo, Befehle, Datenbank
- [Konventionen](.ai-knowledge/conventions.md) — Formatierung, ESLint, TypeScript, Commits, Mobile-First
- [Ticket-Triage](.ai-knowledge/ticket-triage.md) — Analyse offener GitHub-Issues
- [Ticket-Spec](.ai-knowledge/ticket-spec.md) — rote Tests (Vertrag) für `ai:needs-spec`-Issues schreiben
- [Ticket-Umsetzung](.ai-knowledge/ticket-implementation.md) — freigegebene Issues (`ai:needs-impl`) umsetzen
- [PR-Review (Kreuzverhör)](.claude/skills/review-kreuzverhoer/SKILL.md) — Skill: Pull Requests kritisch prüfen (inkl. Kreuzverhör-Haltung), Findings kommentieren
- [TDD-Strategie](.ai-knowledge/tdd-strategy.md) — test-getriebene KI-Workflows (Stufen 1+2+3 adoptiert)
- [Browser-MCP](docs/browser-mcp.md) — laufende App visuell prüfen (`pnpm ui:inspect` + Playwright-MCP)
- [Deployment](docs/deployment.md) — Merge→Build→rsync→PM2, Host-Layout, Rollback
- [CI-Architektur](docs/ci-architecture.md) — Provider, Modelle, Soft-Abort, Label-Pipeline, KoliBri MCP
- [Pipeline-Flow](docs/pipeline-flow.md) — Mermaid-Diagramm des label-getriebenen Ticket-Flows
- [CI-Legacy-Vergleich](docs/ci-legacy-comparison.md) — Struktur-/Stabilitäts-Vergleich Legacy vs. aktuell
- [Tailscale Exit Node](docs/tailscale-exit-node.md) — CI-Traffic über Nürnberger Tailscale-Exit-Node (manueller Test-Workflow)
- [Multi-Provider-CI](.ai-knowledge/multi-provider-ci.md) — Provider-Setup, Secrets, setup-claude-Action (Betriebs-Doku)
- [UX-Pattern: Sequenzielle Bestätigung](docs/ux-pattern-sequential-confirmation.md) — verbindliche Referenz für destruktive Aktionen
- [Mobile-UI-Regeln](docs/mobile-ui-rules.md) — verbindliches Regelset für Mobile-UI (Daumen-Zonen, Touch-Targets, async Zustände, Anti-Patterns; mit Repo-Abstimmung)
- [Design-Sprache „Cockpit"](.ai-knowledge/ux-design.md) — wie es aussieht: Farbrollen, Skalen-Tokens, Komponentenwahl (Schwesterdatei zu den Mobile-UI-Regeln)

## Kernregeln

- **Minimalprinzip:** Programmiere, dokumentiere und teste nur so viel wie wirklich notwendig und so
  wenig wie irgend möglich. Jede Zeile ist Wartungslast und muss ihren Platz verdienen. Für Tests ist
  das Aufnahmekriterium in [TDD-Strategie → Testumfang](.ai-knowledge/tdd-strategy.md#testumfang--so-viel-wie-nötig-so-wenig-wie-irgend-möglich)
  operationalisiert: ein Test muss etwas **auswerten**, einen **Spiegel** absichern oder vor einem
  **stillen/teuren** Ausfall schützen — sonst entsteht er nicht.
- **KoliBri-First:** Komponenten nur selbst stylen, wenn keine KoliBri-Komponente anwendbar ist
  (Shadow-Web-Components mit festem Styling; Shadow-DOM-CSS ist unpublizierte API).
- Monorepo mit **pnpm**.
- Formatieren: `pnpm format` (Prettier, eine zentrale Config im Root).
- Linten: `pnpm lint`.
- Bevorzugt gezielt statt repo-weit prüfen: `pnpm --filter server build|lint`.
- TypeScript `strict`, ESM überall, Node `>=26`.
- Nicht automatisch committen ohne ausdrücklichen Wunsch. **Dokumentierte Ausnahme:** die
  Ticket-Workflows [`/spec-ticket`](.ai-knowledge/ticket-spec.md) und
  [`/implement-ticket`](.ai-knowledge/ticket-implementation.md) committen, pushen und
  erstellen/aktualisieren PRs als **ausdrücklichen Teil ihres Auftrags** — das gilt nur für diese
  beiden Workflows, nicht als allgemeine Erlaubnis.
- Alle Pull Requests müssen `pnpm format`, `pnpm lint` **und `pnpm test`** ausführen (Tests grün ist
  Pflicht, siehe [TDD-Strategie](.ai-knowledge/tdd-strategy.md) Stufe 2) und die Ergebnisse in der
  PR-Beschreibung dokumentieren.

## KI-Agent — Pipeline-Phasen

Die Pipeline umfasst sieben Phasen: Triage, UX-Beratung, Spec, Umsetzung, Review, Fixup und PR-Documenter
laufen als KI-gesteuerte Workflows über **Claude Code** in GitHub Actions. Die 7. Phase
**PR-Documenter** läuft NACH dem Merge und arbeitet in Arbeitsteilung: deterministische
Regel-Logik (`.github/scripts/pr-doc-facts.sh`) erkennt Bot-PRs und prüft den Titel, das LLM
liefert nur Klassifikation + Texte (`/tmp/doc.json`), und `.github/scripts/pr-doc-render.sh`
setzt alle Schreibzugriffe um — Titel-Rename (Conventional Commits, **englisch**), Body-Sektion
zwischen `<!-- ai-documenter-body -->`-Markern (bestehender Body bleibt unangetastet), GENAU EIN
Release-Note-Kommentar (`<!-- ai-documenter -->`, PATCH statt Duplikat) und Labels
(`release:*` nach Klassifikation, `ai:documented`). Der Reviewer (Phase 5) korrigiert den Titel
schon VOR dem Merge (Titel-Gate). Die `release:*`-Labels speisen die Release Notes
([.github/release.yml](.github/release.yml)) der Deploy-Pipeline. Der Provider ist über die
Repo-Variable **`vars.LLM_PROVIDER`** umschaltbar:
`claude` (Anthropic nativ, Default, `CLAUDE_API_KEY`) oder `zai` (z.ai/GLM, `ZAI_API_KEY`).
Endpoint, Modell-Aliase und Key
löst die Setup-Action pro Lauf auf — die eingecheckte
[`.claude/settings.json`](.claude/settings.json) bleibt bewusst providerneutral, weil sie auch
für lokale Sessions gilt. CI/Provider/Modell-Doku: [docs/ci-architecture.md](docs/ci-architecture.md).

**CI-MCP-Integration:** KoliBri-MCP (`kolibri-mcp`, Tools `mcp__kolibri-mcp__*`) ist in allen Phasen außer
Documenter (07) über `needs-mcp: true` verfügbar; Playwright-MCP (`playwright`, Tools `mcp__playwright__*`)
zusätzlich in UX (02), Umsetzung (04) und Fixup (06) über `browser-mcp: true` für Layout-Prüfung
(375px/1280px Viewport) bei laufender App auf `http://localhost:4174`.

**Jede KI-gesteuerte Phase liest nur ihre eigene Wissensbasis-Datei** + das Issue/PR. Kein domänenübergreifendes
Lesen — die jeweilige Datei enthält alles Notwendige.

**Label-Kette (Schema `ai:needs-*` → `ai:<Vergangenheitsform>`, Issue #851, verschlankt #873):** Jede
Phase triggert auf genau ein `ai:needs-*`-Label, konsumiert es und setzt den Trigger der Folgephase
— plus ein Done-Label nur, wo Logik es liest. **Ein neues Issue startet NICHTS von selbst**: Der
Einstieg ist das manuell gesetzte `ai:needs-analyse` (bzw. `ai:analysed` entfernt) → Analyse →
`ai:analysed` + `ai:needs-ux-ui` (UI) bzw. `ai:needs-spec` (Nicht-UI) → UX →
`ai:needs-spec` → Spec → `ai:needs-impl` → Umsetzung → `ai:needs-review` (PR) → Review ↔ Fixup
(`ai:needs-fixup` → `ai:needs-review`) → `ai:reviewed` → Gate-Merge. Info-Labels ohne Trigger:
`ai:needs-human` (Warum + was der Mensch entscheiden soll), `ai:to-big-issue` (Aufgabe zu groß).

| Phase             | Trigger                                                | Wissensbasis (einzige zu lesende Datei)                                                                | Output                                                                                                     |
| ----------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| **Triage**        | `ai:needs-analyse` gesetzt oder `ai:analysed` entfernt | [ticket-triage.md](.ai-knowledge/ticket-triage.md)                                                     | Analyse-Body-Block + Ampel → `ai:analysed` (+ `ai:needs-ux-ui` bei 🟢+UI, `ai:needs-spec` bei 🟢+Nicht-UI) |
| **UX-Beratung**   | `ai:needs-ux-ui`                                       | [ticket-ux.md](.ai-knowledge/ticket-ux.md)                                                             | KI-UX-Block → `ai:needs-spec` (Nicht-UI-Tickets: Analyse setzt `ai:needs-spec` direkt)                     |
| **Spec**          | `ai:needs-spec`                                        | [ticket-spec.md](.ai-knowledge/ticket-spec.md)                                                         | Rote Tests + Draft-PR → `ai:needs-impl`                                                                    |
| **Umsetzung**     | `ai:needs-impl`                                        | [ticket-implementation.md](.ai-knowledge/ticket-implementation.md)                                     | Tests grün + PR review-bereit → `ai:needs-review` (am PR)                                                  |
| **Review**        | `ai:needs-review` (am PR)                              | [review-kreuzverhoer-Skill](.claude/skills/review-kreuzverhoer/SKILL.md)                               | Sammelkommentar + Ampel → `ai:reviewed` (🟢) bzw. `ai:needs-fixup` (🔴)                                    |
| **Fixup**         | `ai:needs-fixup` (am PR)                               | [review-kreuzverhoer-Skill](.claude/skills/review-kreuzverhoer/SKILL.md)                               | Findings behoben → `ai:needs-review`                                                                       |
| **PR-Documenter** | `pull_request.closed` + `merged` (PR gemergt)          | [documenter.md](.github/prompts/documenter.md) (LLM-Anteil) + `pr-doc-{facts,render}.sh` (Regel-Logik) | PR-Titel, -Beschreibung, Release-Note & Labels nach Merge → `ai:documented`                                |

## Tests (Server)

Testkonzept (Scope, Coverage-Ziel, bewusste Ausnahmen): [docs/testing.md](docs/testing.md).

`pnpm --filter server test` — Node.js `node:test` + `tsx`, In-Memory-SQLite, alle Testdateien unter `server/src/**/*.test.ts`.

## Tests (Frontend)

`pnpm --filter frontend test` — Vitest + jsdom + Testing Library, Testdateien unter `frontend/src/**/*.test.tsx`.

`pnpm --filter frontend test:e2e` — Playwright-E2E (nur Chromium), Specs unter `frontend/e2e/`.
**Funktionale** Specs gegen das **echte** Backend (`smoke.spec.ts`, `crud.spec.ts` —
anlegen/bearbeiten/löschen + Säulen-Gewicht; Playwright startet Backend mit temporärer In-Memory-DB +
Vite, `crud.spec.ts` räumt in `afterEach` über die API auf). Es wird nicht via `page.route` gemockt.

Die E2E-Specs laufen **nicht** als Teil von `pnpm -r test` bzw. `pnpm --filter frontend test`
(Vitest schließt `e2e/` aus), sondern ausschließlich separat über `test:e2e` (benötigen die
installierten Playwright-Browser).
