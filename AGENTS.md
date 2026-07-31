# Agent Instructions

Zentrale Anweisungen für KI-Agents in diesem Repo. Die ausführliche, **werkzeug-unabhängige**
Wissensbasis liegt in [`.ai-knowledge/`](.ai-knowledge/). CI/Provider/Modell-Doku (für Menschen,
nicht Agent-Kontext): [docs/ci-architecture.md](docs/ci-architecture.md).

## Wissensbasis

- [Projekt & Aufbau](.ai-knowledge/project.md) — Zweck, Monorepo, Befehle, Datenbank
- [Konventionen](.ai-knowledge/conventions.md) — Formatierung, ESLint, TypeScript, Commits, Mobile-First
- [Ticket-Triage](.ai-knowledge/ticket-triage.md) — Analyse offener GitHub-Issues
- [Ticket-Spec](.ai-knowledge/ticket-spec.md) — rote Tests (Vertrag) für `ai:spec-ready`-Issues schreiben
- [Ticket-Umsetzung](.ai-knowledge/ticket-implementation.md) — freigegebene Issues (`ai:ready`) umsetzen
- [PR-Review (Kreuzverhör)](.ai-knowledge/pr-review.md) — Pull Requests kritisch prüfen, Findings kommentieren
- [TDD-Strategie](.ai-knowledge/tdd-strategy.md) — test-getriebene KI-Workflows (Stufen 1+2+3 adoptiert)
- [Kreuzverhör-Haltung](.ai-knowledge/kreuzverhoer-haltung.md) — Methode des adversarialen Hinterfragens
- [Deployment](docs/deployment.md) — Release-Build, Tarball, Host-Layout, systemd, Caddy, Rollback
- [CI-Architektur](docs/ci-architecture.md) — Provider, Modelle, Soft-Abort, Label-Pipeline, KoliBri MCP

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

## KI-Agent — Pipeline-Phasen

Alle KI-Workflows (Triage, Spec, Umsetzung, Review, Fixup) laufen über einen **Coding-Agent** in
GitHub Actions — agent-agnostisch. Der Agent ist wählbar per GitHub-Variable `vars.AGENT`
(`hermes` | `claude`, default: `hermes`). Beide nutzen denselben z.ai/GLM-5.1-Backend; die Prompts und
Label-Pipeline sind identisch — nur die Agent-Runtime wechselt. CI/Provider/Modell-Doku:
[docs/ci-architecture.md](docs/ci-architecture.md).

**Jede Phase liest nur ihre eigene Wissensbasis-Datei** + das Issue/PR. Kein domänenübergreifendes
Lesen — die jeweilige Datei enthält alles Notwendige.

**Label-Kette:** `ai:analyzed` → `ai:spec-ready` (🟢) → `ai:ready` → Umsetzung →
`ai:needs-review` → Review ↔ Fixup (`ai:needs-changes`) → `ai:ready-to-merge`.

| Phase         | Trigger                                     | Wissensbasis (einzige zu lesende Datei)                            | Output                                                                      |
| ------------- | ------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| **Triage**    | Issue neu, `ai:analyzed` entfernt, `@agent` | [ticket-triage.md](.ai-knowledge/ticket-triage.md)                 | Analyse-Body-Block + Ampel, Ping → `ai:analyzed` (+ `ai:spec-ready` bei 🟢) |
| **Spec**      | `ai:spec-ready` + `ai:analyzed`             | [ticket-spec.md](.ai-knowledge/ticket-spec.md)                     | Rote Tests + Draft-PR → `ai:ready`                                          |
| **Umsetzung** | `ai:ready` + `ai:analyzed`                  | [ticket-implementation.md](.ai-knowledge/ticket-implementation.md) | Tests grün + PR review-bereit → `ai:needs-review`                           |
| **Review**    | `ai:needs-review` (am PR)                   | [pr-review.md](.ai-knowledge/pr-review.md)                         | Sammelkommentar + Ampel → `ai:needs-changes` / `ai:ready-to-merge`          |
| **Fixup**     | `ai:needs-changes` (am PR)                  | [pr-review.md](.ai-knowledge/pr-review.md)                         | Findings behoben → `ai:needs-review`                                        |

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
