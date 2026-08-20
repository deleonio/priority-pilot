# Browser-MCP — die laufende App visuell prüfen lassen

Claude Code arbeitet als Terminal-Agent im lokalen Code und hat von sich aus **keine** Sicht auf die
laufende Anwendung. Über den [Playwright-MCP-Server](https://github.com/microsoft/playwright-mcp)
bekommt der Agent „Augen": navigieren, Viewport/Gerät simulieren, Screenshot, Accessibility-Snapshot
(liest die KoliBri-Web-Components samt Shadow DOM strukturiert aus) — und korrigiert daraufhin direkt
die Quellen im Workspace.

> Der vielerorts verlinkte `@modelcontextprotocol/server-puppeteer` ist **archiviert und deprecated**
> (`modelcontextprotocol/servers-archived`). Wir nutzen `@playwright/mcp`, das ohnehin besser passt:
> Playwright ist im Frontend bereits Dependency, die Browser sind lokal installiert.

## Setup

Der Server ist in [`.mcp.json`](../.mcp.json) registriert (`playwright`, Version gepinnt) und in
[`.claude/settings.json`](../.claude/settings.json) über `enabledMcpjsonServers` freigeschaltet —
es ist nichts zu installieren. Prüfen:

```bash
claude mcp list      # playwright -> ✓ connected
```

Gewählte Flags und ihr Zweck:

| Flag                                      | Warum                                                                      |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| `--headless`                              | kein Fensterspringen; zum Zusehen die Flag entfernen (headed ist Default)  |
| `--isolated`                              | Profil nur im Speicher, jede Session startet sauber                        |
| `--viewport-size 1280,900`                | spiegelt das deterministische Viewport aus `frontend/playwright.config.ts` |
| `--allowed-origins localhost:4174;…:3001` | der Agenten-Browser kommt nur an die lokale App, nicht ins offene Netz     |
| `--output-dir .playwright-mcp`            | Screenshots/Traces gebündelt und gitignored                                |

## Anleitung — Schritt für Schritt

### 1. Inspect-Instanz starten (Terminal 1)

```bash
pnpm ui:inspect
```

Läuft, sobald dort steht: `Inspect-Instanz bereit: http://localhost:4174`.
Beenden mit **Ctrl+C** — das Skript räumt Backend und Vite selbst ab.

[`ui-inspect.sh`](../ui-inspect.sh) startet eine **wegwerfbare** Instanz: temporäre In-Memory-DB mit
Demo-Seed, Auth aus, kein LLM-Key. Die echte `database.sqlite` und die echten Keys bleiben unberührt
— der Agent darf also nach Herzenslust Aufgaben anlegen und löschen.

**Warum nicht einfach `pnpm dev`:** `server/.env` enthält echte Google-OAuth-Credentials, damit ist
`isAuthActive()` (`server/src/express/requireAuth.ts`) scharf und ein headless Browser sieht
ausschließlich die Login-Wand — den OAuth-Flow kann er nicht gehen.

### 2. Claude Code starten (Terminal 2)

```bash
claude
```

Beim ersten Start fragt Claude einmalig, ob der `playwright`-Server aus der `.mcp.json` benutzt
werden darf → bestätigen. Danach mit `/mcp` prüfen, dass `playwright` verbunden ist.

> Nur bei OpenRouter-Nutzung vorher in derselben Shell:
> `export ANTHROPIC_BASE_URL="https://openrouter.ai/api/anthropic"`

### 3. Den Agenten schauen lassen

Ganz normal im Prompt formulieren — Claude wählt die Browser-Tools selbst:

```text
Navigiere zu http://localhost:4174 und mach einen Screenshot.
```

Sinnvoll ist fast immer die Kombination aus **Screenshot** (wie sieht es aus) und
**Accessibility-Snapshot** (welche Elemente/Rollen/Namen gibt es — liest auch das Shadow DOM der
KoliBri-Komponenten). Der Agent kann außerdem klicken, tippen, scrollen, Viewport/Gerät wechseln
und die Browser-Konsole auslesen.

### 4. Iterieren

Typische Schleife: prüfen lassen → Befund → Claude ändert den Code → Vite lädt per HMR neu →
**erneut prüfen lassen**. Wichtig: explizit „lade die Seite neu und prüfe erneut" sagen, sonst
argumentiert der Agent gegen den alten Snapshot.

Was dauerhaft gelten soll, gehört danach als Spec nach `frontend/e2e/` — der Agentenblick ist die
Exploration, nicht die Absicherung.

### Portkarte

| Setup                             | Backend | Frontend |
| --------------------------------- | ------- | -------- |
| `pnpm dev`                        | 3000    | 5173     |
| `pnpm --filter frontend test:e2e` | 3000    | 4173     |
| `pnpm ui:inspect`                 | 3001    | 4174     |

Eigene Ports, damit die Inspect-Instanz neben normaler Entwicklung und E2E-Läufen bestehen kann.
Das Proxy-Ziel in `frontend/vite.config.ts` ist dafür über `API_PROXY_TARGET` umschaltbar (Default
unverändert 3000). Überschreibbar per `INSPECT_BACKEND_PORT` / `INSPECT_FRONTEND_PORT`.

## Beispiel-Prompts

> Navigiere zu http://localhost:4174, simuliere iPhone-15-Viewport, mach einen Screenshot und nimm
> einen a11y-Snapshot der Task-Karten. Erfüllen die Touch-Targets WCAG 2.1 AAA (44×44 px)? Wenn
> nicht, korrigiere den Code.

> Öffne http://localhost:4174, lege über die UI eine Aufgabe an und prüfe im a11y-Snapshot, ob der
> Fokus nach dem Schließen des Dialogs auf dem auslösenden Button landet.

> Vergleiche http://localhost:4174 in 375px- und 1280px-Breite per Screenshot — wo bricht das
> Layout?

## Fehlerbilder

| Symptom                                    | Ursache / Abhilfe                                                                                                                                                                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `FEHLER: Port 3001 ist bereits belegt`     | Instanz läuft noch — oder ein `nodemon`-Rest nach einem harten `kill -9` belegt den Port bei der nächsten Dateiänderung neu. Prüfen mit `lsof -i tcp:3001` und **den Elternprozess** (`ps -o ppid= -p <pid>`) mitbeenden |
| Agent sieht eine **Login-Seite**           | Es läuft die falsche Instanz (`pnpm dev` auf :5173) — die Inspect-URL ist **:4174**                                                                                                                                      |
| `playwright` fehlt unter `/mcp`            | Session vor der Registrierung gestartet → Claude neu starten und die `.mcp.json`-Freigabe bestätigen                                                                                                                     |
| Lektorat/Säulen-Vorschlag liefert **503**  | Beabsichtigt: `MISTRAL_API_KEY` ist geblankt, damit der Agent keine kostenpflichtigen Calls auslöst                                                                                                                      |
| Agent behauptet, eine Änderung wirke nicht | Er argumentiert gegen einen alten Snapshot → „Seite neu laden und erneut prüfen"                                                                                                                                         |

## Hinweise

- **Provider-Umschaltung** (`export ANTHROPIC_BASE_URL=…`) gehört in die Shell, nicht in
  `.claude/settings.json` — die bleibt bewusst providerneutral (siehe [AGENTS.md](../AGENTS.md)).
- **CI:** Playwright-MCP ist in den Phasen UX (02) und Umsetzung (04, beide Eingänge) via `browser-mcp: true`
  aktiv. Die Workflows installieren Chromium (cached, `pnpm --filter frontend exec playwright install --with-deps chromium`),
  bauen den Server vorab und starten die Inspect-Instanz im Hintergrund (`INSPECT_NO_WATCH=1 nohup ./ui-inspect.sh`
  mit Readiness-Check auf http://localhost:4174, Timeout 120s). Die anderen Phasen (01 Triage, 03 Spec, 05 Review)
  nutzen nur KoliBri-MCP; Documenter (06) hat keinen
  MCP-Zugang. Siehe [ci-architecture.md](ci-architecture.md).
- Der Agent ersetzt keine E2E-Tests: was dauerhaft gelten soll, gehört als Spec nach
  `frontend/e2e/` (siehe [TDD-Strategie](../.ai-knowledge/tdd-strategy.md)).
