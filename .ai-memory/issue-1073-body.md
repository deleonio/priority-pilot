## Was ist das Problem?

In der Fußzeile werden aktuell die Koordinaten (Breiten- und Längengrad) der aktuellen Position angezeigt. Koordinaten sind für Nutzende schwer lesbar und weniger aussagekräftig als eine Adresse.

## Wie soll es sein?

Statt der Koordinaten soll die lesbare Adresse (aus Reverse Geocoding) angezeigt werden, gefolgt von der Versionsnummer. Zwischen Adresse und Version ist ein geeigneter Separator zu verwenden. Ist keine Adresse verfügbar, werden als Fallback die Koordinaten angezeigt.

## Wo tritt es auf?

Fußzeile der App (global auf allen Seiten sichtbar).

## Woran messen wir das?

- Fußzeile zeigt `"<Adresse> | Version <version>"`, wenn eine Adresse vorliegt.
- Ohne Adresse: `"<Koordinaten> | Version <version>"`.
- Details und weitere Kriterien siehe Analyseblock unten.

<!-- KI-ANALYSE:START stand=2026-08-27T20:20:00Z -->
### Umsetzungskontext
- Betroffene Dateien: `frontend/src/components/Footer.tsx`, `frontend/src/components/Footer.test.tsx`
- Betroffene Komponenten: `Footer` React-Komponente
- Vorhandenes Muster: `frontend/src/lib/useGeolocation.ts` liefert bereits `address` (String | null) aus Reverse Geocoding (Nominatim) — in `Footer.tsx` bislang nur `position` konsumiert
- Randbedingungen: `address` kann `null` sein (keine Position, Rate-Limit, Fehler) – dann Koordinaten als Fallback anzeigen; `role="contentinfo"` und bestehende `geoEnabled && position`-Logik bleiben erhalten
- Erwartetes Ergebnis: Fußzeile zeigt "<Adresse> | Version <version>" bzw. bei fehlender Adresse "<Koordinaten> | Version <version>"

### Akzeptanzkriterien
- AK1: Fußzeile zeigt die lesbare Adresse aus `useGeolocation().address` an, wenn verfügbar
- AK2: Falls `address` nicht verfügbar ist (null/leer), werden die Koordinaten als Fallback angezeigt
- AK3: Adresse und Version werden durch einen Separator " | " getrennt
- AK4: Die Versionsnummer wird weiterhin korrekt angezeigt
- AK5: Das `role="contentinfo"`-Attribut bleibt erhalten
- AK6: Mobile-First: Anzeige bleibt bei 375px Viewport lesbar (kein Überlaufen)

### Testfälle
- Backend/Logic: nicht zutreffend (reine UI-Anpassung)
- Frontend UI: `frontend/e2e/issue-1073-footer-address.spec.ts` (e2e-Akzeptanztest)
  - Test: AK1 – Adresse wird angezeigt, wenn `address` verfügbar ist
  - Test: AK2 – Koordinaten werden als Fallback angezeigt, wenn `address` null ist
  - Test: AK3 – Separator " | " steht zwischen Adresse und Version
  - Test: AK6 – Mobile-First: Text passt bei 375px Viewport
- Frontend Unit: `frontend/src/components/Footer.test.tsx` erweitern
  - Test: AK4 – Versionsnummer wird korrekt gerendert
  - Test: AK5 – `role="contentinfo"` ist vorhanden

### Ampel
- Ampel: 🟢
- Begründung: Anforderungen sind eindeutig, betroffene Dateien bekannt, `address` steht bereits über `useGeolocation` zur Verfügung, Umsetzung in einem PR machbar

### ✔️ Offene Fragen
- [ ] Keine

<!-- KI-ANALYSE:END -->

<!-- ai-phase-routing:START -->
| Phase | Run | Modell | Effort |
| --- | --- | --- | --- |
| ux | ja | sonnet | low |
| spec | ja | sonnet | low |
| impl | ja | sonnet | low |
| review | ja | sonnet | low |
<!-- ai-phase-routing:END -->
