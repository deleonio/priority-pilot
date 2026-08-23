# Issue 865: User Full Name entfernen (Avatar behalten)

**Stand:** 2026-08-23  
**Version:** v1.1 (2026-08-23): Nightly-Sync — Begrüßungstext sitzt im Dashboard, nicht im Header; Ist-Aussage korrigiert.  
**Ziel:** Nur User Full Name aus dem Header-Bereich entfernen, Avatar bleibt bestehen.

---

## Ziel

Nur User Full Name aus dem Header-Layout entfernen, ohne die Layout-Integrität oder Responsivität zu beeinträchtigen. Der Avatar wird wiederhergestellt und bleibt sichtbar.

## Vorbedingung

- Priority Pilot App ist geladen
- Header-Bereich ist sichtbar (Desktop/Mobile)

## Schritte

1. **Header-Struktur vor Korrektur**
   - Desktop-Header enthält: Logo, Avatar, KI-Modellauswahl, Toolbar
   - Mobile-Header (375px): Avatar sichtbar

2. **Avatar wiederherstellen**
   - Avatar-Element wird wieder zum DOM hinzugefügt
   - Avatar zeigt `user.avatarUrl` (falls vorhanden)

3. **User Full Name entfernen**
   - Full-name-Element bleibt aus dem DOM entfernt
   - Der Begrüßungstext („Hallo …") lebt im Dashboard-Bereich, nicht im Header

4. **Layout-Integrität prüfen**
   - Keine Bruchstellen/Leerräume im Layout
   - Toolbar-Aktionen bleiben ≥44px Touch-Targets
   - Responsive Layouts: Mobile (375px), Tablet (768px), Desktop (1440px)

## Erwartetes Ergebnis

- Avatar ist im DOM vorhanden und sichtbar
- User Full Name ist nicht mehr im DOM vorhanden
- Header zeigt: Logo, Avatar, KI-Modellauswahl, Toolbar (ohne Leerräume)
- Keine console.error oder console.warning
- Responsivität bleibt vollständig erhalten
- Toolbar-Aktionen bleiben über Tab-Fokus erreichbar (Screenreader)

## Randfälle & Fehler

| Viewport         | Erwartetes Verhalten                      |
| ---------------- | ----------------------------------------- |
| Mobile (375px)   | Avatar sichtbar, Full name nicht sichtbar |
| Tablet (768px)   | Avatar sichtbar, Full name nicht sichtbar |
| Desktop (1440px) | Avatar sichtbar, Full name nicht sichtbar |
| Touch-Targets    | Toolbar-Buttons bleiben ≥44px             |

## UX-Referenz

- Korrektur: Avatar bleibt bestehen, nur Full Name wird entfernt
- Toolbar-Aktionen bleiben unverändert
- Visuelle Optimierung durch Entfernung redundanter Informationen (Full Name)
