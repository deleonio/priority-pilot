## Was ist das Problem?
In der Fußzeile der App werden aktuell die Koordinaten (Breiten- und Längengrad) und die Version der App angezeigt. Dies ist für Nutzer nicht intuitiv lesbar.

## Wie soll es sein?
Statt der Koordinaten soll die lesbare Adresse (aus Reverse Geocoding) angezeigt werden, gefolgt von der Versionsnummer. Zwischen Adresse und Version ist ein geeigneter Separator zu verwenden.

## Wo tritt es auf?
Die Anzeige betrifft die Footer-Komponente (`frontend/src/components/Footer.tsx`), die in der gesamten App am unteren Bildschirmrand sichtbar ist.

## Woran messen wir das?
- Fußzeile zeigt die lesbare Adresse aus `useGeolocation().address` an, wenn verfügbar
- Falls `address` nicht verfügbar ist (null/leer), werden die Koordinaten als Fallback angezeigt
- Adresse und Version werden durch den Separator " | " getrennt
- Die Versionsnummer wird weiterhin korrekt angezeigt
- Das `role="contentinfo"`-Attribut bleibt erhalten
- Mobile-First: Anzeige bleibt bei 375px Viewport lesbar (kein Überlaufen)

<!-- KI-ANALYSE:START stand=2026-08-27T20:30:14Z -->
### Umsetzungskontext
- Betroffene Dateien: `frontend/src/components/Footer.tsx`
- Betroffene Komponenten: `Footer` React-Komponente
- Vorhandenes Muster: `useGeolocation`-Hook liefert bereits `address` (String) aus Reverse Geocoding (Nominatim)
- Randbedingungen: Adresse kann `null` sein (keine Position, Rate-Limit, Fehler) – in diesem Fall Koordinaten als Fallback anzeigen
- Erwartetes Ergebnis: Fußzeile zeigt "<Adresse> | Version <version>" oder bei fehlender Adresse "<Koordinaten> | Version <version>"

### Akzeptanzkriterien
- AK1: Fußzeile zeigt die lesbare Adresse aus `useGeolocation().address` an, wenn verfügbar
- AK2: Falls `address` nicht verfügbar ist (null/leer), werden die Koordinaten als Fallback angezeigt
- AK3: Adresse und Version werden durch den Separator " | " getrennt
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

<!-- ai-phase-routing:START -->
| Phase | Run | Modell | Effort |
| --- | --- | --- | --- |
| ux | ja | sonnet | low |
| spec | ja | sonnet | low |
| impl | ja | sonnet | low |
| review | ja | sonnet | low |
<!-- ai-phase-routing:END -->
<!-- KI-ANALYSE:END -->

