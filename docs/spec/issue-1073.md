# Issue 1073 — Fußbereich: Adresse statt Koordinaten anzeigen

**Stand:** 2026-08-28

## Ziel

Die Fußzeile zeigt statt der Roh-Koordinaten die lesbare Adresse aus dem Reverse Geocoding
(`useGeolocation().address`), gefolgt von der Versionsnummer, getrennt durch `" | "`.

## Voraussetzungen

- `frontend/src/lib/useGeolocation.ts` liefert `address: string | null` (Backend-Endpunkt
  `/reverse-geocode`, Nominatim-Proxy) sowie `position` und `enabled`.
- `frontend/src/components/Footer.tsx` rendert `<footer role="contentinfo">` mit Positions- bzw.
  Adress-Span und `Version <version>`.

## Verhalten

1. **AK1 — Adresse anzeigen:** Ist `address` verfügbar (nicht `null`, nicht leer), zeigt die
   Fußzeile die Adresse. Die Roh-Koordinaten werden in diesem Fall nicht angezeigt.
2. **AK2 — Fallback Koordinaten:** Ist `address` `null` oder leer (keine Position, Rate-Limit,
   Geocoding-Fehler), zeigt die Fußzeile stattdessen die Koordinaten (`position.latitude`/`longitude`,
   bisheriges `toFixed(4)`-Format). Ist auch keine Position vorhanden, bleibt nur die Version.
3. **AK3 — Separator:** Adresse (bzw. Fallback-Koordinaten) und Version werden durch den
   Separator `" | "` getrennt. Der Separator steckt in einem eigenen `<span aria-hidden="true">`
   (rein dekorativ, wird Screen-Readern nicht vorgelesen).
4. **AK4 — Version:** Die übergebene Versionsnummer wird unverändert korrekt angezeigt
   (bereits durch bestehende Tests in `Footer.test.tsx` abgedeckt — Dedup, keine neuen Tests).
5. **AK5 — Landmark:** `role="contentinfo"` bleibt erhalten
   (bereits durch bestehende Tests abgedeckt — Dedup).
6. **AK6 — Mobile-First:** Bei 375px Viewport bleibt die Fußzeile im sichtbaren Bereich
   (kein Clipping/horizontaler Überlauf), auch bei einer langen Adresse. Umsetzungshinweis aus
   dem KI-UX-Block: `overflow-wrap: anywhere` (greift nicht auf non-replaced Inline-Elemente
   wie diesen Span, daher kein `min-width: 0`); die Prüfung
   erfolgt über die Bounding-Box (`scrollWidth` ist in der App-Shell wegen
   `overflow-x: hidden` strukturell zahnlos). Reflow bei 200 % Textvergrößerung/320px wird
   über denselben Bounding-Box-Mechanismus abgesichert.

## Steps (e2e)

1. Geolocation-Berechtigung erteilen (`test.use({ geolocation, permissions })`) und
   `/reverse-geocode` mocken → Adresse liegt vor → AK1/AK3.
2. `/reverse-geocode` mit Fehler antworten lassen → `address` bleibt `null` → AK2 (Koordinaten).
3. Viewport 375×812 mit langer gemockter Adresse → Fußzeile komplett im Viewport → AK6.

## Erwartetes Ergebnis

- `„Musterstraße 1, 10115 Berlin | Version 0.1.602"` bzw.
- `„52.5200° N, 13.4050° E | Version 0.1.602"` (Fallback).
