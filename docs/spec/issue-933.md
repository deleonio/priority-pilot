# Spec #933 — Geolokation manuell anstoßen und aktuelle Adresse stets sichtbar

**Stand:** 2026-08-24  
Issue: #933 · Vorgänger: #845 (Hook), #866 (Reverse Geocoding)

## Ziel

Der User kann in den Einstellungen (Tab „Allgemein", Abschnitt „Standort erfassen") die
Standortermittlung **manuell anstoßen** und die **zuletzt ermittelte Adresse inkl.
Zeitstempel** sehen — unabhängig vom 5-Minuten-Intervall. Damit verifiziert er, dass die
Standortermittlung wirklich funktioniert.

## Vorbedingung

- `useGeolocation()` (#845) aktiviert bei `toggle(true)` Berechtigungsabfrage + erste Position
  und danach das 5-Minuten-Intervall (`GEOLOCATION_INTERVAL_MS`).
- Reverse Geocoding läuft über `api.reverseGeocode({ lat, lon })` → `GET /api/v1/reverse-geocode`
  (Server unverändert, Nominatim-Rate-Limit 1 req/s).
- Bestehende Anzeige in `SettingsPage.tsx`: `div.geo-address[aria-live="polite"]` mit
  `addressLoading ? 'Adresse wird ermittelt…' : address || 'Keine Adresse für diesen Standort'`.
- Bestehende Tests `useGeolocation.test.ts` (#845) decken ab: Default aus, toggle-on
  (Berechtigung + Intervall), toggle-off (Intervall-Stopp), Verweigern (`code 1`) →
  `permissionDenied` + `enabled=false`. Diese Verhalten bleiben unverändert und werden
  **nicht** erneut getestet (Dedup).

## Schritte / Verhalten

1. **Initial-Fetch (AK3):** Mountet der Hook mit `enabled=true` (localStorage-Preset
   `pp-geolocation-enabled=true`, z. B. nach Reload/Seitenwechsel), wird **sofort** beim
   Interval-Start eine Position ermittelt und danach Reverse Geocoding angestoßen — nicht
   erst nach Ablauf der 5 Minuten.
2. **`refresh()` (AK1, AK5):** Der Hook stellt eine öffentliche `refresh(): Promise<void>`
   bereit: sofortige Positionsermittlung via `navigator.geolocation.getCurrentPosition` +
   anschließendes Reverse Geocoding. Ein erneuter Aufruf, während eine Ermittlung läuft
   (`pending`), wird ignoriert (Re-Entrancy-Guard analog `toggle` — schützt das
   Nominatim-Rate-Limit). Verweigert der User beim manuellen Stoß (`code 1`), gilt die
   bestehende Denied-Behandlung aus #845 (`permissionDenied`, `enabled=false`).
3. **Button (AK1):** Ist die Standorterfassung aktiviert, rendert die Einstellungsseite im
   Abschnitt „Standort erfassen" einen `KolButton _variant="secondary"` mit Label
   **„Standort jetzt ermitteln"**, der `refresh()` auslöst. Bei `enabled=false` wird kein
   Button gerendert. Nur dieser eine Test-Schalter pro Abschnitt (UX: ein Screen, eine
   Aufgabe).
4. **Lade- und Ergebnis-Anzeige (AK2):** Während der Ermittlung zeigt die Anzeige
   „Adresse wird ermittelt…" und der Button ist deaktiviert (`_disabled`, Touch-Response
   < 100 ms). Danach: ermittelte Adresse oder „Keine Adresse für diesen Standort" im
   `aria-live="polite"`-Container.
5. **Zeitstempel (AK4):** Die Adressanzeige enthält die Uhrzeit der letzten Ermittlung als
   „Stand: HH:MM" (Hook liefert `positionUpdatedAt`), so dass Aktualität ohne weiteren
   Interaktionsschritt verifizierbar ist.

## Erwartetes Ergebnis (Test-Vertrag)

| AK      | Test (Datei)                                           | Erwartung                                                                                                          |
| ------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| AK3     | `frontend/src/lib/useGeolocation.test.ts` (#933-Block) | Mount mit `enabled=true` ruft `getCurrentPosition` sofort auf (0 Intervall-Ticks) und danach `api.reverseGeocode`. |
| AK1/AK5 | `frontend/src/lib/useGeolocation.test.ts` (#933-Block) | `refresh()` existiert und holt Position; zweiter Aufruf während `pending` startet keine zweite Abfrage (Guard).    |
| AK4     | `frontend/src/lib/useGeolocation.test.ts` (#933-Block) | Nach erfolgreicher Ermittlung ist `positionUpdatedAt` gesetzt (Unix-ms).                                           |
| AK1     | `frontend/src/components/SettingsPage.test.tsx`        | `enabled=true` rendert KolButton „Standort jetzt ermitteln"; `enabled=false` rendert keinen.                       |
| AK2     | `frontend/src/components/SettingsPage.test.tsx`        | `pending/addressLoading` → „Adresse wird ermittelt…" + Button deaktiviert; danach Adresse bzw. Fallback-Text.      |
| AK4     | `frontend/src/components/SettingsPage.test.tsx`        | Adressanzeige enthält „Stand: HH:MM" (aus `positionUpdatedAt` des Hooks abgeleitet, nicht hartkodiert).            |

## Randbedingungen (unverändert / nicht Teil dieses Tickets)

- `GEOLOCATION_INTERVAL_MS` (5 min) bleibt unverändert; localStorage-Schlüssel
  `pp-geolocation-enabled` unverändert.
- `Footer.tsx` nutzt eine eigene Hook-Instanz und darf sich nicht verändern.
- API-Vertrag `GET /api/v1/reverse-geocode` (openapi.yml) unverändert; Server ändert sich nicht.
- Zustands-Abdeckung (UX-Beratung): Laden (Button disabled + Lade-Text), Leer (Fallback),
  Fehler (Denied → `KolAlert _type="warning"` wie bisher), Erfolg (Adresse + Zeitstempel
  in `aria-live="polite"`).
