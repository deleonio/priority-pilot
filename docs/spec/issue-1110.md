# Nearby-Card: Radius im Titel + echte Distanzen

**Stand:** 2026-08-30

Die Dashboard-Card „In der Nähe" nennt die gespeicherte Anzeige-Entfernung des Users im Card-Titel (`In der Nähe (5 km)`), damit die Trefferliste ohne Einstellungs-Wechsel interpretierbar ist. Der Wert kommt aus `GET /geo-config` (`displayDistanceKm`) und ändert sich mit, wenn er in den Einstellungen verstellt wird — keine zweite, hartcodierte Kopie im Frontend. Die Distanzkette (Adresssuche → gespeicherte Koordinaten → Haversine → DTO → Anzeige) ist verriegelt, so dass ein „(0 km)" für alle Einträge als Kettenbruch auffällt.

## Card-Titel

- `NearbyCard` lädt beim Mount die Geo-Config und setzt das Card-Label auf `` `In der Nähe (${displayDistanceKm} km)` `` — `displayDistanceKm` als ganzzahliger Wert ohne Nachkommastelle („In der Nähe (5 km)", „In der Nähe (12 km)").
- Der Wert ist **nicht** im Frontend hinterlegt: Bei `displayDistanceKm = 12` (Config) trägt das Label `(12 km)` — Default des Servers ist 5.
- Nach dem Ändern der Anzeige-Entfernung in den Einstellungen zeigt die Card **beim nächsten Laden** den neuen Wert. Ein Live-Event-Update ist Bonus, kein Vertrag.
- Der `aria-label` des umgebenden `<section class="dashboard-nearby">` bleibt „In der Nähe" — der Radius steht im sichtbaren Card-Titel, nicht doppelt in der Barrierefreiheit.

## Distanzkette

- `GET /tasks/nearby` liefert `distanceKm` als Haversine-Distanz (km) zur Anfrage-Position, auf eine Nachkommastelle gerundet. Eine Aufgabe exakt an der Position liefert exakt `0` — und nur dann zeigt der Eintrag `(0,0 km)`.
- Ein über die Adresssuche angelegter Task (Auswahl eines Treffers im TaskForm) hat nach dem Speichern `latitude`/`longitude` als Zahlen ≠ `null` in DB/DTO (exakt die Koordinaten des gewählten Treffers) und erscheint mit seiner Distanz in der Nearby-Liste.
