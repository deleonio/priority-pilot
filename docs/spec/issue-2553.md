# Spec: Koordinaten-Parsing konsolidieren — `parseCoordinate` (#2553)

## Ziel

Drei Routen parsen Koordinaten heute je eigenen Code mit abweichender Strenge: `POST /geo/position`
akzeptiert nur JSON-Zahlen, `GET /tasks/nearby` koerziert Query-Strings, `POST /place-favorites`
prüft nur Endlichkeit (Bereichsüberschreiter wie `999` werden still gespeichert). Konsolidierung
auf genau einen Helfer in `server/src/logics/geo.ts` — dieselbe „eine Wahrheit“-Bewegung wie damals
für die Distanzberechnung (`roundedDistanceKm`).

## Helfer-Vertrag (`server/src/logics/geo.ts`)

`parseCoordinate(value: unknown, limit: number): number | null`

- Akzeptiert endliche Zahlen **und** numerische, getrimmte, nicht-leere Strings
  (Query-Parameter kommen immer als String) → gibt die Zahl zurück.
- Erzwingt den Bereich `[-limit, limit]` — `limit` ist 90 für Breite, 180 für Länge; außerhalb → `null`.
- Sonst `null`: Leerstring, nicht-numerischer String (`"abc"`), `null`, `undefined`, `NaN`,
  `Infinity`, Arrays, Objekte.
- Die `Number('') === 0`-Falle (#1101 F1) bleibt abgedeckt: leerer String ist nie 0, sondern `null`.

## Routen-Verhalten

- **POST /geo/position** (`geoConfig.ts`): lat/lon sind Pflicht — `null` (auch aus `"abc"`, `""`,
  Arrays) → 400; gültiges Paar → 204 (Fire-and-forget, kein Body). Numerische Strings sind mit dem
  einheitlichen Helfer jetzt ebenfalls gültig.
- **GET /tasks/nearby** (`tasks.ts`): Query `lat`/`lon` sind Pflicht — `null` → 400 (u. a. `lat=abc`,
  `lat=999`, `lat=`, `lat` als Array); `?lat=52.5&lon=13.4` bleibt gültig (String-Koersion erhalten).
- **POST /place-favorites** (`placeFavorites.ts`): abwesende Koordinaten bleiben `null` gespeichert
  (201, #1342 AK4: Freitext-Ort ohne Geocoding-Treffer); **anwesende ungültige** Werte
  (`latitude: 999`, `latitude: "abc"`) → 400 statt still gespeichert/genullt. Einziges beobachtbares
  Verhaltensänderung dieses Tickets. Duplikat-/Idempotenz-Pfad (#1595 AK4) unberührt.

## Testfälle je AK

| AK  | Datei                                        | Fälle                                                                                                                                                                               |
| --- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AK1 | `server/src/express/geo-config.test.ts`      | Ergänzung der Nicht-Zahl-Tabelle um `""` und Array → 400; numerisches String-Paar → 204; bestehende Bereichs-/204-Tests decken den Rest ab                                          |
| AK2 | `server/src/express/tasks-nearby.test.ts`    | `lat=abc`, `lat=999`, `lat=` (leer), `lat` als Array → 400; `?lat=52.5&lon=13.4` (Strings) → 200                                                                                    |
| AK3 | `server/src/express/place-favorites.test.ts` | ohne Koordinaten → 201 mit `latitude`/`longitude: null`; `latitude: 999` → 400; `latitude: "abc"` → 400 (rot bis zur Umsetzung)                                                     |
| AK4 | `server/src/logics/geo.test.ts` (neu)        | Zahl; numerischer String (getrimmt); Grenzen ±90/±180 inklusive; `±0.1` darüber → `null`; `""`, `"abc"`, `null`, `undefined`, `NaN`, `Infinity`, Array → `null` (rot: Export fehlt) |
