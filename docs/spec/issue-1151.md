# Settings-Tab „Standort"

**Stand:** 2026-09-01
**Ziel:** Von außen sichtbares Verhalten des vierten Settings-Tabs „Standort"

Die Einstellungen-Seite hat vier Tabs: „Allgemein" (Index 0), „Säulen" (Index 1), „KI-Provider" (Index 2), „Standort" (Index 3). Der aktive Tab ist aus der URL abgeleitet (`/settings/:tab` mit den Segmenten `general`, `pillars`, `llm`, `standort`); ein unbekanntes Segment fällt auf den Säulen-Tab zurück.

## Tab „Standort"

- Route `/settings/standort` aktiviert den vierten Tab.
- Er enthält ausschließlich die Geo-Einstellungen, in dieser Reihenfolge: Standort-Switch „Standort erfassen" (inkl. Berechtigungs-/Verfügbarkeits-Alerts) → Button „Standort ermitteln" → Addressanzeige (`aria-live="polite"`, „Stand: HH:MM") → drei Regler (Anzeige-Entfernung, Alarm-Entfernung, Aktualisierungsintervall) mit sichtbaren Werten.
- Das fachliche Verhalten (Kreuz-Schranken der Regler, serverseitige Persistenz, Adressauflösung) ist von der Ablage im eigenen Tab unberührt.

## Tab „Allgemein"

`/settings/general` zeigt die Gruppen Darstellung, Sprachaufnahme und Push-Nachrichten in dieser Reihenfolge — ohne jedes Geo-Element.

## Mobile (375px)

Alle vier Tabs sind bei 375px bedienbar ohne horizontales Scrollen (Bounding-Box-Prüfung; die App-Shell clippt `overflow-x`, `scrollWidth` ist kein verlässliches Signal).
