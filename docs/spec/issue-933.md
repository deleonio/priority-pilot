# Spec #933 — Geolokation manuell anstoßen und aktuelle Adresse stets sichtbar

**Stand:** 2026-08-27

## Ziel

Der Nutzer kann in den Einstellungen (Tab „Allgemein", Abschnitt „Standort erfassen") die Standortermittlung **manuell anstoßen** und die **zuletzt ermittelte Adresse inkl. Zeitstempel** sehen — unabhängig vom 5-Minuten-Intervall.

## Vorbedingung

- Standorterfassung ist aktiviert (Einstellungen → „Standort erfassen" AN)
- Reverse Geocoding läuft über `GET /reverse-geocode?lat={lat}&lon={lon}` (Nominatim, Rate-Limit 1 req/s)

## Schritte / Verhalten

1. **Initial-Fetch:** Mountet die Standorterfassung mit gespeichertem Aktiv-Zustand (z. B. nach Reload/Seitenwechsel), wird **sofort** eine Position ermittelt und danach Reverse Geocoding angestoßen — nicht erst nach Ablauf der 5 Minuten.
2. **`refresh()`:** Der Button **„Standort jetzt ermitteln"** (KolButton, sekundär) stößt eine sofortige Positionsermittlung plus anschließendes Reverse Geocoding an. Ein erneuter Aufruf, während eine Ermittlung läuft, wird ignoriert (Re-Entrancy-Guard — schützt das Nominatim-Rate-Limit). Bei `enabled=false` wird kein Button gerendert.
3. **Lade- und Ergebnis-Anzeige:** Während der Ermittlung zeigt die Anzeige „Adresse wird ermittelt…" und der Button ist deaktiviert. Danach: ermittelte Adresse oder „Keine Adresse für diesen Standort" im `aria-live="polite"`-Container.
4. **Zeitstempel:** Die Adressanzeige enthält die Uhrzeit der letzten Ermittlung als „(Stand: HH:MM)".

## Erwartetes Ergebnis

- Bei aktivierter Standorterfassung existiert genau dieser eine zusätzliche Test-Schalter pro Abschnitt
- Adressanzeige und Zeitstempel aktualisieren sich ohne weiteren Interaktionsschritt
- Fehler bei der Adressermittlung (Rate-Limit, Timeout) fallen auf „Keine Adresse für diesen Standort" zurück, ohne die Positionserfassung zu stören
