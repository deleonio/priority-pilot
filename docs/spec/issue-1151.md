# Spec: Issue #1151 — Eigener Settings-Tab „Standort"

## Ziel

Die Geo-Einstellungen (Standort erfassen, Ermitteln-Button, Addressanzeige, drei Slider) wandern
aus dem Tab „Allgemein" in einen neuen vierten Tab „Standort" (Index 3, Route `/settings/standort`).
Der Tab „Allgemein" behält genau seine bisherigen, themenfremden Gruppen — Darstellung,
Sprachaufnahme, Push-Nachrichten — in unveränderter Reihenfolge.

## Voraussetzungen

- Settings-Seite (`frontend/src/components/SettingsPage.tsx`) mit `KolTabs`-Navigation
  (`SETTINGS_TABS`, aktuell 3 Einträge) und Routing-Tabelle `SETTINGS_PATH_SEGMENTS`
  (`frontend/src/App.tsx`, `['general', 'pillars', 'llm']`).
- URL ist die Quelle des aktiven Tabs (`/settings/:tab`); unbekanntes Segment fällt auf den
  Säulen-Tab (Index 1) zurück — dieses Fallback-Verhalten bleibt unverändert.
- Geo-Block-Zustände (geoPending, geoDenied, geoEnabled) sind Komponenten-Zustand; `KolTabs`
  hält alle Panels gemountet. Die Remount-Keys (`key={geoPending…}`, `key=…geoEnabled…`) ziehen
  mit in den neuen Slot um (KI-UX: KoliBri-Adapter setzt Props erst nach dem Mount).

## Schritte

1. `SETTINGS_TABS` um `{ _label: 'Standort' }` erweitern (vierter Eintrag, Index 3);
   `SETTINGS_PATH_SEGMENTS` parallel um `'standort'` erweitern — Index-Parität bleibt gewahrt.
2. Neuen Slot-Container `slot="tab-3"` anlegen und den kompletten Geo-Block dorthin verschieben,
   in der bisherigen Reihenfolge: Standort-Switch (+ Berechtigungs-/Verfügbarkeits-Alerts) →
   Ermitteln-Button → Addressanzeige (`aria-live="polite"`, „Stand: HH:MM") → drei Slider
   (Anzeige-Entfernung, Alarm-Entfernung, Intervall) mit sichtbaren Werten (`.geo-range-value`).
3. Tab „Allgemein" (`slot="tab-0"`) aufräumen: Darstellung → Sprachaufnahme → Push bleiben,
   keine Geo-Elemente mehr.
4. Tab-Wechsel über `changeSettingsTab` landet auf `/settings/standort`; Browsers-Zurückkehren
   stellt den vorherigen Tab wieder her; `/settings/xyz` → Säulen-Tab.

## Erwartetes Ergebnis

- `/settings/standort` zeigt den Tab „Standort" mit sämtlichen Geo-Einstellungen und sonst nichts.
- `/settings/general` zeigt Darstellung, Sprachaufnahme, Push — ohne jedes Geo-Element.
- Alle vier Tabs bedienbar bei 375px ohne horizontales Scrollen (Bounding-Box-Prüfung, die
  App-Shell clippt `overflow-x` — `scrollWidth` ist kein verlässliches Signal).
- Bestehende Geo-Funktion (Kreuz-Schranken der Slider, serverseitiges Speichern, #933-Adresse)
  bleibt unverändert funktionsfähig — nur der Ablageort ändert sich.

## Abgeleitete Tests

- TF1/TF3/TF5: `frontend/e2e/settings-tabs.spec.ts` (neuer `#1151`-Block) — Tab vorhanden +
  Route (AK1), Geo nur im Standort-Tab (AK2), URL-/Back-Navigation + Fallback (AK4), 375px
  Bounding-Boxen (AK5).
- TF2: `frontend/e2e/issue-1098-geo-settings.spec.ts` — bestehende Geo-Abläufe umziehen auf
  `/settings/standort` (AK2/AK3, funktionale Integrität).
- TF4: `frontend/src/components/SettingsPage.test.tsx` — Slot-Vertrag: Geo-Block lebt in
  `tab-3`, „Allgemein" (`tab-0`) bleibt geo-frei und in bisheriger Reihenfolge (AK2/AK3).

## Entscheide aus der UX-Beratung (advisory, hier festgelegt)

- Tab-Position: Index 3 (hinter „KI-Provider"), wie in der Analyse fixiert — konsistent in
  AK1/TF1/TF3. Die UX-Empfehlung (Position 2) wurde geprüft und verworfen: Die Analyse fixiert
  Index 3 und alle Tests hängen daran.
- URL-Segment: `standort` (nicht `location`) — bricht das englische Schema, ist aber in Analyse
  und Tests fixiert und lesbar; Einmal-Festlegung vor der Impl.
