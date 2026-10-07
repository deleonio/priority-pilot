# Fachlogik-Inventar (REST, MCP, Jobs)

Stand 2026-10-07 (#1934). Erfasst jede Fachlogik, die von mehr als einem Zugang genutzt wird:
REST-Route (`server/src/express/routes/`), MCP-Werkzeug (`server/src/mcp/tools.ts`, ruft die Routen
per Loopback `callApi`) oder Job (`server/src/logics/`, Start in `server/src/index.ts`). Die Regel für
neue Fachlogik steht in den [Konventionen](../.ai-knowledge/project.md#konventionen).

Befund: **doppelt** (gleiche Logik an mehreren Orten), **abweichend** (ein Zugang rechnet anders oder
ergänzt eigene Regeln), **bereits zentral** (ein Logik-Modul, alle Zugänge rufen es auf).

| Fachlogik                      | Fundorte                                                                                                                                                                                                  | Befund          | Zielpfad                                                         |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ---------------------------------------------------------------- |
| MCP-Serien-Anlage              | MCP `task_create` mit `series`: ein Loopback-Aufruf `POST /series`; Defaults und erste Instanzen liefert `routes/series.ts`                                                                               | bereits zentral | —                                                                |
| Generierungshorizont           | `now + GENERATE_HORIZON_DAYS` dreifach berechnet: `mcp/tools.ts:399-400`, `routes/series.ts:531-532` (`generate-all`), Job `logics/seriesAutoCreate.ts:10-11`; Konstante zentral in `logics/series.ts:22` | doppelt         | Logik-Modul `logics/series.ts` (Funktion für das Horizont-Datum) |
| Entfernung auf 0,1 km gerundet | Route `GET /tasks/nearby` (`routes/tasks.ts:680`), Job `logics/geo-background-job.ts:88`: je `Math.round(haversineKm(…) * 10) / 10`                                                                       | doppelt         | Logik-Modul `logics/geo.ts`                                      |
| Abstand (Haversine)            | `logics/geo.ts:5` `haversineKm`, genutzt von `routes/tasks.ts:680` und `logics/geo-background-job.ts:88`                                                                                                  | bereits zentral | —                                                                |
| Serien-Instanzen erzeugen      | `logics/series.ts:291` `generateDueInstances`, `:366` `materializeDueSeries`; Route `routes/series.ts:814` (MCP per Loopback), `routes/series.ts:533`, Job `logics/seriesAutoCreate.ts`                   | bereits zentral | —                                                                |
| Punkte beim Erledigen          | `logics/score.ts:30` `berechneScore`, genutzt von `routes/tasks.ts:573,589` (MCP per Loopback)                                                                                                            | bereits zentral | —                                                                |
| Eigentümer-Filter              | `logics/ownerScope.ts:6` `ownerScope`, genutzt von `logics/push.ts:95,105` und `logics/milestones.ts:72`; Aufgaben-Lesescope `taskReadScope` nur in `routes/tasks.ts:310`                                 | bereits zentral | —                                                                |
| Fällige-Aufgaben-Erinnerung    | `logics/dueTaskReminders.ts:36` `collectDueTaskReminders`, `:91` `runDueTaskReminders`; Start `server/src/index.ts:150`                                                                                   | bereits zentral | —                                                                |

Übrige MCP-Werkzeuge reichen ihre Eingaben unverändert an genau eine Route durch (`callApi`,
`mcp/tools.ts:79`) und enthalten keine eigene Fachlogik.

## Folge-Ticket-Vorschläge (Sub-Issues unter #2020)

1. ~~**Server: MCP-Serien-Anlage in die REST-Route verlegen**~~ (erledigt, #2404) — `POST /series` legt die Serie mit den
   Task-Defaults an und erzeugt die ersten Instanzen selbst; `task_create` mit `series` wird zum
   einzelnen Loopback-Aufruf.
2. **Server: Generierungshorizont an einer Stelle berechnen** — `logics/series.ts` liefert das
   Horizont-Datum, Route `generate-all`, Job `seriesAutoCreate` und (bis Vorschlag 1 umgesetzt ist)
   MCP rufen diese Funktion statt `GENERATE_HORIZON_DAYS` selbst zu addieren.
3. **Server: gerundete Entfernung zentral in `logics/geo.ts`** — eine Funktion liefert die auf 0,1 km
   gerundete Entfernung; `GET /tasks/nearby` und `geo-background-job` nutzen sie.
