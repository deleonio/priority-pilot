# Agent Instructions

Zentrale Anweisungen für alle KI-Agents in diesem Repo. Die ausführliche, **werkzeug-unabhängige**
Wissensbasis liegt in [`.ai-knowledge/`](.ai-knowledge/). CI-Doku (für Menschen, nicht
Agent-Kontext): [docs/ci-architecture.md](docs/ci-architecture.md).

## Wissensbasis

- [Projekt & Konventionen](.ai-knowledge/project.md) — Zweck, Monorepo, Befehle, Konventionen, Mobile-First, Datenbank
- [Ticket-Triage](.claude/skills/ticket-triage/SKILL.md) — Analyse offener GitHub-Issues
- [Ticket-UX](.claude/skills/ticket-ux/SKILL.md) — UX-Beratung für UI-Tickets
- [Ticket-Spec](.claude/skills/ticket-spec/SKILL.md) — rote Tests (Vertrag) für `ai:needs-spec`-Issues
- [Ticket-Umsetzung](.claude/skills/ticket-implementation/SKILL.md) — freigegebene Issues (`ai:needs-impl`) umsetzen
- [PR-Review (Kreuzverhör)](.claude/skills/review-kreuzverhoer/SKILL.md) — PRs adversarial prüfen, Findings kommentieren
- [TDD-Strategie](.ai-knowledge/tdd-strategy.md) — test-getriebene KI-Workflows (Stufen 1+2+3 adoptiert)
- [Design-Sprache „Cockpit"](.ai-knowledge/ux-design.md) — Farbrollen, Skalen-Tokens, Komponentenwahl
- [Dauergedächtnis](.ai-memory/MEMORY.md) — Erfahrungs-Log über Tickets hinweg (Protokoll: [Memory](#memory))
- [Browser-MCP](docs/browser-mcp.md) — laufende App visuell prüfen (`pnpm ui:inspect` + Playwright-MCP)
- [Deployment](docs/deployment.md) — Merge→Build→rsync→PM2, Host-Layout, Rollback
- [CI-Architektur](docs/ci-architecture.md) — Provider, Modelle, Soft-Abort, Label-Pipeline, KoliBri MCP
- [Pipeline-Flow](docs/pipeline-flow.md) — Diagramm + Tabellen zum label-getriebenen Ticket-Flows
- [Kosten-Baseline #912](docs/kosten-baseline-912.md) — Token/Kosten eines Tickets über alle Phasen
- [ADRs](docs/adr/) — verbindliche Grundsatzentscheidungen: [0001 Workflows ungetestet](docs/adr/0001-github-workflows-bleiben-ungetestet.md), [0002 7-Phasen-Pipeline](docs/adr/0002-pipeline-7-phasen-ux-vor-spec.md), [0003 Label-Schema](docs/adr/0003-label-schema-ai-needs-und-past.md), [0004 Analyse-getriebenes Routing](docs/adr/0004-analyse-getriebenes-routing.md), [0005 Fixup+Umsetzung = eine Phase](docs/adr/0005-fixup-und-umsetzung-sind-eine-phase.md), [0006 Issue-Storage = State-Branch (superseded)](docs/adr/0006-issue-storage-state-branch.md), [0007 Issue-Storage = Harness-Branch](docs/adr/0007-issue-storage-harness-branch.md)
- [Tailscale Exit Node](docs/tailscale-exit-node.md) — CI-Traffic über Tailscale-Exit-Node
- [UX-Pattern: Sequenzielle Bestätigung](docs/ux-pattern-sequential-confirmation.md) — verbindliche Referenz für destruktive Aktionen
- [Mobile-UI-Regeln](docs/mobile-ui-rules.md) — Daumen-Zonen, Touch-Targets, async Zustände, Anti-Patterns (Schwesterdatei: Cockpit-Design)

## Kernregeln

- **Kurz halten:** Antworten extrem knapp und präzise — keine unnötigen Erklärungen, Begründungen
  oder langen Code-Blöcke außer auf ausdrücklichen Wunsch. Keine Gedankengänge oder Live-Details
  während der Arbeit: Aufgaben still ausführen, am Ende nur das nackte Ergebnis. Output-Pflichten
  der Pipeline-Phasen (PR-Beschreibung, Job-Summary, Phasen-Notiz) bleiben unberührt.
- **Minimalprinzip:** Nur so viel programmieren, dokumentieren und testen wie wirklich notwendig
  — und so wenig wie irgend möglich; jede Zeile ist Wartungslast. Ein Test entsteht nur, wenn er etwas **auswertet**, einen **Spiegel** absichert
  oder vor **stillen/teuren** Ausfällen schützt
  ([TDD-Strategie → Testumfang](.ai-knowledge/tdd-strategy.md#testumfang--so-viel-wie-nötig-so-wenig-wie-irgend-möglich)).
- **Turns bündeln:** Erst kurz planen, dann gebündelt ausführen — jeder Turn reißt den Kontext
  erneut an den LLM (Cache-Read) und zählt im Abo als eigener Prompt. Mechanisch heißt das:
  unabhängige Lese-/Such-Schritte in **einem** Tool-Call statt fünf einzelnen, Shell-Befehle
  verketten statt sequenziell aufrufen, nichts erneut lesen, was schon im Kontext steht, und
  wiederholbare Prüfläufe (GATE, Tests, Linter) **einmal am Ende über alle Änderungen** fahren
  statt je Einzeländerung. Keine Bestätigungs-Rückfragen im Arbeitsfluss — der
  `needs-human`-Weg der Pipeline-Phasen bleibt davon unberührt.
  **Qualität geht vor:** Ein nachgebesserter Schritt kostet mehr Turns als ein gründlicher
  erster — eine Fixup-Schleife kostet ~50 Turns (gemessen: 51,5 = Fixup 36,3 + Re-Review 15,2,
  Quelle `.costs/`). Nie einen Prüfschritt überspringen, um Turns zu sparen: der Tausch geht
  immer zulasten des Kontingents.
- **Verbessern vs. Erweitern:** Soll Funktionierendes verbessert werden, zuerst fragen: Ist der
  Gewinn den zusätzlichen Code und seine Wartung wert — oder entsteht er durch Optimieren
  vorhandenen Codes? Neue Mechanismen nur, wenn kein bestehendes Muster passt.
  Beispiel: Der Push-Schalter flackerte beim Seitenwechsel, weil sein Zustand nur async ermittelbar
  war — behoben mit einem localStorage-Spiegel nach dem Muster der Nachbar-Switches
  (`frontend/src/lib/push.ts`, ~15 Zeilen am vorhandenen Hook statt eines neuen Mechanismus).
- **Muster-Treue:** Reproduktion, Erweiterung und Adaption setzen das vorhandene Muster einheitlich fort — gleiche Struktur, Namen, Ablagen und Style wie der Nachbar-Code ([Konventionen](.ai-knowledge/project.md#konventionen)). Kein zweites Muster für dasselbe Problem; wer bewusst abweicht, begründet es im PR und führt die Abweichung konsequent überall durch. Nur so bleiben Muster langfristig nachvollziehbar, pflegbar, review- und refaktorierbar.
- **KoliBri-First:** Komponenten nur selbst stylen, wenn keine KoliBri-Komponente passt
  (Shadow-Web-Components; Shadow-DOM-CSS ist unpublizierte API).
- **Schichten-Trennung Pipeline:** `.github/` orchestriert (Trigger, Gates, Label-Mechanik;
  Ein-/Ausgabeprotokoll der LLM-Läufe in `.github/prompts/`), `.claude/skills/` tragen die
  orchestrator-neutrale Rollen-Methode — dort gehören keine Workflow-Namen, `.github`-Pfade,
  VERDICT-Tokens, `{{Platzhalter}}` oder Laufzeit-Mechanik hinein. GitHub-Plattform-Vertrag
  (gh-Befehle, Label-Namen, HTML-Marker, Kommentarformate) bleibt im Skill.
- Monorepo mit **pnpm**; TypeScript `strict`, ESM überall, Node `>=26`.
- **ASCII in maschinen-gelesenen Feldern:** YAML-Frontmatter, Verdict-Zeilen, HTML-Marker und
  ähnliche strukturierte Felder ohne sprachspezifische Sonderzeichen/Umlaute halten — gemischte
  Anführungszeichen („"“/\") haben schon Parser gebrochen (Extension-Load, Verdict-Auswertung).
  Fließtext in Doku/Prompts bleibt unverändert Deutsch.
- `pnpm format` (Prettier, zentrale Root-Config) und `pnpm lint` — gezielt statt repo-weit:
  `pnpm --filter server build|lint`.
- **Nicht automatisch committen** ohne ausdrücklichen Wunsch. Ausnahme: die Ticket-Workflows
  ([Spec](.claude/skills/ticket-spec/SKILL.md), [Umsetzung](.claude/skills/ticket-implementation/SKILL.md) — beide
  Eingänge) committen, pushen und erstellen/aktualisieren PRs als ausdrücklichen Teil ihres Auftrags,
  inkl. eines etwaigen [Memory](#memory)-Eintrags im Phasen-Commit.
- Jeder PR führt `pnpm format`, `pnpm lint` **und `pnpm test`** aus (grün ist Pflicht,
  [TDD-Strategie](.ai-knowledge/tdd-strategy.md) Stufe 2) und dokumentiert die Ergebnisse in der
  PR-Beschreibung.

## Memory

`.ai-memory/` (nativer Claude-Code-Memory, `autoMemoryDirectory` in
[`.claude/settings.json`](.claude/settings.json)) hat zwei Ebenen:

| Datei                               | Lebensdauer                                                                                             | Zweck                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| [`MEMORY.md`](.ai-memory/MEMORY.md) | dauerhaft, eingecheckt                                                                                  | Erfahrungs-Log — derselbe Fehler kein zweites Mal     |
| `issue-<N>-<phase>.md`              | committet, reist im Harness-Branch `ai/harness/{N}` mit dem PR nach main; Hygiene-Sweep räumt Verwaiste | Soft-Abort-Resume eines Tickets: wo der Lauf aufhörte |

**Lesen:** immer beide, `MEMORY.md` zuerst — auch beim ersten Lauf an einem Ticket.

**Schreiben (nur `MEMORY.md`, Aufnahmekriterium streng — im Zweifel kein Eintrag):** nur was einen
zukünftigen Lauf an einem anderen Ticket vor demselben Fehler oder Umweg bewahrt:
nicht-offensichtliche Werkzeug-/CI-Eigenheiten, ein Befehl, der erst nach Fehlversuchen funktionierte.
Nicht hierher: Ticket-Spezifisches (→ Phasen-Notiz), in AGENTS.md/.ai-knowledge Stehendes,
Selbstverständliches, Erfolgsmeldungen. Die meisten Läufe schreiben **gar nichts** — Normalfall.

**Format:** eine Zeile `- YYYY-MM-DD · <Bereich> — <was schiefging> → <Lösung>.` ans Ende von
`## Learnings & Erfahrungen`. Bestehende Zeilen nie umschreiben oder umsortieren — die Datei mergt
per `union` ([`.gitattributes`](.gitattributes)), was nur bei reinem Anhängen konfliktfrei trägt;
Prettier fasst sie bewusst nicht an ([`.prettierignore`](.prettierignore)).

**Wer committet:** nur Phasen mit Commit-Auftrag (Spec, Umsetzung — beide Eingänge) im normalen
Phasen-Commit, kein eigener, kein Push auf `main`. Phasen ohne Branch (Triage, UX, Review) legen den
Kandidaten unter `## Fallstricke` ihrer Phasen-Notiz ab. Lokale Sessions dürfen anhängen, aber nicht
selbst committen — Eintrag vorschlagen, er reist mit dem nächsten regulären Commit mit.

**Kuratierung:** max. ~40 Einträge. Zur festen Regel Gewordenes nach
[Konventionen](.ai-knowledge/project.md#konventionen) überführen und die Zeile entfernen — MEMORY.md ist ein
Erfahrungs-Log, kein Regelwerk.

## KI-Pipeline (CI)

Sechs KI-gesteuerte Phasen über Claude Code in GitHub Actions: Triage → UX-Beratung → Spec →
Umsetzung (Erstumsetzung **und** Review-Nacharbeit, ADR 0005) → Review → PR-Documenter (nach dem
Merge). Gesteuert über die Label-Kette `ai:needs-*` → `ai:<Vergangenheitsform>`; Start immer manuell
durch `ai:needs-analyse`. Ablauf, Trigger, Info-Labels: [Pipeline-Flow](docs/pipeline-flow.md).
Provider, Modelle, Soft-Abort, MCP-Integration (KoliBri-MCP in allen Phasen außer Documenter,
Playwright-MCP in UX und Umsetzung): [CI-Architektur](docs/ci-architecture.md).

**Jede Phase liest nur ihren eigenen Phase-Skill** (siehe [Wissensbasis](#wissensbasis)) plus
das Issue/PR — kein domänenübergreifendes Lesen. Routing (Modell-Label `ai:model:*`, Spec-Skip)
entscheidet die Triage je Subtask im `KI-ANALYSE`-Block — Details:
[ADR 0004](docs/adr/0004-analyse-getriebenes-routing.md), [Triage-Skill](.claude/skills/ticket-triage/SKILL.md).

## Tests (Server)

Testkonzept: [docs/testing.md](docs/testing.md). `pnpm --filter server test` — node:test + tsx,
In-Memory-SQLite, Tests unter `server/src/**/*.test.ts`.

## Tests (Frontend)

`pnpm --filter frontend test` — Vitest + jsdom + Testing Library, Tests unter
`frontend/src/**/*.test.tsx`.

`pnpm --filter frontend test:e2e` — Playwright (nur Chromium), Specs unter `frontend/e2e/`, gegen
das **echte** Backend (temporäre In-Memory-DB, kein `page.route`-Mocking). Läuft **nicht** als Teil
von `pnpm test` — nur separat über `test:e2e`.
