# Priority Pilot

Priority Pilot ist ein Werkzeug zur **Aufgaben-Priorisierung**. Es beantwortet die Frage
_„Woran sollte ich als Nächstes arbeiten?"_, wenn Aufgaben voneinander abhängen und zugleich
auf unterschiedliche **Lebensbereiche** einzahlen.

Zwei Konzepte bestimmen die Priorität einer Aufgabe (Task):

- **Gewichteter Abhängigkeitsgraph:** Jede Abhängigkeit trägt ein Gewicht, das angibt, wie stark
  eine Aufgabe zu einer anderen beiträgt. Daraus berechnet Priority Pilot pro Aufgabe einen
  **Wertbeitrag** (eigene Priorität plus gewichtete Werte der abhängigen Aufgaben) und einen
  **Gesamtaufwand** inklusive aller (transitiven) Abhängigkeiten.
- **Lebensbalance-Säulen:** Jede Aufgabe zahlt auf **0..n** ihrer Lebensbalance-Säulen ein. Die
  Säulen sind **nutzerdefiniert**: Jede:r Nutzer:in legt eigene Säulen an, benennt und gewichtet
  sie. Neue Konten starten mit einem Default-Bestand von fünf Säulen
  (_Körper, Beziehungen, Sinn, Mentale Gesundheit, Wirksamkeit_), der frei bearbeitet, ergänzt und
  gelöscht werden kann. Pro Aufgabe wird der Investitions-Anteil zu 100 % auf ihre Säulen verteilt
  (`share`), je mit einer **Konfidenz** (`confidence`). Die Säulen tragen zusätzlich eine
  prozentuale Gewichtung (Summe 100 %), die den Wertbeitrag der Aufgaben **multiplikativ** skaliert.
  So lässt sich die Priorisierung gezielt auf die Lebensbereiche lenken, die gerade wichtig sind; bei
  Gleichverteilung (je 100/N % über die N Säulen des Nutzers) bleibt die Gewichtung neutral.

Damit lassen sich:

- die **wertvollsten Aufgaben** zuerst sichtbar machen (nach Wertbeitrag sortierter Aufgabenwald),
- die **nächste sinnvolle Aufgabe** finden (höchste Priorität, deren Abhängigkeiten alle erledigt sind),
- die Balance über die Lebensbereiche steuern, indem die **Säulen-Gewichtung** angepasst wird,
- Aufgaben und Abhängigkeiten pflegen — inklusive **Zyklus-Erkennung** (zyklische Abhängigkeiten
  werden abgelehnt).

Priority Pilot ist eine Full-Stack-Anwendung im pnpm-Monorepo: Ein Node.js-Backend
(Express + Sequelize/SQLite) stellt die REST-API bereit, ein React-Frontend (KoliBri, als PWA)
bedient sie. Der Funktionsumfang ist bewusst klein und befindet sich im Prototyp-Stadium.

## Monorepo-Aufbau

Verwaltet mit **pnpm Workspaces** (siehe [`pnpm-workspace.yaml`](pnpm-workspace.yaml)):

| Package                | Inhalt                                                              |
| ---------------------- | ------------------------------------------------------------------- |
| [`server`](server)     | Anwendung: Node.js + Express 5 + Sequelize 6 (SQLite). Fachlogik.   |
| [`client`](client)     | Aus `openapi.yml` generierte API-Typen (`openapi-typescript`).      |
| [`frontend`](frontend) | React 19 + KoliBri (Vite/PWA); ruft die API per `openapi-fetch` an. |

Jedes Paket hat eine eigene README mit Start/Build/Scripts:
[`server/README.md`](server/README.md), [`client/README.md`](client/README.md),
[`frontend/README.md`](frontend/README.md).

Der gemeinsame API-Vertrag liegt in [`openapi.yml`](openapi.yml). Daraus werden – ohne Java, nur
mit `openapi-typescript` – erzeugt:

- **Server:** `src/api.d.ts` via `openapi-typescript` (Build-Schritt `build:api`).
- **Client:** `src/schema.d.ts` via `openapi-typescript`; das Frontend konsumiert die Typen mit
  `openapi-fetch`.

## Maintenance & Backups

Priority-Pilot wird mit einem **nightly SQLite-Backup-Skript** ausgeliefert ([`maintenance.sh`](maintenance.sh)),
das die Datenbank (`database.sqlite`) automatisch sichert und alte Backups aufräumt.

**Funktionsumfang:**

- Datiertes Backup (`backups/database_YYYY-MM-DD_HH-MM-SS.sqlite`) via SQLite `.backup`
  (konsistent bei aktiven Zugriffen; benötigt die `sqlite3`-CLI)
