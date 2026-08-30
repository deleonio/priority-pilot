# Geo-Einstellungen: Entfernungen und Aktualisierungsintervall

**Stand:** 2026-08-30

Im Settings-Tab „Allgemein" lässt sich unterhalb des Standort-Switches konfigurieren, bis zu welcher Entfernung Aufgaben „in der Nähe" angezeigt werden (Anzeige-Entfernung), ab welcher Entfernung alarmiert wird (Alarm-Entfernung, Grundlage der Geo-Push-Benachrichtigung) und in welchem Minutenabstand die eigene Position neu ermittelt wird. Alle drei Werte werden **serverseitig pro User** persistiert — **kein localStorage** für diese drei Werte. Ungültige Kombinationen sind durch dynamische Kreuz-Schranken ausgeschlossen, es gibt keine Alerts/Inline-Errors.

## Datenmodell & Endpoint `GET`/`PUT /api/v1/geo-config`

- Pro-User-Konfiguration mit drei Feldern: `displayDistanceKm` (Default **5**), `alarmDistanceKm` (Default **1**), `intervalMinutes` (Default **5**).
- `GET /geo-config` hinter `requireAuth`: ohne Session → 401; ohne gespeicherte Config → die drei Defaults; sonst die gespeicherten Werte. `PUT /geo-config` hinter `requireAuth` speichert die Config des eigenen Users und gibt sie zurück.
- Server-Validierung der Schranken (Verstoß → 400): `alarmDistanceKm ∈ [1, displayDistanceKm]`, `displayDistanceKm ∈ [alarmDistanceKm, 50]`, `intervalMinutes ∈ [1, 60]` (ganze Zahlen).
- Datenisolation: die Config eines Users ist nur für ihn lesbar/schreibbar — User A kann die Config von User B weder lesen noch überschreiben.
- Der localStorage-Switch `pp-geolocation-enabled` ist von der Config unabhängig (nur die drei Werte laufen über den Server).

## Settings-Tab „Allgemein" — Geo-Block

- Unterhalb des Switches „Standort erfassen" stehen drei `KolInputRange` (auch bei deaktiviertem Standort — disabled, nicht versteckt):
  - „Anzeige-Entfernung (km)": `_min` = aktueller Alarm-Wert, `_max` = 50, `_step` = 1,
  - „Alarm-Entfernung (km)": `_min` = 1, `_max` = aktueller Anzeige-Wert, `_step` = 1,
  - „Aktualisierungsintervall (Minuten)": `_min` = 1, `_max` = 60, `_step` = 1.
  Jedes Feld zeigt seinen aktuellen Wert sichtbar mit Einheit an („5 km", „1 km", „5 Minuten").
- Kreuz-Schranken sind **dynamisch**: Ändert der Nutzer die Anzeige-Entfernung, springt `_max` der Alarm-Entfernung sofort auf den neuen Anzeige-Wert; ändert er die Alarm-Entfernung, springt `_min` der Anzeige-Entfernung sofort auf den neuen Alarm-Wert. Es gibt **keinen** Error-State/Alert/Inline-`_msg`.
- Jede Änderung wird **sofort** gespeichert (PUT, kein Speichern-Button).
- Standort-Switch aus → alle drei Felder sind deaktiviert; die Werte bleiben sichtbar erhalten.
- Der Hinweis des Standort-Switches („Ermittle alle N Minuten …") folgt dem konfigurierten Intervall.

## Positionsermittlung, Dashboard und Fußzeile

- `useGeolocation` ermittelt die Position im konfigurierten Intervall; Fallback 5 Minuten, wenn keine Config geladen ist. Der Re-Entrancy-Guard bleibt (Nominatim-Rate-Limit 1 req/s — kürzere Intervalle erzeugen keine parallelen Fetches).
- Jede ermittelte Position wird an `POST /geo/position` gemeldet; daraufhin prüft der Server die Nähe-Aufgaben und stößt ggf. die gebündelte Push-Nachricht an (siehe Geo-Push-Spec).
- Standort aus → das Dashboard rendert die NearbyCard **gar nicht** und die Fußzeile zeigt weder Adresse noch Koordinaten.
- Die NearbyCard zeigt je Eintrag die Distanz **in Klammern** und deutsch formatiert („(2,4 km)"); die Liste enthält nur Tasks innerhalb der gespeicherten Anzeige-Entfernung des Users (Server-Filter in `GET /tasks/nearby`, Default 5 km).

## E2E (375px, mobile-first)

Bei 375px sind die drei Regler bedienbar und vollständig im Viewport (Bounding-Box, nicht `scrollWidth` — die App-Shell clippt mit `overflow-x: hidden`); Touch-Ziel je Feld ≥ 44px Höhe.
