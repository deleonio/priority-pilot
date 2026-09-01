# Spec #1157 — Serien-Datenisolation (ownerScope im Serien-CRUD)

Status: rote Spec-Tests (Spec-Phase), Implementierung folgt.
Quelle: [Issue #1157](https://github.com/deleonio/priority-pilot/issues/1157) (KI-ANALYSE-Block, Ampel 🟢).

## Ziel

Die Serien-Routen (`server/src/express/routes/series.ts`) filtern aktuell nicht nach Eigentümer:
`GET /series`, `GET /series/:id`, `PATCH /series/:id`, `DELETE /series/:id` und
`POST /series/:id/generate` arbeiten auf allen Serien aller Nutzer. Im Auth-Modus soll jede
Nutzerin/jeder Nutzer nur die eigenen Serien sehen und bearbeiten — analog zum etablierten
`ownerScope(userId)`-Muster (`server/src/express/routes/tasks.ts` `findOwnTask`,
`server/src/express/routes/pillars.ts`).

## Vorbedingungen

- Auth-Modus aktiv (Test: `applyTestAuthEnv` + Test-Only-Login, Vorbild `pillars-dataisolation.test.ts`).
- Zwei Nutzer (alice, bob) mit jeweils mindestens einer eigenen Serie (angelegt über
  `POST /series` mit dem jeweiligen Session-Cookie — die Route schreibt `userId` aus der Session).
- `POST /series` und `POST /series/generate-all` sind bereits korrekt gescopet und bleiben unverändert.

## Verhalten (Schritte → erwartetes Ergebnis)

1. `GET /api/series` mit Session von Nutzer A → 200; die Liste enthält **nur** die von A
   angelegten Serien (IDs der Serien von B fehlen). Ohne Auth (Pass-Through-Modus, leerer
   Scope) bleibt die Liste wie bisher ungefiltert — bestehende Tests ohne Auth
   (`series.api.test.ts`) decken das ab und müssen grün bleiben.
2. `GET /api/series/:id`, `PATCH /api/series/:id`, `DELETE /api/series/:id` und
   `POST /api/series/:id/generate` mit der Serien-ID von Nutzer B und der Session von
   Nutzer A → jeweils **404** (wie bei Tasks/Pillars: fremde Ressource ist nicht auffindbar,
   kein 403). Mit der eigenen Serie antworten die Routen weiterhin erfolgreich
   (200/200/204/201) — kein versehentliches Über-Scoping.
3. Pass-Through-Modus (ohne Auth): `ownerScope(undefined)` liefert `{}` → kein Filter,
   Verhalten unverändert. Absicherung über die bestehenden Unauth-Suiten, kein eigener Test.

## Akzeptanzkriterien → Test-Abdeckung

| AK                                                     | Test                                                                                                       |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| AK1: GET /series liefert mit Session nur eigene Serien | `server/src/express/series-dataisolation.test.ts` — zwei Sessions, je eigene Serie, Assert: nur eigene IDs |
| AK2: GET/PATCH/DELETE/generate auf fremde Serie → 404  | gleiche Datei — je Methode 404 auf fremder ID + Positivfall eigene ID                                      |
| AK3: Suite grün, bestehende Suiten bleiben grün        | Nachweis per Lauf; kein eigener Testfall                                                                   |

## Abgrenzungen

- `POST /series` (schreibt `userId` aus der Session) und `POST /series/generate-all`
  (gescopetes `materializeDueSeries`) sind nicht Teil der Änderung.
- Kein 403-Kontrakt: fremde IDs verhalten sich wie unbekannte IDs (404).