- Datenbank-Pfad via `DATABASE_STORAGE` konfigurierbar (Default `./database.sqlite`, wird relativ
  zum Skript-Verzeichnis aufgelöst)
- Automatische Aufräumung von Backups älter als 30 Tage
- Robust via `set -euo pipefail` (sofortiger Abbruch bei Fehlern; Exit-Code 1, wenn die Datenbank fehlt)

**Cron-Beispiel (nightly 02:00 Uhr):**

```bash
0 2 * * * /path/to/priority-pilot/maintenance.sh
```

Das Skript kann aus beliebigem Verzeichnis aufgerufen werden; alle Pfade werden relativ zum Skript-Verzeichnis aufgelöst.
Die `backups/`-Dateien werden nicht versioniert (siehe [`.gitignore`](.gitignore)).

## Fachlogik (Server)

- **Modelle** ([`task.ts`](server/src/models/task.ts), [`pillar.ts`](server/src/models/pillar.ts),
  [`dependency.ts`](server/src/models/dependency.ts),
  [`taskPillar.ts`](server/src/models/taskPillar.ts)): `Task` (Titel, Status, Priorität,
  geschätzter/tatsächlicher Aufwand, Beschreibung, Deadline) mit einer `Task↔Task`-Beziehung
  (`weight` pro Abhängigkeit) sowie einer **n:m**-Beziehung zu `Pillar` (den
  **nutzerdefinierten, pro Nutzer verwalteten** Lebensbalance-Säulen — mit Kurzbeschreibung
  `description` und prozentualem `weight`; neue Konten starten mit fünf Default-Säulen) über die
  Join-Tabelle `task_pillars`, die je (Task, Säule)
  `share` (100 %-Verteilung pro Task) und `confidence` trägt.
- **Wertberechnung** ([`logics/value.ts`](server/src/logics/value.ts)): rekursiver, gewichteter
  Wertbeitrag eines Tasks aus seinen abhängigen Tasks plus eigener Priorität, anschließend
  **multiplikativ skaliert mit dem Säulen-Faktor**. Der Faktor mittelt über die Säulen-Beiträge des
  Tasks und interpoliert je Säule – gewichtet mit der Konfidenz – zwischen neutral (`1`) und dem
  vollen Faktor (`pillar.weight · N / 100`, wobei `N` die Anzahl der Säulen des Nutzers ist):
  `Σ (shareᵢ/100) · [1 + (confᵢ/100) · (weightᵢ·N/100 − 1)]`. Ohne Säule bleibt der Task neutral
  (`1`); eine einzelne Säule mit 100 % Anteil und Konfidenz 100 % ergibt genau
  `pillar.weight · N / 100`.
- **Aufgabenwald** ([`logics/tree.ts`](server/src/logics/tree.ts)): baut aus Wurzel-Tasks
  Bäume, summiert Aufwände inkl. Abhängigkeiten, sortiert nach Wert.
- **Nächste Aufgabe** ([`logics/find.ts`](server/src/logics/find.ts)): wichtigste Aufgabe,
  deren Abhängigkeiten alle `Done` sind.
- **Zyklus-Erkennung** ([`logics/cycle.ts`](server/src/logics/cycle.ts)): verhindert zyklische
  Abhängigkeiten; genutzt von der REST-API (Antwort `409`).
- **REST-API** ([`express/index.ts`](server/src/express/index.ts) mit den Routen unter
  [`express/routes/`](server/src/express/routes/)): stellt den unten beschriebenen API-Vertrag bereit
  (Tasks, Abhängigkeiten, Säulen, Aufgabenwald, nächste Aufgabe).

## Oberfläche (Frontend)

Das [`frontend`](frontend) ist eine installierbare PWA (React 19 + KoliBri) auf Basis derselben
REST-API. Es bietet:

- ein **Dashboard** mit Status-Kennzahlen, nächster Aufgabe, den wichtigsten Tasks (nach Wert),
  anstehenden Deadlines und dem Widget **„Meine Themen"** (je Säule Gewichtung sowie Anzahl,
  anteiliger Wert und Aufwand der einzahlenden Tasks),
- eine **Aufgabentabelle** zum Anlegen, Bearbeiten und Löschen von Tasks; im Task-Formular werden
  auch die **Säulen-Beiträge** (Anteil + Konfidenz je Säule) gepflegt,
- Dialoge zum Pflegen der **Abhängigkeiten** eines Tasks und zum Einstellen der **Säulen-Gewichtung**.

Bedienung und Dev-Server: [`frontend/README.md`](frontend/README.md).

