# Agent Instructions

Zentrale Anweisungen für KI-Agents in diesem Repo. Die ausführliche, **werkzeug-unabhängige**
Wissensbasis liegt in [`.ai-knowledge/`](.ai-knowledge/).

## Wissensbasis

- [Projekt & Aufbau](.ai-knowledge/project.md) — Zweck, Monorepo, Befehle, Datenbank
- [Konventionen](.ai-knowledge/conventions.md) — Formatierung, ESLint, TypeScript, Commits
- [Ticket-Triage](.ai-knowledge/ticket-triage.md) — Analyse offener GitHub-Issues
- [Ticket-Umsetzung](.ai-knowledge/ticket-implementation.md) — freigegebene Issues (`ai:ready`) umsetzen
- [PR-Review (Kreuzverhör)](.ai-knowledge/pr-review.md) — Pull Requests kritisch prüfen, Findings kommentieren

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
Lösung konzipieren) → Beschreibung **lektorieren** (Form verbessern, Inhalt unverändert) → zu große
Tickets in verknüpfte **Sub-Issues** zerlegen (max. eine Ebene, Rekursionsschutz via `ai:analyzed`)
→ deutscher Lösungs-Kommentar mit Umsetzbarkeits-**Ampel** (🟢/🟡/🔴) → Label `ai:analyzed` setzen.
Liegt bereits eine Analyse vor, wird sie auf Passung/Vollständigkeit geprüft und bei Bedarf
aktualisiert (Re-Triage). Vollständiger Ablauf:
[.ai-knowledge/ticket-triage.md](.ai-knowledge/ticket-triage.md).
Konkreter Command: `/triage-ticket` (analysiert, lektoriert, zerlegt, kommentiert und markiert in
einem Durchlauf).

## Ticket-Umsetzung

Offene Issues mit Label `ai:ready` (vom Menschen zur Umsetzung freigegeben), die **nicht
zugewiesen** sind: sich selbst zuweisen → auf eigenem Branch umsetzen → `pnpm format` + Lint →
**PR (ready to review)**, via `Closes #<nr>` mit dem Ticket verknüpft (erscheint im „Development"-Bereich,
schließt es beim Merge) → PR **beobachten** und Review-Kommentare behandeln (zutreffende fixen,
mehrdeutige rückfragen, sonst kommentieren), bis er gemergt oder geschlossen ist. Vollständiger Ablauf:
[.ai-knowledge/ticket-implementation.md](.ai-knowledge/ticket-implementation.md).
Konkreter Command: `/implement-ticket`.

Label-Kette: `ai:analyzed` (analysiert) → `ai:ready` (freigegeben) → Umsetzung als PR (ready to review) → PR-Review (`/kreuzverhoer-review`).

## PR-Review (Kreuzverhör)

Implementierte Pull Requests werden **kritisch wie im Kreuzverhör** geprüft: Titel/Beschreibung und
**vollständigen Diff** lesen → kritische Fragen stellen (Löst der PR das Problem? Edge Cases?
einfachster Weg? Performance/Security?) → Code-Qualität prüfen (Benennung, Testabdeckung,
Projekt-Konventionen) → je Finding einen an Datei/Zeile **verankerten** Review-Kommentar (Was,
warum, konkreter Vorschlag) → abschließendes Urteil mit Umsetzbarkeits-**Ampel** (🟢/🟡/🔴). Kein
formales Approve/Request-Changes — der Merge bleibt beim Menschen. Vollständiger Ablauf:
[.ai-knowledge/pr-review.md](.ai-knowledge/pr-review.md).
Konkreter Command: `/kreuzverhoer-review`.

Die im Review entstehenden Kommentare werden vom Umsetzungs-Workflow (`/implement-ticket`,
Schritt 4) **behandelt**: zutreffende Punkte fixen, mehrdeutige rückfragen, sonst begründet
kommentieren.
