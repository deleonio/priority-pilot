# Priority Pilot

Priority Pilot ist ein Werkzeug zur **Aufgaben-Priorisierung**. Es beantwortet die Frage
_„Woran sollte ich als Nächstes arbeiten?"_, wenn Aufgaben voneinander abhängen und zugleich
auf unterschiedliche **Lebensbereiche** einzahlen.

Zwei Konzepte bestimmen die Priorität einer Aufgabe (Task):

- **Gewichteter Abhängigkeitsgraph:** Jede Abhängigkeit trägt ein Gewicht, das angibt, wie stark
  eine Aufgabe zu einer anderen beiträgt. Daraus berechnet Priority Pilot pro Aufgabe einen
  **Wertbeitrag** (eigene Priorität plus gewichtete Werte der abhängigen Aufgaben) und einen
  **Gesamtaufwand** inklusive aller (transitiven) Abhängigkeiten.
- **Lebensbalance-Säulen:** Jede Aufgabe lässt sich einer von fünf festen Säulen zuordnen
  (_Körper, Beziehungen, Sinn, Mentale Gesundheit, Wirksamkeit_). Die Säulen tragen eine
  prozentuale Gewichtung (Summe 100 %), die den Wertbeitrag ihrer Aufgaben **multiplikativ**
  skaliert. So lässt sich die Priorisierung gezielt auf die Lebensbereiche lenken, die gerade
  wichtig sind; bei Gleichverteilung (je 20 %) bleibt die Gewichtung neutral.

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

Der gemeinsame API-Vertrag liegt in [`openapi.yml`](openapi.yml). Daraus werden – ohne Java, nur
mit `openapi-typescript` – erzeugt:

- **Server:** `src/api.d.ts` via `openapi-typescript` (Build-Schritt `build:api`).
- **Client:** `src/schema.d.ts` via `openapi-typescript`; das Frontend konsumiert die Typen mit
  `openapi-fetch`.

## Fachlogik (Server)

- **Modelle** ([`task.ts`](server/src/models/task.ts), [`pillar.ts`](server/src/models/pillar.ts),
  [`dependency.ts`](server/src/models/dependency.ts)): `Task` (Titel, Status, Priorität,
  geschätzter/tatsächlicher Aufwand, Beschreibung, Deadline, optionale Säule) mit einer
  `Task↔Task`-Beziehung (`weight` pro Abhängigkeit) sowie einer optionalen Zuordnung zu einer
  `Pillar` (Lebensbalance-Säule mit prozentualem `weight`).
- **Wertberechnung** ([`logics/value.ts`](server/src/logics/value.ts)): rekursiver, gewichteter
  Wertbeitrag eines Tasks aus seinen abhängigen Tasks plus eigener Priorität, anschließend
  **multiplikativ skaliert mit dem Säulen-Faktor** (`pillar.weight / 20`; ohne Säule neutral `1`).
- **Aufgabenwald** ([`logics/tree.ts`](server/src/logics/tree.ts)): baut aus Wurzel-Tasks
  Bäume, summiert Aufwände inkl. Abhängigkeiten, sortiert nach Wert.
- **Nächste Aufgabe** ([`logics/find.ts`](server/src/logics/find.ts)): wichtigste Aufgabe,
  deren Abhängigkeiten alle `Done` sind.
- **Zyklus-Erkennung** ([`logics/cycle.ts`](server/src/logics/cycle.ts)): verhindert zyklische
  Abhängigkeiten; genutzt von der REST-API (Antwort `409`) und der Konsole.
- **REST-API** ([`express/index.ts`](server/src/express/index.ts) mit den Routen unter
  [`express/routes/`](server/src/express/routes/)): stellt den unten beschriebenen API-Vertrag bereit
  (Tasks, Abhängigkeiten, Säulen, Aufgabenwald, nächste Aufgabe).
- **Interaktive Konsole** ([`console.ts`](server/src/console.ts)): alternatives Menü zum Pflegen von
  Tasks/Abhängigkeiten (derzeit in `index.ts` nicht aktiviert).

## Oberfläche (Frontend)

Das [`frontend`](frontend) ist eine installierbare PWA (React 19 + KoliBri) auf Basis derselben
REST-API. Es bietet:

- ein **Dashboard** mit Status-Kennzahlen, nächster Aufgabe, den wichtigsten Tasks (nach Wert),
  anstehenden Deadlines und dem Widget **„Meine Themen"** (je Säule Gewichtung, Anzahl, Wert und Aufwand),
- eine **Aufgabentabelle** zum Anlegen, Bearbeiten und Löschen von Tasks,
- Dialoge zum Pflegen der **Abhängigkeiten** eines Tasks und zum Einstellen der **Säulen-Gewichtung**.

Bedienung und Dev-Server: [`frontend/README.md`](frontend/README.md).

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
`DELETE` `/tasks/{id}/dependencies/{depId}`, `GET /pillars` (Lebensbalance-Säulen),
`PUT /pillars/weights` (100 %-Gewichtung setzen), `GET /forest` (Aufgabenwald nach Wert) und
`GET /next` (nächste wichtige Aufgabe). Server und Vertrag laufen unter `http://localhost:3000`.