## Voraussetzungen

- **Node.js** `>=26`
- **pnpm** `11` (siehe `packageManager`)

> Kein Java mehr nötig: Die Client-Generierung läuft seit der Umstellung auf `openapi-typescript`
> vollständig in JavaScript.

## Befehle (Repo-Root)

```bash
pnpm install        # Abhängigkeiten installieren
pnpm dev            # Frontend (Vite) + Backend (nodemon) parallel in einer Konsole
pnpm build          # Client generieren + Server bauen (alle Packages)
pnpm lint           # Lint über alle Packages
pnpm format         # Prettier über das gesamte Repo (eine zentrale Config)
pnpm update         # Dependencies via ncu auf latest + reinstall
```

`pnpm dev` startet beide Pakete gleichzeitig (`pnpm -r --parallel dev`); die Ausgaben werden je
Paket präfixt und `Ctrl+C` beendet beide Prozesse zusammen. Einzeln lassen sie sich weiterhin
gezielt starten:

Server gezielt:

```bash
pnpm --filter server build   # openapi-typescript + tsc
pnpm --filter server dev     # nodemon: build + run, Watch auf src/
pnpm --filter server lint    # api.d.ts + tsc --noemit + eslint
```

## Umgebungsvariablen (Server)

| Variable           | Default                | Wirkung                                                                       |
| ------------------ | ---------------------- | ----------------------------------------------------------------------------- |
| `PORT`             | `3000`                 | Port des Express-Servers.                                                     |
| `DB_RESET`         | `false`                | Bei `true` wird die SQLite-DB beim Start verworfen (`sync force`).            |
| `DB_SEED`          | `true`                 | Bei `false` werden keine Demo-Daten gesät (Säulen-Stammdaten bleiben).        |
| `DATABASE_STORAGE` | `./database.sqlite`    | Speicherort der SQLite-DB (`:memory:` für flüchtig).                          |
| `MISTRAL_API_KEY`  | –                      | API-Key für die Säulen-Klassifikation; ohne ihn antwortet der Endpoint `503`. |
| `MISTRAL_MODEL`    | `mistral-small-latest` | Optionales Mistral-Modell für die Klassifikation.                             |

> Ohne `DB_RESET=true` bleiben vorhandene Daten erhalten; Demo-Daten werden nur in eine
> leere Datenbank gesät.

## API

Der vollständige Vertrag steht in [`openapi.yml`](openapi.yml). Endpunkte: `GET`/`POST` `/tasks`,
`GET`/`PATCH`/`DELETE` `/tasks/{id}`, `POST` `/tasks/{id}/dependencies`,
`DELETE` `/tasks/{id}/dependencies/{depId}`, `GET /pillars` (Lebensbalance-Säulen inkl. Kurzbeschreibung),
`PUT /pillars/weights` (100 %-Gewichtung setzen), `GET /forest` (Aufgabenwald nach Wert) und
`GET /next` (nächste wichtige Aufgabe). Server und Vertrag laufen unter `http://localhost:3000`.

## Nutzerhandbuch

Eine vollständige Beschreibung aller Funktionen für Endnutzer:
[**docs/user-guide.md**](docs/user-guide.md)

## Deployment

Deployment auf einen dedizierten Server (Merge auf `main` → Build in GitHub Actions →
`rsync` der `dist`-Verzeichnisse auf den Host → Backend-Reload via PM2, Caddy davor):

- [`docs/operation-modes.md`](docs/operation-modes.md) — Betriebsarten: Cloud und Local (Übergangspfad, Kapazität).
- [`docs/deployment.md`](docs/deployment.md) — Konzept & Ablauf (Architektur, rsync + PM2, Rollback).
- [`docs/server-setup.md`](docs/server-setup.md) — Schritt-für-Schritt-Einrichtung des Linux-Servers.
- [`docs/caddy-setup.md`](docs/caddy-setup.md) — Caddyfile: Reverse-Proxy, SPA-Fallback, Pfad-Tabelle.
- [`docs/llm-providers.md`](docs/llm-providers.md) — LLM-Kaskade einrichten (Mistral → OpenRouter-Verfeinerung, ENV-Konfiguration).

## Mitwirken

Beiträge sind willkommen! Bitte lies vorab die [Beitragsrichtlinien](CONTRIBUTING.md) und den
[Verhaltenskodex](CODE_OF_CONDUCT.md). Sicherheitslücken bitte vertraulich melden – siehe
[SECURITY.md](SECURITY.md).

## Lizenz

Priority Pilot steht unter der **[European Union Public Licence v. 1.2 (EUPL-1.2)](LICENSE)**.
