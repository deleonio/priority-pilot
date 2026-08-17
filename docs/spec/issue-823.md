# Spec: Issue 823 – KoliBri-MCP + Playwright-Layout Integration

## Ziel

KoliBri-Komponenten-Nutzung und Layout-Verifikation in allen CI-Phasen erzwingen durch MCP-Tool-Integration und Prompt-Anweisungen.

## Vorbedingung

- MCP-Server `kolibri-mcp` ist in `.mcp.json` registriert (HTTP)
- Playwright-MCP ist in `.mcp.json` konfiguriert (@playwright/mcp@0.0.79, allowed-origins: localhost:4174;3001)
- `.claude/settings.json` hat `enabledMcpjsonServers: ["kolibri-mcp", "playwright"]`

## Schritte

### A. CI-Wiring (.github/actions/setup-claude/action.yml)

1. **Neuer Input `browser-mcp`** (default: false)
   - Bei `true`: Playwright-MCP-Tools (`mcp__playwright__*`) zur Allowlist aller Tiers hinzufügen
   - Input-Beschreibungen aktualisieren: `needs-mcp` gilt künftig für alle Phasen außer 06
2. **Input-Mappings für Workflows**:
   - `needs-mcp: true` für alle Phasen 01–05
   - `browser-mcp: true` nur für 02b, 03, 05

### B. Workflows (.github/workflows/)

1. **01-claude-triage.yml**: `needs-mcp: true` (bleibt)
2. **02-claude-spec.yml**: `needs-mcp: true`
3. **02b-claude-ux.yml**: `needs-mcp: true`, `browser-mcp: true`
4. **03-claude-implementation.yml**: `needs-mcp: true`, `browser-mcp: true`
5. **04-claude-pr-review.yml**: `needs-mcp: true` (KEIN browser-mcp)
6. **05-claude-pr-fixup.yml**: `needs-mcp: true`, `browser-mcp: true`
7. **06-documenter.yml**: unverändert (kein MCP)

### C. Chromium + Hintergrund-App (02b/03/05)

Je nach Workflow nach `pnpm install` einfügen:

1. **Cache**: `actions/cache@v4` für `~/.cache/ms-playwright`
2. **Install**: `pnpm --filter frontend exec playwright install --with-deps chromium`
3. **Hintergrund-App**: `nohup ./ui-inspect.sh > /tmp/ui-inspect.log 2>&1 &`
4. **Readiness-Check**: Warte-Schleife auf `http://localhost:4174` (curl, Timeout 120s)
5. **Cleanup**: Runner killt Prozess; `ui-inspect.sh` hat trap für eigenen Cleanup

### D. Prompt-Updates

#### 01 Triage (Heredoc)

- Bei UI-Bezug im Lösungsvorschlag: konkrete KoliBri-Komponenten via `mcp__kolibri-mcp__search/fetch` ermitteln und nennen

#### spec.md (Schritt 4)

- Bei UI-Tickets: geplante KoliBri-Komponenten (Custom-Element + Properties) via KoliBri-MCP verifizieren

#### ux.md (neuer Schritt vor Schritt 4)

- **Ist-UI-Inspektion** via Playwright-MCP:
  - `browser_navigate http://localhost:4174`
  - Screenshot + Accessibility-Snapshot
  - `browser_resize` auf 375×812 und 1280×900
- **KoliBri-Abschnitt**: Component-Wahl via KoliBri-MCP prüfen

#### 03 Umsetzung (Heredoc, neuer Block "UI-ARBEITEN bei Frontend-Änderungen")

1. **KoliBri-First**: passende Komponente via `mcp__kolibri-mcp__search/fetch` finden und einsetzen
   - Eigene Komponenten nur stylen/bauen, wenn KEINE KoliBri-Komponente passt
   - Begründung im PR-Body (KoliBri = Shadow-Web-Components mit festem Styling)
2. **Layout**: App läuft im Hintergrund auf `:4174`; sichtbare Änderungen per Playwright-MCP bei 375px UND 1280px prüfen
   - Screenshot + A11y-Snapshot
   - Layout-Brüche (horizontales Scrollen/Overflow) fixen

#### 04 Review (Heredoc, neues Kreuzverhör-Kriterium)

- **KoliBri-First eingehalten?** Eigenes Styling ohne KoliBri-Alternative = Finding
- Im Zweifel via `mcp__kolibri-mcp__search` nach Alternativen suchen
- Fehlende Begründung der Eigene-Styling-Entscheidung im PR-Body = Finding

#### 05 Fixup (Heredoc)

- **UI-ARBEITEN-Block** wie 03: Layout-Findings per Playwright fixen

### E. KoliBri-First-Regel verankern

1. **.ai-knowledge/conventions.md**: Neue Regel "KoliBri-First"
   - Komponenten nur selbst stylen, wenn keine KoliBri-Komponente anwendbar
   - Shadow-Web-Components sind fest gestylt; Shadow-DOM-CSS ist unpublizierte API
2. **AGENTS.md**: 1 Kernregel-Zeile KoliBri-First + CI-Absatz (MCP-Server in allen Phasen außer Documenter; UX/Umsetzung/Fixup mit Browser)
3. **.ai-knowledge/ticket-implementation.md, ticket-ux.md, pr-review.md**: Kurze Synchron-Ergänzungen zu den Prompts

### F. Doku-Korrekturen

1. **docs/ci-architecture.md**:
   - Server-Namen korrigieren: `kolibri-mcp` / `mcp__kolibri-mcp__*`
   - Phasenumfang aktualisieren: MCP-Server in allen Phasen außer 06
   - Neuer Absatz zu Playwright-MCP + ui-inspect.sh-Hintergrundbetrieb
2. **docs/browser-mcp.md** (CI-Abschnitt ~:124):
   - Lücke ist für 02b/03/05 geschlossen
   - 01/02/04 nur KoliBri-MCP; 06 keins

## Erwartetes Ergebnis

### CI-Verifikation (Akzeptanzkriterien 1–2)

1. `needs-mcp` in 01–05 `true`, 06 `false`; `browser-mcp`-Input existiert und ist in 02b/03/05 `true`
2. 02b/03/05 installieren Chromium (cached) und starten `ui-inspect.sh` im Hintergrund mit Readiness-Check (hartes Fail bei Timeout)

### Prompt-Verifikation (AK 3)

Alle 6 Phasen-Prompts (außer 06) weisen KoliBri-MCP an; ux/03/05 zusätzlich Playwright-Layout-Prüfung mit 375px- und 1280px-Viewport

### Regel-Verifikation (AK 4)

KoliBri-First-Regel steht in `conventions.md`, `AGENTS.md` und den drei Wissensbasis-Dateien

### Doku-Verifikation (AK 5)

`ci-architecture.md` + `browser-mcp.md` sind driftfrei (Server-Namen, Phasenumfang)

### YAML-Integrität (AK 6)

YAML aller geänderten Dateien parst (yq/actionlint); `pnpm format + pnpm lint + pnpm test` grün

### Live-Test (AK 7)

Nach Merge: ein Live-Lauf (z. B. workflow_dispatch UX auf einem UI-Bezugs-Issue) zeigt im Log Chromium-Install + "Inspect-Instanz bereit" + MCP-Tool-Nutzung im Claude-Output

## Carve-Out (keine Tests)

Laut ADR 0001: keine Tests für Workflows/Config/Markdown. Stattdessen im PR-Body jedes Akzeptanzkriterium mit Zitat/Link belegen.
