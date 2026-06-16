# Priority Pilot

Priority Pilot ist ein Werkzeug zur **Aufgaben-Priorisierung**. Es beantwortet die Frage
_„Woran sollte ich als Nächstes arbeiten?"_, wenn Aufgaben voneinander abhängen.

Aufgaben (Tasks) werden in einem **gewichteten Abhängigkeitsgraphen** modelliert: Jede
Abhängigkeit trägt ein Gewicht, das angibt, wie stark eine Aufgabe zu einer anderen
beiträgt. Daraus berechnet Priority Pilot pro Aufgabe einen **Wertbeitrag** (eigene
Priorität plus gewichtete Werte der abhängigen Aufgaben) und einen **Gesamtaufwand**
inklusive aller (transitiven) Abhängigkeiten.

Damit lassen sich:

- die **wertvollsten Aufgaben** zuerst sichtbar machen (nach Wertbeitrag sortierter Aufgabenwald),
- die **nächste sinnvolle Aufgabe** finden (höchste Priorität, deren Abhängigkeiten alle erledigt sind),
- Aufgaben und Abhängigkeiten pflegen — inklusive **Zyklus-Erkennung**.

Technisch ist es ein schlanker Node.js-Dienst (Express + Sequelize/SQLite) im
pnpm-Monorepo. Der Funktionsumfang ist bewusst klein und befindet sich im Prototyp-Stadium.

## Monorepo-Aufbau

Verwaltet mit **pnpm Workspaces** (siehe [`pnpm-workspace.yaml`](pnpm-workspace.yaml)):

| Package                | Inhalt                                                              |
| ---------------------- | ------------------------------------------------------------------- |
| [`server`](server)     | Anwendung: Node.js + Express 5 + Sequelize 6 (SQLite). Fachlogik.   |
| [`client`](client)     | Aus `openapi.yml` generierte API-Typen (`openapi-typescript`).      |
| [`frontend`](frontend) | React 19 + KoliBri (Vite/PWA); ruft die API per `openapi-fetch` an. |

Der gemeinsame API-Vertrag liegt in [`openapi.yml`](openapi.yml). Daraus werden – ohne Java, nur
mit `openapi-typescript` – erzeugt:

- **Server:** `src/api.d.ts` via `openapi-typescript` (Build-Schritt `build:api`).
- **Client:** `src/schema.d.ts` via `openapi-typescript`; das Frontend konsumiert die Typen mit
  `openapi-fetch`.

## Fachlogik (Server)

- **Modelle** ([`task.ts`](server/src/models/task.ts), [`dependency.ts`](server/src/models/dependency.ts)):
  `Task` mit Status/Priorität/Aufwand/Deadline und einer `Task↔Task`-Beziehung mit
  `weight` pro Abhängigkeit.
- **Wertberechnung** ([`logics/value.ts`](server/src/logics/value.ts)): rekursiver,
  gewichteter Wertbeitrag eines Tasks aus seinen abhängigen Tasks plus eigener Priorität.
- **Aufgabenwald** ([`logics/tree.ts`](server/src/logics/tree.ts)): baut aus Wurzel-Tasks
  Bäume, summiert Aufwände inkl. Abhängigkeiten, sortiert nach Wert.
- **Nächste Aufgabe** ([`logics/find.ts`](server/src/logics/find.ts)): wichtigste Aufgabe,
  deren Abhängigkeiten alle `Done` sind.
- **Interaktive Konsole** ([`console.ts`](server/src/console.ts)): Menü zum Pflegen von
  Tasks/Abhängigkeiten inkl. Zyklusprüfung (derzeit in `index.ts` nicht aktiviert).

## Voraussetzungen

- **Node.js** `>=22`
- **pnpm** `10` (siehe `packageManager`)

> Kein Java mehr nötig: Die Client-Generierung läuft seit der Umstellung auf `openapi-typescript`
> vollständig in JavaScript.

## Befehle (Repo-Root)

```bash
pnpm install        # Abhängigkeiten installieren
pnpm build          # Client generieren + Server bauen (alle Packages)
pnpm lint           # Lint über alle Packages
pnpm format         # Prettier über das gesamte Repo (eine zentrale Config)
pnpm update         # Dependencies via ncu auf latest + reinstall
```

Server gezielt:

```bash
pnpm --filter priority-pilot build   # openapi-typescript + tsc
pnpm --filter priority-pilot dev     # nodemon: build + run, Watch auf src/
pnpm --filter priority-pilot lint    # api.d.ts + tsc --noemit + eslint
```

## Umgebungsvariablen (Server)

| Variable   | Default | Wirkung                                                            |
| ---------- | ------- | ------------------------------------------------------------------ |
| `PORT`     | `3000`  | Port des Express-Servers.                                          |
| `DB_RESET` | `false` | Bei `true` wird die SQLite-DB beim Start verworfen (`sync force`). |

> Ohne `DB_RESET=true` bleiben vorhandene Daten erhalten; Demo-Daten werden nur in eine
> leere Datenbank gesät.

## API

Der vollständige Vertrag steht in [`openapi.yml`](openapi.yml). Endpunkte: `GET`/`POST` `/tasks`,
`GET`/`PATCH`/`DELETE` `/tasks/{id}`, `POST` `/tasks/{id}/dependencies`,
`DELETE` `/tasks/{id}/dependencies/{depId}`, `GET /forest` (Aufgabenwald nach Wert) und
`GET /next` (nächste wichtige Aufgabe). Server und Vertrag laufen unter `http://localhost:3000`.
