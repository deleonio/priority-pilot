# Spec: Serienaufgaben über den MCP anlegen (#1938)

Status: rot (Spec-Phase) — Tests in `server/src/mcp/tools.test.ts` (Block „Serien (#1938)“).

## Ziel

Ein KI-Client legt über `task_create` wiederkehrende Aufgaben an und ändert deren Rhythmus über
`task_update`, ohne die GUI. Es kommt kein neues Werkzeug hinzu (Katalog bleibt bei 33 Namen).

## Vertrag

- `task_create` und `task_update` bekommen ein optionales Objekt `series`:
  `{ rhythm, startDate?, autoCreate? }`; `rhythm` ist das Enum der Serien-Rhythmen
  (`server/src/models/series.ts`: daily, weekly, monthly, weekdays, weekend, mon…sun, none).
- `task_create` mit `series`: ruft `POST /series` (Aufgabenfelder + Serienfelder) und danach
  `POST /series/:id/generate` für die fälligen Instanzen. Ohne `series` bleibt der Pfad
  `POST /tasks` unverändert (Einzelaufgabe, keine Serie).
- `task_update` mit `series`: hat die Aufgabe eine `seriesId`, geht die Änderung per
  `PATCH /series/:seriesId` an die Vorlage. Ohne `seriesId` Werkzeugfehler (kein nachträgliches
  Umwandeln einer Einzelaufgabe).
- Validierung bleibt serverseitig (`validateSeriesFields`); Fehler kommen als Werkzeugfehler an,
  es entsteht bzw. ändert sich nichts.
- Außerhalb des Umfangs: Ausnahmen (`isException`), Lösch-Kaskaden.

## Szenarien

1. `task_create` + `series: { rhythm: "daily", startDate: <heute> }` → genau eine Serie in
   `GET /series`, mindestens eine Instanz mit deren `seriesId`.
2. `task_create` ohne `series` → eine Aufgabe ohne `seriesId`, keine Serie.
3. `task_update` auf eine Serien-Instanz mit `series: { rhythm: "weekly" }` → `GET /series/:id`
   zeigt `weekly`.
4. Unbekannter `rhythm` bzw. `series` an einer Einzelaufgabe → Fehler, Bestand unverändert.
5. `tools/list`: `series` mit `rhythm`-Enum, `startDate`, `autoCreate` an beiden Werkzeugen;
   Beschreibungen nennen Serien.
