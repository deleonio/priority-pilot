# Priority Pilot — Architekturübersicht (arc42)

Diese Datei beschreibt den Ist-Zustand des Monorepos aus Entwicklersicht. Operating Details
(Rollout-Abfolge, Server-Setup) bleiben [deployment.md](deployment.md) und
[server-setup.md](server-setup.md) überlassen; Entscheidungen werden in [docs/adr/](adr/) begründet.

## 1. Einführung und Ziele

Priority Pilot ist eine Web-Anwendung zur persönlichen Aufgabenorganisation: Aufgaben (Tasks)
mit Abhängigkeiten, Deadlines und Prioritäten, Lebensbalance-Säulen mit Gewichtung und
Punkte-Konto (Gamification), wiederkehrende Aufgaben (Serien), Gruppen mit geteilten Tasks und
Serien, ortsbezogene Aufgaben („Nearby"), ÖPNV-Verbindungen (Bahn-Seite) und KI-Unterstützung
(Säulen-Klassifikation, Freitext-Parsing, Aktivitäten-Berater, Lektorat).

Das Repository ist ein pnpm-Monorepo mit drei Workspaces ([pnpm-workspace.yaml](../pnpm-workspace.yaml)):

- `client/` — aus `openapi.yml` generierte API-Typen, Build-Zeit-Abhängigkeit von Frontend und Server
- `frontend/` — React-SPA als installierbare PWA
- `server/` — Node.js-API-Server (Express) mit SQLite-Persistenz

### 1.1 Aufgabenverteilung (Entwicklung)

Jeder Beitrag läuft als Pull Request über die label-getriebene KI-Pipeline in GitHub Actions
(Triage, UX, Spec, Umsetzung, Review, Documenter; siehe [pipeline-flow.md](pipeline-flow.md)).
Menschliche Autorinnen und Autoren nutzen denselben PR-Weg; `main` ist der einzige langlebige Branch.

### 1.2 Qualitätsziele

| Priorität | Qualitätsziel | Szenario-Motiv                                                                                                     |
| --------- | ------------- | ------------------------------------------------------------------------------------------------------------------ |
| hoch      | #suitable     | Kernfachlichkeit: Tasks, Säulen, Serien, Gruppen bilden die vollständige Domäne ab (Server-Routen + `openapi.yml`) |
| hoch      | #secure       | Nur eingeloggte, auf der E-Mail-Allowlist stehende Nutzer erreichen die fachlichen Endpunkte                       |
| mittel    | #reliable     | Server bricht bei unbehebbaren Fehlern kontrolliert ab statt in undefiniertem Zustand weiterzulaufen               |
| mittel    | #usable       | Bedienung mobil-first über zugängliche KoliBri-Komponenten                                                         |
| mittel    | #operable     | Release ist ein reproduzierbarer Merge-Build mit `rsync` und `pm2 reload`                                          |

Messbare Schwellen aus dem Code (Testabdeckung, Rate-Limits) sind in Abschnitt 10 beschrieben.

## 2. Rahmenbedingungen

- **Laufzeit:** Node.js >= 26, pnpm als Paketmanager, TypeScript `strict`, ESM überall
  ([AGENTS.md](../AGENTS.md), [project.md](../.ai-knowledge/project.md)).
- **Lizenz:** EUPL-1.2 (Root-`package.json`).
- **UI-Vorgabe:** KoliBri-Web-Components (`@public-ui/*`) bevorzugt; eigenes Styling nur, wenn keine
  KoliBri-Komponente passt (Shadow-DOM-CSS gilt als unpublizierte API).
- **Mobile-First:** Die Bedienung zielt auf das Smartphone; Regeln in
  [mobile-ui-rules.md](mobile-ui-rules.md).
- **Externe Verträge:** Google-OAuth-Credentials (ENV), Nominatim-Nutzungsbedingungen
  (Rate-Limit 1 req/s, geteilter Limiter in `server/src/express/routes/geocodeRateLimit.ts`),
  Transitous/MOTIS-API (CORS erzwingt den Server-Proxy, `server/src/express/routes/transit.ts`),
  Web-Push mit eigenen VAPID-Keys.
- **Organisatorisch:** Die KI-Pipeline in `.github/workflows/` orchestriert Ticket-Arbeit; ihre
  Ausgaben leben im Harness-Kommentar des Issues bzw. als Workflow-Artefakt (ADR 0009, ADR 0010).

## 3. Kontextabgrenzung

```mermaid
graph LR
    Nutzer[Nutzer<br/>Browser / PWA] -->|HTTPS| Caddy
    Betreiber[Betreiber<br/>ssh + PM2] -->|betreibt| Caddy
    subgraph Host[Dedizierter Server]
        Caddy[Caddy, TLS] --> SPA[Priority Pilot SPA]
        Caddy -->|"/api/v1/* → strip"| API[Priority Pilot API]
        API --> DB[(SQLite)]
    end
    API -->|IF-02 OAuth| Google[Google]
    API -->|IF-03 Chat-Completions| LLM[Mistral / OpenRouter]
    API -->|IF-04 Geocoding| Nominatim[Nominatim]
    API -->|IF-05 Fahrplandaten| Transitous[Transitous / MOTIS]
    API -->|IF-06 Web-Push| Push[Push-Dienst des Browsers]
```

| ID    | Schnittstelle            | Teilnehmer                    | Bemerkung                                                                                                          |
| ----- | ------------------------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| IF-01 | REST-API (`openapi.yml`) | Frontend ↔ Server             | Vertrag mit generierten Typen (`client/`, `server/src/api.d.ts`); Caddy bzw. Vite-Proxy streifen `/api/v1` ab      |
| IF-02 | Google OAuth 2.0         | Server ↔ Google               | `passport-google-oauth20`, Login und stiller Login (`/auth/google`, `/auth/google/silent`)                         |
| IF-03 | LLM-Chat-Completions     | Server ↔ Mistral / OpenRouter | `server/src/llm/llm.ts`; aktiver Provider in der DB (`llm_providers`), Fix-Provider Mistral über `MISTRAL_API_KEY` |
| IF-04 | Geocoding                | Server ↔ Nominatim            | Forward- und Reverse-Geocoding, `server/src/logics/nominatim.ts`                                                   |
| IF-05 | Fahrplandaten            | Server ↔ Transitous           | reiner CORS-Proxy unter `/api/transit/*`, ohne Auth                                                                |
| IF-06 | Web-Push                 | Server ↔ Browser-Push-Dienst  | `web-push` mit VAPID-Keys, Subscriptions in `push_subscriptions`                                                   |

## 4. Lösungsstrategie

- **API-first:** `openapi.yml` ist der zentrale API-Vertrag; der Lektorat-Endpunkt liegt als
  bekannte Schuld noch außerhalb (s. §11). `pnpm build` generiert daraus Typen
  für `client/` (Frontend) und `server/src/api.d.ts`; das Frontend ruft die API typsicher mit
  `openapi-fetch` auf (`frontend/src/api.ts`). Der Server arbeitet mit denselben `components`-Typen.
- **Getrennte Zuständigkeiten im Server:** HTTP-Schicht (`server/src/express/`), Fachlogik
  (`server/src/logics/`), Persistenz (`server/src/models/`, Sequelize über SQLite), LLM-Anbindung
  (`server/src/llm/`), Hintergrundläufe (`server/src/scheduler/`). Testbare Abhängigkeiten
  (LLM-Aufrufe, Push-Versand, Session-Store) werden über `AppDeps` injiziert
  (`server/src/express/index.ts`).
- **SPA ohne Server-Rendering:** Das Frontend ist eine statische PWA (Vite, `vite-plugin-pwa`,
  Workbox). Auth-Zustand und Navigation laufen clientseitig (`frontend/src/Root.tsx`,
  `react-router-dom` in `frontend/src/App.tsx`); der App-State lebt in React-Hooks, ohne globales
  State-Framework.
- **UI über KoliBri:** `frontend/src/main.tsx` registriert `@public-ui/components` mit dem
  KERN-V2-Theme (Fallback Default-Theme). Die öffentliche Bahn-Seite nutzt bewusst native
  HTML-Elemente (`frontend/src/components/BahnPage.tsx`).
- **Sicherheit:** Google-OAuth-Login mit E-Mail-Allowlist, Session-Cookies (`httpOnly`,
  `SameSite=lax`, `Secure` in Produktion), CSRF-Schutz für schreibende Endpunkte in Produktion
  (`server/src/express/csrf.ts`), Rate-Limits für Auth- und Geocode-Routen.
- **Gamification als eigene Fachlogik:** Punktevergabe (`server/src/logics/score.ts`, getrennt vom
  Wertschöpfungs-Beitrag `value.ts`), Balance-Aggregation je Säule über `/scores/by-pillar`.

## 5. Bausteinsicht

### 5.1 Gesamtsystem (Whitebox gesamt)

```mermaid
graph TB
    subgraph Repo["pnpm-Monorepo"]
        client[client<br/>generierte API-Typen]
        frontend[frontend<br/>React-SPA, PWA]
        server[server<br/>Express-API]
    end
    openapi[openapi.yml<br/>API-Vertrag]
    ci[.github<br/>CI/CD-Pipeline]
    openapi --> client
    openapi --> server
    client --> frontend
    client --> server
    ci --> Repo
```

| Baustein      | Verantwortung                                 | Wichtige Dateien                                | Schnittstellen                           |
| ------------- | --------------------------------------------- | ----------------------------------------------- | ---------------------------------------- |
| `openapi.yml` | API-Vertrag: Pfade, Schemata                  | `openapi.yml`                                   | IF-01                                    |
| `client`      | generierte Typen (`paths`, `components`)      | `client/src/index.ts`, `client/src/schema.d.ts` | IF-01                                    |
| `frontend`    | SPA: Auth-Gate, App-Shell, Komponenten, PWA   | `frontend/src/`                                 | IF-01, IF-06                             |
| `server`      | Express-API, Fachlogik, Persistenz, Scheduler | `server/src/`                                   | IF-01, IF-02, IF-03, IF-04, IF-05, IF-06 |
| `.github`     | CI/CD: Pipeline-Phasen, Verify, Deploy        | `.github/workflows/`                            | —                                        |

### 5.2 Server (Whitebox `server`)

| Baustein     | Verantwortung                                                                | Wichtige Dateien                                                                                        |
| ------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `express/`   | Routen, Middleware, Fehlervertrag                                            | `index.ts` (App-Zusammenbau), `routes/*.ts`, `requireAuth.ts`, `csrf.ts`, `http-error.ts`, `session.ts` |
| `logics/`    | Fachlogik: Baum/Wert, Serien, Score, Push-Trigger, Geo, Migrationen          | `tree.ts`, `value.ts`, `score.ts`, `series.ts`, `push.ts`, `nominatim.ts`, `migrate.ts`                 |
| `models/`    | Sequelize-Modelle: User, Task, Pillar, Series, Group, PushSubscription u. a. | `task.ts`, `pillar.ts`, `series.ts`, `group.ts`, `llmProvider.ts`                                       |
| `llm/`       | Provider-unabhängige LLM-Aufrufe und Prompt-Logik                            | `llm.ts`, `llmProviders.ts`                                                                             |
| `scheduler/` | Intervall-Ticker für Push-Trigger                                            | `index.ts`                                                                                              |
| Start        | Bootstrap: Env, DB, Seed, Exit-Handler                                       | `index.ts`, `env.ts`, `database.ts`                                                                     |

Die Route-Mounts stehen in `server/src/express/index.ts`: öffentliche Routen (`/auth/*`, `/health`,
`/api/transit/*`, `/invite-links/{token}`) liegen vor `requireAuth`, alle fachlichen Endpunkte
danach hinter der Session-Pflicht.

### 5.3 Frontend (Whitebox `frontend`)

| Baustein      | Verantwortung                                                                                         | Wichtige Dateien                                                                   |
| ------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Einstieg      | KoliBri-Registrierung, Theme, Auth-Gate mit stillem Google-Login                                      | `main.tsx`, `Root.tsx`                                                             |
| `App.tsx`     | App-Shell, Tab- und Routensteuerung (`react-router-dom`)                                              | `App.tsx`                                                                          |
| `components/` | Seiten- und Dialogkomponenten (Dashboard, TaskTable, TaskTree, Groups, Series, Settings, BahnPage, …) | `frontend/src/components/`                                                         |
| `lib/`        | Fachliche Utilities und Hooks (Score, Forest, Push, Geolocation, Theme, Voice-Input)                  | `frontend/src/lib/`                                                                |
| `api.ts`      | Typsicherer API-Client auf `openapi-fetch`                                                            | `frontend/src/api.ts`                                                              |
| PWA           | Service Worker, Install-/Update-Prompts                                                               | `public/push-sw.js`, `components/InstallPrompt.tsx`, `components/UpdatePrompt.tsx` |

## 6. Laufzeitsicht

### 6.1 Login mit stillem Google-OAuth

```mermaid
sequenceDiagram
    participant B as Browser (Root.tsx)
    participant S as Server (/auth/*)
    participant G as Google
    B->>S: GET /auth/me (Session prüfen)
    S-->>B: 401, keine Session
    B->>S: GET /auth/google/silent (Top-Level-Redirect, prompt=none)
    S->>G: OAuth-Authorisierung
    G-->>S: Profil (E-Mail, Name, Avatar)
    S->>S: E-Mail-Allowlist prüfen, upsertOAuthUser()
    S-->>B: Session-Cookie, Redirect in App
    Note over B: Bei Fehlschlag einmalig Guards setzen<br/>und manuelle Login-Seite zeigen
```

Die Loop-Guards (`pp_silent_attempted`, `pp_just_logged_out`, `?silent=unavailable`) liegen in
`frontend/src/Root.tsx`. Ohne Google-Credentials zeigt der Server `/auth/test-login` (nicht in
Produktion, `server/src/express/routes/auth.ts`).

### 6.2 Task mit KI-Säulen-Klassifikation anlegen

```mermaid
sequenceDiagram
    participant B as Browser (TaskForm)
    participant S as Server (/tasks)
    participant L as LLM (Mistral/OpenRouter)
    participant DB as SQLite
    B->>S: POST /tasks/suggest-pillars {title, …}
    S->>L: Chat-Completions (Few-Shot-Prompt)
    L-->>S: Säulen-Vorschläge {pillarId, share, confidence}
    S->>S: Konfidenz deckeln, unbekannte pillarIds verwerfen
    S-->>B: Vorschlag zur Bestätigung
    B->>S: POST /tasks (inkl. bestätigter Säulen)
    S->>DB: Task + task_pillars-Einträge
    S-->>B: Task-DTO
```

Fehlt ein konfigurierter Provider oder Key, antworten die LLM-Routen mit HTTP 503
(`server/src/llm/llm.ts`). Der gleiche Weg gilt für `/tasks/parse-text` (Freitext-Parsing) und
`/pillars/advisor` (Aktivitäten-Berater).

### 6.3 Hintergrundläufe

Der Scheduler (`server/src/scheduler/index.ts`) prüft alle 15 Minuten, ob die konfigurierte
UTC-Stunde erreicht ist, und feuert jeden Trigger höchstens einmal pro Tag: fällige Aufgaben
(`dueTaskReminders`), die drei wichtigsten Aufgaben (`dailyTopTasksPush`). Beide laufen nur mit
Web-Push-Konfiguration und `PUSH_REMINDERS_ENABLED=true`. Die Deadline-Auto-Löschung
(`autoDeleteAfterDeadline`) läuft push-unabhängig und ist über
`AUTO_DELETE_AFTER_DEADLINE_ENABLED` abschaltbar; Serien-Instanzen materialisieren über
`POST /series/generate-all` (idempotent) statt über einen Scheduler.

## 7. Verteilungssicht

### 7.1 Entwicklung

`pnpm dev` startet Frontend und Server parallel: der Vite-Dev-Server leitet
(`/api/v1`, `/api/transit`, `/auth` → `http://localhost:3000`, `frontend/vite.config.ts`) an
den Express auf Port 3000 mit SQLite unter `server/database.sqlite` (`DATABASE_STORAGE`).
Die Typen aus `openapi.yml` erzeugt der `prepare`-Schritt bei der Installation und jeder Build.
Tests: `pnpm --filter server test` (node:test, In-Memory-SQLite), `pnpm --filter frontend test`
(Vitest + jsdom), `pnpm --filter frontend test:e2e` (Playwright, nur Chromium, gegen echtes Backend).

### 7.2 Produktion

```mermaid
graph TD
    subgraph GHA["GitHub Actions"]
        Build["pnpm -r build<br/>client → frontend → server"]
    end
    subgraph Host["Dedizierter Server"]
        Caddy[Caddy, TLS] --> SPA["frontend/dist (statische SPA)"]
        Caddy -->|"/api/v1/* → strip"| Node["node server/dist/index.js :3000"]
        Node --> SQLite[("data/database.sqlite<br/>vom rsync ausgenommen")]
        PM2[PM2] --- Node
    end
    Build -->|rsync dist| Caddy
    Build -->|ssh pm2 reload| PM2
```

Jeder Merge auf `main` baut in GitHub Actions und spiegelt die `dist`-Verzeichnisse per `rsync`
auf den Server; danach startet `pm2 reload priority-pilot` das Backend genau einmal neu
([deployment.md](deployment.md)). Der Session-Store ist in Produktion SQLite oder Redis
(`SESSION_STORE`, `server/src/express/session.ts`), der Frontend-Workspace `client` ist nur
Build-Zeit-Bestandteil und wird nicht ausgeliefert. Die Pipeline-Workflows (`.github/workflows/`)
laufen ausschließlich in GitHub Actions und berühren den Betriebshost nicht.

## 8. Querschnittliche Konzepte

- **Typsicherheit über die API-Grenze:** Ein Vertrag, zwei Generierungen (`client/` und
  `server/src/api.d.ts`); Abweichungen zwischen Vertrag und Routen scheitern beim Build
  (`pnpm build:api` in `server` lint und build).
- **Authentifizierung und Autorisierung:** Session-basiert (`express-session` + Passport nur als
  OAuth-Brücke); der User lebt in `req.session.user`, `requireAuth` schützt alle fachlichen Routen.
  Datenisolation je User prüfen eigene Testsuiten (`*-dataisolation.test.ts`); Gruppenrechte
  folgen der Membership in `group_members`, nicht einem Owner-Feld.
- **Fehlervertrag:** Handler antworten über `sendError` mit `{ message }` (`http-error.ts`);
  der globale Handler übersetzt Serverfehler (`server-error-handler.ts`), unbehandelte Fehler
  beenden den Prozess mit Exit-Code 1 (`server/src/index.ts`).
- **Injizierbare Abhängigkeiten:** `AppDeps` erlaubt Tests, LLM-, Push- und Session-Abhängigkeiten
  zu ersetzen, ohne den Netzwerkpfad zu berühren.
- **Rate-Limiting:** Auth-Routen mit eigenem Limiter, Geocode-Routen teilen sich einen
  1-req/s-Limiter je IP und Session (`geocodeRateLimit.ts`).
- **Datenbestand:** `sequelize.sync()` beim Start, danach idempotente Seeds (fünf feste
  Lebensbalance-Säulen als Stammdaten, Demo-Daten nur in leerer DB, abschaltbar mit `DB_SEED=false`)
  und Datenmigrationen (`server/src/logics/migrate.ts`).
- **Teststrategie:** Server-Tests erzwingen für `src/logics` 90 % Zeilen-, 85 % Branches- und
  85 % Functions-Abdeckung (`pnpm --filter server test:coverage`); E2E prüft Accessibility mit
  axe-core und seedet über die echte API.

## 9. Architekturentscheidungen

Die Begründungen stehen vollständig in [docs/adr/](adr/); hier nur der Verweis.

| ADR                                                     | Titel                                                 | Status                                         |
| ------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------- |
| [0001](adr/0001-github-workflows-bleiben-ungetestet.md) | GitHub-Workflows bleiben ungetestet                   | Akzeptiert                                     |
| [0002](adr/0002-pipeline-7-phasen-ux-vor-spec.md)       | Pipeline auf 7 sequenzielle Phasen (UX vor Spec)      | Akzeptiert; Phasenzahl überholt durch ADR 0005 |
| [0003](adr/0003-label-schema-ai-needs-und-past.md)      | Label-Schema `ai:needs-*` / `ai:<Vergangenheitsform>` | Akzeptiert                                     |
| [0004](adr/0004-analyse-getriebenes-routing.md)         | Analyse-getriebenes Routing statt starrer Phasenkette | Akzeptiert                                     |
| [0005](adr/0005-fixup-und-umsetzung-sind-eine-phase.md) | Fixup und Umsetzung sind eine Phase                   | Akzeptiert                                     |
| [0006](adr/0006-issue-storage-state-branch.md)          | Issue-Storage: State-Branch pro Issue                 | Ersetzt durch ADR 0007                         |
| [0007](adr/0007-issue-storage-harness-branch.md)        | Issue-Storage im Harness-Branch                       | Akzeptiert; Transport ersetzt durch ADR 0010   |
| [0008](adr/0008-delegation-und-mentor-eskalation.md)    | Delegation nach unten, Mentor nach oben               | Akzeptiert                                     |
| [0009](adr/0009-issue-storage-harness-kommentar.md)     | Phasen-Ausgaben im Harness-Kommentar                  | Akzeptiert                                     |
| [0010](adr/0010-issue-storage-workflow-artefakt.md)     | Phasen-Notizen als Workflow-Artefakt                  | Akzeptiert                                     |
| [0011](adr/0011-umsetzung-worktree-isolation.md)        | Worktree-Isolation für parallele Ticket-Läufe         | Vorgeschlagen                                  |

## 10. Qualitätsanforderungen

Jedes Szenario benennt eine im Code nachprüfbare Größe; Ziele ohne Code-Beleg sind nicht
dokumentiert.

| Q42-Eigenschaft | Szenarien    |
| --------------- | ------------ |
| `#suitable`     | QS-01, QS-02 |
| `#secure`       | QS-03, QS-04 |
| `#reliable`     | QS-05, QS-06 |
| `#usable`       | QS-07        |
| `#operable`     | QS-08        |

### QS-01 — Domäne vollständig über den Vertrag

- **Qualitätseigenschaft:** `#suitable` — Vollständigkeit
- **Szenario:** Jede fachliche Operation (Tasks, Säulen, Serien, Gruppen, Push, Geo, LLM-Funktionen)
  ist als Pfad in `openapi.yml` erfasst und über generierte Typen ansprechbar — mit Ausnahme des
  Lektorat-Endpunkts (`POST /lektorat`), der außerhalb des Vertrags liegt
  (`server/src/express/routes/lektorat.ts`).
- **Erfolgsmessung:** `pnpm build` scheitert, sobald Vertrag und generierte Typen auseinanderlaufen.

### QS-02 — fachliche Kernlogik abgedeckt

- **Qualitätseigenschaft:** `#suitable` — Korrektheit
- **Szenario:** Änderungen an der Fachlogik laufen gegen Tests, die die Regeln (Score, Baum, Serien,
  Zyklen) festhalten.
- **Erfolgsmessung:** `pnpm --filter server test:coverage` erzwingt in `src/logics` mindestens
  90 % Zeilen-, 85 % Branches- und 85 % Functions-Abdeckung.

### QS-03 — schreibende Zugriffe geschützt

- **Qualitätseigenschaft:** `#secure` — Zugriffsschutz
- **Szenario:** Ein Angreifer ruft in Produktion eine schreibende Route ohne CSRF-Token auf.
- **Erfolgsmessung:** `csrf.doubleCsrfProtection` lehnt die Anfrage ab; Token gibt nur
  `GET /auth/csrf` (`server/src/express/csrf.ts`).

### QS-04 — Registrierung nur für Bekannte

- **Qualitätseigenschaft:** `#secure` — Zugangsbeschränkung
- **Szenario:** Ein OAuth-Login mit E-Mail außerhalb der Allowlist.
- **Erfolgsmessung:** Die Strategie verwirft das Profil (`isEmailAllowed`); in Produktion ohne
  konfigurierte Allowlist startet der Server nicht (`getConfiguredEmails`).

### QS-05 — kontrollierter Abbruch

- **Qualitätseigenschaft:** `#reliable` — Fehlerverhalten
- **Szenario:** Ein unbehandelter Fehler oder eine unbehandelte Promise-Ablehnung tritt auf.
- **Erfolgsmessung:** Der Prozess loggt den Fehler und endet mit Exit-Code 1, doppelt ausgelöste
  Exits werden vom Guard verhindert (`handleUnhandledRejection`, `server/src/index.ts`).

### QS-06 — Liveness ohne Datenbank

- **Qualitätseigenschaft:** `#reliable` — Beobachtbarkeit
- **Szenario:** Monitoring fragt `GET /health` nach einem Deploy ab.
- **Erfolgsmessung:** Die Route antwortet mit `{ status: "ok" }`, ohne die Datenbank zu berühren
  (`server/src/express/index.ts`).

### QS-07 — zugängliche Bedienoberfläche

- **Qualitätseigenschaft:** `#usable` — Barrierefreiheit
- **Szenario:** Die Oberfläche wird mit Screenreader und Tastatur bedient.
- **Erfolgsmessung:** Interaktion läuft über KoliBri-Komponenten (BITV-orientiert); die E2E-Suite
  prüft die Seiten zusätzlich mit axe-core (`@axe-core/playwright`).

### QS-08 — reproduzierbares Release

- **Qualitätseigenschaft:** `#operable` — Deployment
- **Szenario:** Ein Merge auf `main` wird ausgeliefert.
- **Erfolgsmessung:** Der Ablauf ist ohne manuelle Schritte: Build in GitHub Actions, `rsync` der
  `dist`-Verzeichnisse, `pm2 reload priority-pilot` ([deployment.md](deployment.md)).

## 11. Risiken und technische Schulden

| Risiko / Schuld                                                                     | Auswirkung                                                                                                                 | Beleg                                                         |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Deployment ohne atomaren Switch: `rsync` spiegelt Dateien, während der Server läuft | Kurzzeitig teilgespiegelte Frontend-/Backend-Stände; kein Ein-Zeilen-Rollback                                              | bewusst akzeptiert, [deployment.md](deployment.md)            |
| Passport ist ein Modul-Singleton                                                    | Mehrere `createApp()`-Aufrufe im selben Prozess überschreiben die Google-Strategie; nur eine App-Konfiguration pro Prozess | Kommentar in `server/src/express/index.ts`                    |
| SQLite als Single-File-Store                                                        | Keine horizontale Skalierung; Betrieb auf genau einem Host ist dem Datenmodell eingeschrieben                              | `server/src/database.ts`                                      |
| `/api/v1`-Prefix wird an zwei Stellen gestreift                                     | Vite-Dev-Proxy und Caddy-Handle müssen dasselbe Strip-Verhalten nachführen                                                 | `frontend/vite.config.ts`, [server-setup.md](server-setup.md) |
| Legacy-Spaltenprüfung bei jedem Start                                               | `migrateLegacySinglePillar` liest per `PRAGMA` die `tasks`-Tabelle, solange `task_pillars` leer ist                        | `server/src/index.ts`                                         |
| Lektorat-Endpunkt fehlt im API-Vertrag                                              | `POST /lektorat` ist umgesetzt, aber nicht in `openapi.yml` erfasst; QS-01 gilt nur mit dieser Ausnahme                    | `server/src/express/routes/lektorat.ts`                       |

## 12. Glossar

| Begriff                       | Bedeutung                                                                                                                        |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Säule (Pillar)                | Lebensbereich (fünf feste Stammsäulen oder nutzerdefiniert), auf den Tasks anteilig „einzahlen"; Gewichtung als 100-%-Verteilung |
| Einzahlung (share/confidence) | Anteil eines Tasks an einer Säule mit Konfidenzwert; n:m über `task_pillars`                                                     |
| Aufgabenwald (Forest)         | Nach Wertschöpfung sortierter Task-Baum inklusive Abhängigkeiten; `GET /forest`, Aufbau in `server/src/logics/tree.ts`           |
| Serie (Habit)                 | Vorlage für wiederkehrende Aufgaben; fällige Instanzen werden idempotent materialisiert                                          |
| Balance                       | Aggregierte Punkte je Säule über `GET /scores/by-pillar`                                                                         |
| Gamification-Score            | Punkte beim Erledigen eines Tasks; pünktlich volle Punkte, verspätet mit Faktor 0,5 (`server/src/logics/score.ts`)               |
| Lektorat                      | KI-gestützte Textprüfung über `POST /lektorat` (bezahlte LLM-Kaskade)                                                            |
| Bahn-Seite                    | Öffentliche Verbindungs-Auskunft unter `/bahn` über den Transitous-Proxy                                                         |
| Harness-Kommentar             | Von der CI-Pipeline geführter Issue-Kommentar, in dem jede Phase ihre Ausgaben ablegt (ADR 0009)                                 |
| Silent Login                  | Stiller Google-OAuth-Versuch mit `prompt=none` beim App-Start (`frontend/src/Root.tsx`)                                          |
| VAPID                         | Schlüsselpaar für Web-Push; öffentlicher Teil über `GET /push/vapid-public-key`                                                  |
| Nearby                        | Ortsbezogene Tasks im Umfeld der gemeldeten Position (`GET /tasks/nearby`)                                                       |
