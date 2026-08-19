# Issue 865: Avatar und User Full Name entfernen

**Stand:** 2026-08-19
**Ziel:** Entfernung von sichtbaren UI-Elementen (Avatar, Benutzername) aus dem Header-Bereich zur Vereinfachung der Benutzeroberfläche.

---

## Ziel

Avatar und User Full Name aus dem Header-Layout entfernen, ohne die Layout-Integrität oder Responsivität zu beeinträchtigen.

## Vorbedingung

- Priority Pilot App ist geladen
- Header-Bereich ist sichtbar (Desktop/Mobile)

## Schritte

1. **Header-Struktur vor Entfernung**
   - Desktop-Header enthält: Logo, Avatar+Name, KI-Modellauswahl, Toolbar
   - Mobile-Header (375px): Nur Avatar sichtbar, Full name bereits ausgeblendet

2. **Avatar-Element entfernen**
   - Avatar-Element wird aus dem Template/DOM entfernt
   - Keine broken references/undefined Props durch Entfernung

3. **User Full Name entfernen**
   - Full-name-Element wird aus dem Template/DOM entfernt
   - Begrüßungstext „Hallo Lokaler Modus!" bleibt erhalten (redundante Entfernung okay laut UX-Block)

4. **Layout-Integrität prüfen**
   - Keine Bruchstellen/Leerräume verbleiben im Layout
   - Toolbar-Aktionen bleiben ≥44px Touch-Targets
   - Responsive Layouts: Mobile (375px), Tablet (768px), Desktop (1440px)

## Erwartetes Ergebnis

- Avatar ist nicht mehr im DOM vorhanden
- User Full Name ist nicht mehr im DOM vorhanden
- Header zeigt: Logo, KI-Modellauswahl, Toolbar (ohne Leerräume)
- Keine console.error oder console.warning nach Entfernung
- Responsivität bleibt vollständig erhalten
- Toolbar-Aktionen bleiben über Tab-Fokus erreichbar (Screenreader)

## Randfälle & Fehler

| Viewport         | Erwartetes Verhalten                                   |
| ---------------- | ------------------------------------------------------ |
| Mobile (375px)   | Nur Avatar entfernen, Full name bereits nicht sichtbar |
| Tablet (768px)   | Avatar+Name entfernt, keine Leerräume                  |
| Desktop (1440px) | Avatar+Name entfernt, Layout komprimiert sich korrekt  |
| Touch-Targets    | Toolbar-Buttons bleiben ≥44px                          |

## UX-Referenz

- UX-Block im Issue bestätigt: keine Auswirkung auf kritische User-Flows
- Toolbar-Aktionen bleiben unverändert, nur visuelle Optimierung

---

## Versionierung

- **v1.1** (2026-08-19): Nightly-Sync — Ist-Stand verifiziert, Avatar/Name entfernt
- **v1.0** (2026-08-18): Initialefassung für Issue #865
