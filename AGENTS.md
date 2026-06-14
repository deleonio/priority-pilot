# Agent Instructions

Zentrale Anweisungen für KI-Agents in diesem Repo. Die ausführliche, **werkzeug-unabhängige**
Wissensbasis liegt in [`.ai-knowledge/`](.ai-knowledge/).

## Wissensbasis

- [Projekt & Aufbau](.ai-knowledge/project.md) — Zweck, Monorepo, Befehle, Datenbank
- [Konventionen](.ai-knowledge/conventions.md) — Formatierung, ESLint, TypeScript, Commits
- [Ticket-Triage](.ai-knowledge/ticket-triage.md) — Analyse offener GitHub-Issues

## Kernregeln

- Monorepo mit **pnpm**.
- Formatieren: `pnpm format` (Prettier, eine zentrale Config im Root).
- Linten: `pnpm lint`.
- Bevorzugt gezielt statt repo-weit prüfen: `pnpm --filter priority-pilot build|lint`.
- TypeScript `strict`, ESM überall, Node `>=22`.
- Nicht automatisch committen ohne ausdrücklichen Wunsch.
- Alle Pull Requests müssen `pnpm format` und `pnpm lint` ausführen und die Ergebnisse in der
  PR-Beschreibung dokumentieren.

## Ticket-Triage

Offenes, nicht zugewiesenes GitHub-Issue analysieren → Lösungsvorschlag als Kommentar →
Label `ai:analyzed`. Vollständiger Ablauf: [.ai-knowledge/ticket-triage.md](.ai-knowledge/ticket-triage.md).
Konkrete Commands: `/analyze-ticket`, `/propose-solution`, `/mark-analyzed`.
