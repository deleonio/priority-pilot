# Issue 761 – Layout-Optimierung Titel/Beschreibung/Aktionen

**Stand:** 2026-08-19
**Issue:** #761
**Bezug:** KI-UX-Block im Issue-Body (KI-UX:START bis KI-UX:END)

## Ziel

Layout von Titel, Beschreibung und Aktionen optimieren: Titel und Beschreibung nutzen die volle verfügbare Breite, Aktionen sind rechtsbündig unterhalb platziert. Das Layout ist übersichtlicher als im IST-Zustand und responsive-design-fähig.

## Vorbedingung

- Nutzer ist in der App angemeldet
- Eine Ansicht mit Titel/Beschreibung/Aktionen ist sichtbar (z.B. Task-Detail, Dashboard-Widget, oder Formular)

## Schritte

1. **Layout-Inspektion (IST)**
   - Titel und Beschreibung nutzen nicht die volle verfügbare Breite
   - Aktionen sind nicht klar rechtsbündig unterhalb angeordnet
   - Layout wirkt unübersichtlich

2. **Layout-Transformation (SOLL)**
   - Titel-Element nimmt volle verfügbare Breite ein
   - Beschreibung-Element nimmt volle verfügbare Breite ein (unterhalb des Titels)
   - Aktionen-Gruppe ist rechtsbündig unterhalb von Titel/Beschreibung platziert
   - Responsive-Verhalten: Bei Mobile (Breakpoint < 768px) ggf. Aktionen gestapelt fullWidth

3. **Layout-Verifikation**
   - Titel und Beschreibung nutzen die volle Breite des Containers
   - Aktionen sind am rechten Rand ausgerichtet
   - Abstände sind visuell balanciert
   - Responsive-Verhalten bei verschiedenen Viewport-Größen

## Erwartetes Ergebnis

- Titel und Beschreibung nehmen die volle verfügbare Breite ein
- Aktionen sind rechtsbündig unterhalb von Titel/Beschreibung platziert
- Layout ist übersichtlicher als im IST-Zustand (Vergleich mit Screenshot im Issue)
- Responsive Design ist gewährleistet (Mobile, Tablet, Desktop)
- Touch-Ziele sind ausreichend groß (min. 44x44px laut KoliBri)
- A11y-Requirements sind erfüllt (Logical Tab-Order, Focus-Indikator, Screenreader-Support)

---
## Versionierung

- **v1.1** (2026-08-19): Nightly-Sync — Ist-Stand verifiziert, Layout-Optimierung implementiert
- **v1.0** (2026-08-17): Initialefassung für Issue #761