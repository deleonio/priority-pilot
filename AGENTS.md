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
→ deutscher Lösungs-Kommentar mit Umsetzbarkeits-**Ampel** (🟢/🟡/🔴) → Label `ai:analyzed` setzen
(**bei klarer Analyse 🟢 zusätzlich `ai:ready`** zur direkten Umsetzungs-Freigabe; bei 🟡/🔴 nicht).
Liegt bereits eine Analyse vor, wird sie auf Passung/Vollständigkeit geprüft und bei Bedarf
aktualisiert (Re-Triage). Vollständiger Ablauf:
[.ai-knowledge/ticket-triage.md](.ai-knowledge/ticket-triage.md).
Konkreter Command: `/triage-ticket` (analysiert, lektoriert, zerlegt, kommentiert und markiert in
einem Durchlauf).

Eine **Re-Triage** lässt sich auch per **Issue-Kommentar mit `@claude`** anstoßen: Die
GitHub-Action [`.github/workflows/claude-retriage.yml`](.github/workflows/claude-retriage.yml) ruft
den Triage-Ablauf automatisch für genau dieses eine Issue auf (nur bei Kommentaren von Personen mit
Schreibzugriff).

## Ticket-Umsetzung

Offene Issues mit Label `ai:ready` (zur Umsetzung freigegeben — bei klarer Analyse 🟢 automatisch
durch die Triage, sonst vom Menschen), die **nicht zugewiesen** sind: sich selbst zuweisen → auf
eigenem Branch umsetzen → `pnpm format` + Lint → **PR (ready to review)**, via `Closes #<nr>` mit dem
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
Kreuzverhör-Review übernimmt ein eigener Workflow).

Label-Kette: `ai:analyzed` (analysiert) → `ai:ready` (freigegeben — bei 🟢 automatisch durch die
Triage, sonst durch den Menschen) → Umsetzung als PR (ready to review), der den Kreuzverhör-Loop
(`/kreuzverhoer-review`) durchläuft und bis Merge/Schließen verfolgt wird.

## PR-Review (Kreuzverhör)

Implementierte Pull Requests werden **kritisch wie im Kreuzverhör** geprüft: Titel/Beschreibung und
**vollständigen Diff** lesen → kritische Fragen stellen (Löst der PR das Problem? Edge Cases?
einfachster Weg? Performance/Security?) → Code-Qualität prüfen (Benennung, Testabdeckung,
Projekt-Konventionen) → je Finding einen an Datei/Zeile **verankerten** Review-Kommentar (Was,
warum, konkreter Vorschlag) → abschließendes Urteil mit Umsetzbarkeits-**Ampel** (🟢/🟡/🔴). Kein
formales Approve/Request-Changes — der Merge bleibt beim Menschen. Vollständiger Ablauf:
[.ai-knowledge/pr-review.md](.ai-knowledge/pr-review.md).
Konkreter Command: `/kreuzverhoer-review`.

In **GitHub Actions** wird ein review-bereiter PR automatisch kreuzverhört
([`.github/workflows/claude-pr-review.yml`](.github/workflows/claude-pr-review.yml)); die Findings
setzt [`.github/workflows/claude-pr-fixup.yml`](.github/workflows/claude-pr-fixup.yml) um und stößt
über den Push einen erneuten Review an (Loop bis 🟢). Diese Workflows nutzen ein
GitHub-App-Token (Secrets `APP_ID` + `APP_PRIVATE_KEY`), damit die Stufen kaskadieren.

Die im Review entstehenden Kommentare werden vom Umsetzungs-Workflow (`/implement-ticket`,
Schritt 5) im **Kreuzverhör-Loop** abgearbeitet — der den PR zusätzlich **abonniert und automatisch
auf eingehende Review-Anmerkungen reagiert**: zutreffende Punkte fixen, mehrdeutige rückfragen, sonst
begründet kommentieren — danach erneut kreuzverhören, bis nichts mehr offen ist (Verfolgung bis
Merge/Schließen).

## Tests (Server)

`pnpm --filter priority-pilot test` — Node.js `node:test` + `tsx`, In-Memory-SQLite, alle Testdateien unter `server/src/**/*.test.ts`.

## Tests (Frontend)

`pnpm --filter frontend test` — Vitest + jsdom + Testing Library, Testdateien unter `frontend/src/**/*.test.tsx`.

`pnpm --filter frontend test:e2e` — Playwright Visual-Snapshots (`toHaveScreenshot`, nur Chromium),
Specs/Fixtures unter `frontend/e2e/`. Die API wird per `page.route` gemockt (kein Backend nötig);
Playwright startet den Vite-Dev-Server selbst. Baselines aktualisieren bzw. neu erzeugen:
`pnpm --filter frontend test:e2e:update`.

Die E2E-Snapshots laufen **nicht** als Teil von `pnpm -r test` bzw. `pnpm --filter frontend test`
(Vitest schließt `e2e/` aus), sondern ausschließlich separat über `test:e2e` (benötigen die
installierten Playwright-Browser).
