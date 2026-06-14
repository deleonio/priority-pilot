# Agent Instructions

Zentrale Anweisungen für KI-Agents in diesem Repo. Die ausführliche, **werkzeug-unabhängige**
Wissensbasis liegt in [`.ai-knowledge/`](.ai-knowledge/).

## Wissensbasis

- [Projekt & Aufbau](.ai-knowledge/project.md) — Zweck, Monorepo, Befehle, Datenbank
- [Konventionen](.ai-knowledge/conventions.md) — Formatierung, ESLint, TypeScript, Commits
- [Ticket-Triage](.ai-knowledge/ticket-triage.md) — Analyse offener GitHub-Issues
- [Ticket-Umsetzung](.ai-knowledge/ticket-implementation.md) — freigegebene Issues (`ai:ready`) umsetzen

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

Offene Issues **ohne** Label `ai:analyzed` analysieren (aus Titel + Beschreibung + Repo eine
Lösung konzipieren) → deutscher Lösungs-Kommentar → Label `ai:analyzed` setzen. Vollständiger
Ablauf: [.ai-knowledge/ticket-triage.md](.ai-knowledge/ticket-triage.md).
Konkreter Command: `/triage-ticket` (analysiert, kommentiert und markiert in einem Durchlauf).

## Ticket-Umsetzung

Offene Issues mit Label `ai:ready` (vom Menschen zur Umsetzung freigegeben), die **nicht
zugewiesen** sind: sich selbst zuweisen → auf eigenem Branch umsetzen → `pnpm format` + Lint →
**Draft-PR**, via `Closes #<nr>` mit dem Ticket verknüpft (erscheint im „Development"-Bereich,
schließt es beim Merge). Vollständiger Ablauf:
[.ai-knowledge/ticket-implementation.md](.ai-knowledge/ticket-implementation.md).
Konkreter Command: `/implement-ticket`.

Label-Kette: `ai:analyzed` (analysiert) → `ai:ready` (freigegeben) → Umsetzung als Draft-PR.
