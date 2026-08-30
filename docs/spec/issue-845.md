# Geolocation: Positionsermittlung und Einstellungs-Schalter

**Stand:** 2026-08-30

Nutzer:in kann die Standorterfassung aktivieren/deaktivieren. Bei Aktivierung wird die Position ermittelt und in der App angezeigt. Die Berechtigung wird explizit angefragt und nur bei Erfolg aktiviert. Das Abfrageintervall ist in den Einstellungen konfigurierbar (Default 5 Minuten).

## Vorbedingung

- App ist geöffnet (Browser, nicht Service-Worker)
- Nutzer:in ist in den Einstellungen → Tab „Allgemein"

## Verhalten

### Standorterfassung aktivieren (Standard-Flow)

1. **Schalter betätigen**
   - Klick auf **„Standort erfassen"** (KolInputCheckbox Switch) unter Einstellungen → Allgemein
   - App ruft `navigator.geolocation.getCurrentPosition` auf
2. **Berechtigung erteilt (Erfolgs-Flow)**
   - Browser zeigt Permission-Dialog an; Nutzer:in klickt **„Zulassen"**
   - App empfängt erste Position (lat/long), Schalter wechselt auf **AN**
   - Die Position wird fortlaufend im konfigurierten Intervall neu ermittelt (Default alle 5 Minuten), und zwar nur bei geöffneter App — keine Hintergrundabfrage
3. **Berechtigung verweigert (Fehler-Flow)**
   - Schalter bleibt **AUS**
   - App zeigt **KolAlert** (Typ warning) mit Hinweis auf die Browser-Einstellungen
   - Keine weitere Abfrage

### Standorterfassung deaktivieren

- Klick auf **„Standort erfassen"** (AN → AUS) stoppt die Abfragen sofort; die Positionsanzeige im Footer verschwindet.

### Anzeige

- **Fußzeile:** zeigt bei vorhandener Adresse diese an; ohne Adresse (keine Position, Geocoding-Fehler/Rate-Limit) ersatzweise die Koordinaten im Format „{Lat}° N, {Lon}° E" (4 Dezimalstellen). Details siehe Fußzeilen-Spec.
- **Einstellungen:** zeigen unter dem Schalter die Adresse bzw. den Lade-/Fehlerzustand der Adressauflösung (Reverse-Geocoding über `GET /reverse-geocode?lat={lat}&lon={lon}`), inklusive manuellem „Standort ermitteln"-Button (siehe dort).

### Persistenz

Der Aktivierungszustand wird lokal gespeichert und bleibt über Seiten-Neuladen hinweg erhalten: War die Erfassung zuletzt aktiviert, ermittelt die App beim nächsten Laden sofort wieder die Position.

**Default-Zustand:** Schalter ist AUS, kein `navigator.geolocation`-Call, keine Positionsanzeige.

## Nicht-Ziele

- Persistierung der Positions-Historie (Backend/DB)
- Standort-basierte Aufgaben-Vorschläge
- Hintergrund-Standortabfrage (Service Worker)
