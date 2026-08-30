# Fußbereich: Adresse statt Koordinaten anzeigen

**Stand:** 2026-08-30

## Ziel

Die Fußzeile zeigt statt der Roh-Koordinaten die lesbare Adresse aus dem Reverse Geocoding (`useGeolocation().address`), gefolgt von der Versionsnummer, getrennt durch `" | "`.

## Verhalten

1. **Adresse anzeigen:** Ist `address` verfügbar (nicht `null`, nicht leer), zeigt die Fußzeile die Adresse. Die Roh-Koordinaten werden in diesem Fall nicht angezeigt.
2. **Fallback Koordinaten:** Ist `address` `null` oder leer (keine Position, Rate-Limit, Geocoding-Fehler), zeigt die Fußzeile stattdessen die Koordinaten (`position.latitude`/`longitude`, Format mit 4 Dezimalstellen). Ist auch keine Position vorhanden, bleibt nur die Version.
3. **Separator:** Adresse (bzw. Fallback-Koordinaten) und Version werden durch den Separator `" | "` getrennt. Der Separator steckt in einem eigenen `<span aria-hidden="true">` (rein dekorativ, wird Screen-Readern nicht vorgelesen).
4. **Version:** Die übergebene Versionsnummer wird unverändert korrekt angezeigt.
5. **Landmark:** `role="contentinfo"` bleibt erhalten.
6. **Mobile-First:** Bei 375px Viewport bleibt die Fußzeile im sichtbaren Bereich (kein Clipping/horizontaler Überlauf), auch bei einer langen Adresse (Umbruch über `overflow-wrap: anywhere`). Reflow bei 200 % Textvergrößerung/320px wird über denselben Bounding-Box-Mechanismus abgesichert (`scrollWidth` ist in der App-Shell wegen `overflow-x: hidden` strukturell zahnlos).

## Erwartetes Ergebnis

- `„Musterstraße 1, 10115 Berlin | Version <Versionsnummer>"` bzw.
- `„52.5200° N, 13.4050° E | Version <Versionsnummer>"` (Fallback).
