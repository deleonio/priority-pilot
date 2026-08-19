# Issue 845 – Geolocation: Position alle 5 Minuten ermitteln + Einstellungs-Schalter

**Stand:** 2026-08-19
**Ziel:** App ermittelt alle 5 Minuten die Geolocation-Position des Geräts und zeigt sie an, steuerbar über Einstellungs-Schalter (Default: deaktiviert)

---

## Ziel

Nutzer:in kann die Standorterfassung aktivieren/deaktivieren. Bei Aktivierung wird alle 5 Minuten die Position ermittelt und in der App angezeigt. Die Berechtigung wird explizit angefragt und nur bei Erfolg aktiviert.

## Vorbedingung

- App ist geöffnet (Browser, nicht Service-Worker)
- Nutzer:in ist in den Einstellungen → Tab „Allgemein"

## Schritte

### 1. Standorterfassung aktivieren (Standard-Flow)

1. **Schalter betätigen**
   - Klick auf **„Standort erfassen"** (KolInputCheckbox Switch) unter Einstellungen → Allgemein
   - App ruft `navigator.geolocation.getCurrentPosition` auf

2. **Berechtigung erteilt (Erfolgs-Flow)**
   - Browser zeigt Permission-Dialog an
   - Nutzer:in klickt **„Zulassen"**
   - App empfängt erste Position (lat/long)
   - Schalter wechselt auf **AN**
   - App startet 5-Minuten-Intervall für weitere Abfragen
   - Position wird im Footer/Dashboard angezeigt

3. **Berechtigung verweigert (Fehler-Flow)**
   - Nutzer:in klickt **„Blockieren"** oder bricht ab
   - Schalter bleibt **AUS**
   - App zeigt **KolAlert** (Typ warning) mit Hinweis auf Browser-Einstellungen
   - Kein Intervall gestartet

### 2. Standorterfassung deaktivieren

1. **Schalter ausschalten**
   - Klick auf **„Standort erfassen"** (AN → AUS)
   - App stoppt den Intervall sofort
   - Keine weiteren Standortabfragen
   - Positionsanzeige verschwindet oder zeigt „deaktiviert"

### 3. Intervall-Verhalten

1. **Erste Abfrage** – sofort bei Aktivierung
2. **Folgeabfragen** – alle 5 Minuten (`5 * 60 * 1000 ms`)
3. **Bei App-Wechsel/Sleep** – Intervall läuft nur bei geöffneter App, keine Hintergrundabfrage

## Erwartetes Ergebnis

- **Default-Zustand:** Schalter ist AUS, kein `navigator.geolocation`-Call, keine Positionsanzeige
- **Aktiviert (Permission granted):**
  - Schalter AN, erste Position sofort ermittelt
  - Position im Footer/Dashboard sichtbar (Format: „52.5200° N, 13.4050° E")
  - Intervall läuft alle 5 Minuten
- **Deaktiviert:** Intervall stoppt sofort, keine weiteren Anfragen
- **Permission denied:** Schalter AUS, KolAlert warning mit Handlungsaufforderung

## Technische Referenz

- Hook: `frontend/src/lib/useGeolocation.ts` (Pattern: `useVoiceAutostart.ts` / `usePushSubscription.ts`)
- Konstante: `GEOLOCATION_INTERVAL_MS = 5 * 60 * 1000` (nicht mehrfach hartkodiert)
- UI-Komponenten: `KolInputCheckbox _variant="switch"`, `KolAlert _type="warning"`, `KolBadge` für Positionsanzeige
- Berechtigungs-Flow analog Mikrofon/Push-Permission in SettingsPage

## Nicht-Ziele (Out of Scope)

- Persistierung der Positions-Historie (Backend/DB)
- Standort-basierte Aufgaben-Vorschläge
- Hintergrund-Standortabfrage (Service Worker)
- Reverse-Geocoding (nur Lat/Long, keine menschenlesbare Adresse)

---

## Versionierung

- **v1.1** (2026-08-19): Nightly-Sync — Ist-Stand verifiziert, Geolocation implementiert
- **v1.0** (2026-08-17): Initialefassung für Issue #845
