# Spec #1110 — Nearby-Card: Radius im Titel + echte Distanzen (0-km-Fund)

**Stand:** 2026-08-29 (Spec-Phase)

Ziel: Die Dashboard-Card „In der Nähe" nennt die gespeicherte Anzeige-Entfernung des Users im
Card-Titel (`In der Nähe (5 km)`), damit die Trefferliste ohne Einstellungs-Wechsel interpretierbar
ist. Der Wert kommt aus `GET /geo-config` (`displayDistanceKm`) und ändert sich mit, wenn er in den
Einstellungen verstellt wird — keine zweite, hartcodierte Kopie im Frontend. Zusätzlich ist die
Distanzkette (Adresssuche → gespeicherte Koordinaten → Haversine → DTO → Anzeige) per Test
verriegelt, so dass ein „(0 km)" für alle Einträge künftig als Kettenbruch auffällt.

## Card-Titel (AK1, AK2)

- **AK1** `NearbyCard` lädt beim Mount die Geo-Config (`api.getGeoConfig()`, Muster
  `SettingsPage.tsx:131-150`) und setzt das Card-Label auf
  `` `In der Nähe (${displayDistanceKm} km)` `` — `displayDistanceKm` als ganzzahliger Wert ohne
  Nachkommastelle („In der Nähe (5 km)", „In der Nähe (12 km)").
- **AK1** Der Wert ist **nicht** im Frontend hinterlegt: Bei `displayDistanceKm = 12` (Config)
  muss das Label `(12 km)` tragen — Default des Servers ist 5 (#1098 AK7).
- **AK2** Nach dem Ändern der Anzeige-Entfernung in den Einstellungen (PUT `/geo-config`) zeigt
  die Card **beim nächsten Laden** den neuen Wert (5 → 12 km). Ein Live-Event-Update ist Bonus,
  kein Vertrag.
- Der `aria-label` des umgebenden `<section class="dashboard-nearby">` bleibt „In der Nähe" —
  der Radius steht im sichtbaren Card-Titel, nicht doppelt in der Barrierefreiheit.

## Distanzkette (AK3, AK4)

- **AK3** `GET /tasks/nearby` liefert `distanceKm` als Haversine-Distanz (km) zur
  Anfrage-Position, auf eine Nachkommastelle gerundet. Eine Aufgabe exakt an der Position liefert
  exakt `0` — und nur dann zeigt der Eintrag `(0,0 km)`.
- **AK4** Ein über die Adresssuche angelegter Task (Auswahl eines Treffers im TaskForm) hat nach
  dem Speichern `latitude`/`longitude` als Zahlen ≠ `null` in DB/DTO (exakt die Koordinaten des
  gewählten Treffers) und erscheint mit seiner Distanz in der Nearby-Liste.

## Regressionen (AK5, AK6, AK7) — bereits gedeckt, kein Duplikat

- **AK5** Filter `distanceKm ≤ displayDistanceKm`: `server/src/express/tasks-nearby.test.ts`
  („liefert nur Tasks innerhalb der gespeicherten Anzeige-Entfernung") und
  `frontend/e2e/issue-1098-geo-settings.spec.ts` (AK6).
- **AK6** Die vier Card-Zustände (Liste, leer `nearby-empty`, verweigert `nearby-denied`,
  Präferenz aus — Card gar nicht gerendert): `frontend/e2e/issue-1066-nearby-card.spec.ts`.
  Eine Änderung am Label darf keinen davon anfassen.
- **AK7** 375px ohne Überlauf: `issue-1066-nearby-card.spec.ts` AK5 misst die Bounding-Box der
  `nearby-card` (Bounding-Box statt `scrollWidth`, App-Shell clippt `overflow-x: hidden`) — der
  um wenige Zeichen längere Titel ist davon gedeckt.
