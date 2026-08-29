# Spec #1098 — Geo-Einstellungen: Anzeige-/Alarm-Entfernung + Positionsermittlungs-Intervall

**Stand:** 2026-08-28 (Spec-Phase)

Ziel: Im Settings-Tab „Allgemein" lässt sich unterhalb des Standort-Switches konfigurieren, bis
zu welcher Entfernung Aufgaben „in der Nähe" angezeigt werden (Anzeige-Entfernung), ab welcher
Entfernung künftig alarmiert wird (Alarm-Entfernung, Grundlage für #1101) und in welchem
Minutenabstand die eigene Position neu ermittelt wird. Alle drei Werte werden **serverseitig pro
User** persistiert (Autoren-Entscheidung 28.08.2026, 18:13:52Z) — **kein localStorage** für diese
drei Werte. Bestätigt sind sie mit dynamischen Kreuz-Schranken statt Alerts/Inline-Errors
(Autoren-Entscheidung „so sind keine Alerts erforderlich").

## Datenmodell & Endpoint `GET`/`PUT /api/v1/geo-config`

- **AK7** Neue pro-User-Konfiguration mit drei Feldern (Defaults = heutiges Verhalten):
  `displayDistanceKm` (Default **5**), `alarmDistanceKm` (Default **1**),
  `intervalMinutes` (Default **5**).
- **AK7** `GET /geo-config` hinter `requireAuth`: ohne Session → 401; ohne gespeicherte Config →
  die drei Defaults; sonst die gespeicherten Werte. `PUT /geo-config` hinter `requireAuth`
  speichert die Config des eigenen Users und gibt sie zurück.
- **AK7** Server-Validierung der Schranken (Verstoß → 400):
  `alarmDistanceKm ∈ [1, displayDistanceKm]`, `displayDistanceKm ∈ [alarmDistanceKm, 50]`,
  `intervalMinutes ∈ [1, 60]` (ganze Zahlen).
- **AK7** Dataisolation: die Config eines Users ist nur für ihn lesbar/schreibbar — User A kann
  die Config von User B weder lesen noch überschreiben (Muster `llmProviders.test.ts`).
- Der bestehende localStorage-Switch `pp-geolocation-enabled` bleibt unangetastet (nur die drei
  NEUEN Werte sind Scope — Randbedingung aus der Analyse).

## Settings-Tab „Allgemein" — Geo-Block

- **AK1** Unterhalb des Switches „Standort erfassen" werden drei `KolInputRange` gerendert (auch
  bei deaktiviertem Standort — disabled, nicht versteckt):
  - „Anzeige-Entfernung (km)": `_min` = aktueller Alarm-Wert, `_max` = 50, `_step` = 1,
    `_value` = 5 (Default),
  - „Alarm-Entfernung (km)": `_min` = 1, `_max` = aktueller Anzeige-Wert, `_step` = 1,
    `_value` = 1 (Default),
  - „Aktualisierungsintervall (Minuten)": `_min` = 1, `_max` = 60, `_step` = 1, `_value` = 5.
    Jedes Feld zeigt seinen aktuellen Wert sichtbar mit Einheit an („5 km", „1 km",
    „5 Minuten").
- **AK2** Kreuz-Schranken sind **dynamisch**: Ändert der Nutzer die Anzeige-Entfernung, springt
  `_max` der Alarm-Entfernung sofort auf den neuen Anzeige-Wert; ändert er die Alarm-Entfernung,
  springt `_min` der Anzeige-Entfernung sofort auf den neuen Alarm-Wert. Ungültige Kombinationen
  sind damit nicht einstellbar — es gibt **keinen** Error-State/Alert/Inline-`_msg`
  (Autoren-Entscheidung; der Inline-Error-Abschnitt des KI-UX-Blocks ist obsolet).
- **AK2** Jede Änderung wird **sofort** gespeichert (PUT, kein Speichern-Button).
- **AK3** Standort-Switch aus → alle drei Felder tragen `_disabled`; die Werte bleiben sichtbar
  erhalten. Der Wechsel wirkt auch **nach dem Mount** (key-Remount-Muster
  `SettingsPage.tsx:266-272`, weil der KoliBri-Adapter `_disabled`-Wechsel nach dem Mount nicht
  zuverlässig durchschlägt).
- Der `_hint` des Standort-Switches („Ermittle alle 5 Minuten …", `SettingsPage.tsx:242`) folgt
  dem konfigurierten Intervall (KI-UX: die UI darf sich nicht selbst widersprechen).

## Positionsermittlung, Dashboard und Fußzeile

- **AK5** `useGeolocation` ermittelt die Position im konfigurierten Intervall statt des fixen
  `GEOLOCATION_INTERVAL_MS`; Fallback 5 Minuten, wenn keine Config geladen ist. Der bestehende
  Re-Entrancy-Guard bleibt (Nominatim-Rate-Limit 1 req/s — kürzere Intervalle dürfen keine
  parallelen Fetches erzeugen).
- **AK4** Standort aus → das Dashboard rendert die NearbyCard **gar nicht** (heute
  bedingungslos, `Dashboard.tsx:222`) und die Fußzeile zeigt weder Adresse noch Koordinaten.
  Der gestaltete Aus-Zustand `nearby-preference-off` aus #1066 entfällt damit.
- **AK6** Die NearbyCard zeigt je Eintrag die Distanz **in Klammern** und deutsch formatiert
  („(2,4 km)"); die Liste enthält nur Tasks innerhalb der gespeicherten Anzeige-Entfernung des
  Users — Server-Filter in `GET /tasks/nearby` (Default 5 km).

## E2E (375px, mobile-first)

- **TF7/TF8** Bei 375px sind die drei Regler bedienbar und vollständig im Viewport
  (Bounding-Box, nicht `scrollWidth` — die App-Shell clippt mit `overflow-x:hidden`); Touch-Ziel
  je Feld ≥ 44px Höhe.
