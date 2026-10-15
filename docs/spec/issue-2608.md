# Reverse-Geocode: Koordinaten-Eingabevalidierung über parseCoordinate (#2608)

**Stand:** 2026-10-15

## Ziel

`GET /api/v1/reverse-geocode` validiert `lat`/`lon` wie die übrigen Koordinaten-Endpunkte (`tasks.ts:663`, `placeFavorites.ts:86`, `geoConfig.ts:150`) über den gemeinsamen Helfer `parseCoordinate` (`server/src/logics/geo.ts:9`): ungültige oder außerhalb `[-90, 90]`/`[-180, 180]` liegende Werte antworten **400, bevor Nominatim gefragt wird**; der eigene `parseFloat`/`isNaN`-Block entfällt.

## Voraussetzung

- Eingeloggte Session mit Plan-Feature `location_reminders` (bestehendes Muster der Route, unverändert).
- Geteilter 1-req/s-Limiter (`acquireNominatimSlot`) und Rate-Limit-Middleware bleiben unverändert.

## Schritte und erwartetes Ergebnis

1. **Nicht-numerische Werte (AK1):** `lat=abc` bzw. `lon=abc` → HTTP 400.
2. **Außerhalb des Wertebereichs (AK2):** `lat=91` bzw. `lon=181` → HTTP 400 (statt wie bisher an Nominatim weitergereicht zu werden).
3. **Fehlende Parameter (AK3 — Status quo bleibt):** Request ohne `lat`/`lon` (oder ohne einen der beiden) → HTTP 400 mit bestehender Meldung „lat und lon als Query-Parameter erforderlich.".
4. **Gültige Werte (AK4 — Vertrag unverändert):** `lat=52.52&lon=13.405` → HTTP 200 mit Adresse; Nominatim wird **genau 1×** mit denselben Koordinaten in der Upstream-URL gefragt.
5. **Kein Upstream-Kontingent für Müll-Anfragen (AK1/AK2):** alle 400-Fälle erreichen Nominatim nicht (0 Aufrufe) — Parsing bleibt vor `acquireNominatimSlot()`.
6. **Kein eigener Parse-Code mehr (AK5):** in `server/src/express/routes/reverseGeocode.ts` steht kein eigenes `parseFloat`/`isNaN` mehr (grep-leer; Verifikation in der Umsetzung per grep, kein Test — String-Match wäre ein zahnloser Change-Detector).
