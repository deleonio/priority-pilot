# Issue 691 — Header-Konsistenz über alle Viewports

**Stand:** 2026-08-23  
**Version:** v1.1 (2026-08-23): Nightly-Sync — Kopf-Aktionen um „Säulen-Berater" ergänzt (im Code vorhanden, fehlte in der Liste).  
**Issue:** #691 "Header-Menü konsistent über alle Bildschirmbreiten"

## Ziel

Das Header-Menü zeigt auf allen Bildschirmbreiten (Desktop, Tablet, Mobile) **immer dieselbe Menüstruktur**. Das Bürgermenü wird ersatzlos entfernt – keine unterschiedliche Menüführung je nach Viewport-Breite.

## Vorbedingung

- App ist gestartet und geladen
- Benutzer ist angemeldet (Fixture: { name: 'Test User', email: 'test@example.com' })

## Schritte

1. **Header bei Desktop-Breite (>1024px) prüfen**
   - Viewport auf 1280×800 setzen
   - App laden (/) → Header sichtbar
   - Toolbar „Kopf-Aktionen" prüfen: Bürgermenü nicht vorhanden (Count 0)

2. **Header bei Tablet-Breite (768–1024px) prüfen**
   - Viewport auf 768×1024 setzen
   - App laden (/) → Header sichtbar
   - Toolbar „Kopf-Aktionen" prüfen: Bürgermenü nicht vorhanden (Count 0)

3. **Header bei Mobile-Breite (<768px) prüfen**
   - Viewport auf 375×812 setzen
   - App laden (/) → Header sichtbar
   - Toolbar „Kopf-Aktionen" prüfen: Bürgermenü nicht vorhanden (Count 0)

4. **Menüstruktur-Konsistenz prüfen**
   - Bei allen drei Viewports dieselben Menüpunkte vorhanden
   - Keine Elemente erscheinen nur in bestimmten Breiten

## Erwartetes Ergebnis

- Bürgermenü existiert in **keinem** Viewport (Count 0 bei allen Breiten)
- Toolbar-Buttons sind bei allen Viewports vorhanden: „Neuen Task anlegen", „Säulen-Berater", „Einstellungen", „Hilfe", „Abmelden"
- Keine unterschiedlichen Menüstrukturen je nach Viewport-Breite
- Responsive-Verhalten nur durch Layout/Positionierung, nicht durch Entfernen von Menüpunkten

## Testfälle (abgeleitete Akzeptanzkriterien)

| Viewport           | Erwartetes Verhalten       | Assertion                                                |
| ------------------ | -------------------------- | -------------------------------------------------------- |
| Desktop (1280×800) | Bürgermenü nicht vorhanden | `getByRole('button', { name: /Bürger/ }).toHaveCount(0)` |
| Tablet (768×1024)  | Bürgermenü nicht vorhanden | `getByRole('button', { name: /Bürger/ }).toHaveCount(0)` |
| Mobile (375×812)   | Bürgermenü nicht vorhanden | `getByRole('button', { name: /Bürger/ }).toHaveCount(0)` |
| Alle Viewports     | Menüstruktur konsistent    | Dieselben Buttons bei allen Breiten sichtbar             |

## Hinweise zur Test-Strategie

- **NUR Anwendungscode-Pfade:** Frontend-e2e Tests unter `frontend/e2e/`
- **UI-Änderung:** Visuelle Verifikation ist im PR-Body durch Screenshots zu begründen
- **Mutations-Resistenz:** Tests prüfen das **Fehlen** des Bürgermenüs (Count 0), nicht nur Layout-Änderungen
- **All-Quantor-Test-Falle:** Sicherstellen, dass überhaupt Toolbar-Buttons gefunden werden (nicht dauerhaft grün über leere Menge)
