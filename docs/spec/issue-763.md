# Säulen-Gewichtung Layout-Optimierung

**Stand:** 2026-08-23  
**Issue:** #763  
**Ziel:** Visuelle Überlagerungen bei Säulen-Gewichtung beheben, responsives Layout für Range Sliders

## Ziel

Keine visuellen Überlagerungen mehr im Säulen-Gewichtungs-Bereich, Range Slider sind klar positioniert und das Layout funktioniert auf verschiedenen Viewports.

## Vorbedingung

- Nutzer ist angemeldet
- Säulen-Gewichtungsseite ist geöffnet (Säulen-Management)

## Schritte

1. **Säulen-Gewichtungsseite laden**
   - Seite mit Säulen-Cards und Range Sliders wird angezeigt
   - Alle Elemente sind sichtbar ohne Überlappung

2. **Range Slider bedienen**
   - Range Slider sind innerhalb der Säulen-Cards integriert
   - Slider-Änderung zeigt sofortigen Live-Feedback (Wert-Indikator)
   - Keine Layout-Probleme bei Slider-Bedienung

3. **Responsivität prüfen**
   - Desktop (>1024px): 3-4-spaltiges Layout
   - Tablet (768-1024px): 2-spaltiges Layout
   - Mobile (<768px): 1-spaltiges Stack-Layout

4. **Beschreibungstexte prüfen**
   - Beschreibungstexte sind als in-Card Labels oder Tooltips platziert
   - Keine redundanten Texte, die Überlagerungen verursachen

## Erwartetes Ergebnis

- **Keine visuellen Überlagerungen**: Alle Elemente im Säulen-Gewichtungs-Bereich sind ohne Überlappung sichtbar
- **Range Slider positioniert**: Slider sind klar innerhalb der Säulen-Cards positioniert
- **Responsive Layout**: Layout funktioniert auf Desktop, Tablet und Mobile
- **Touch-Ziele**: Range Slider haben mindestens 44px Touch-Ziele (Mobile-First)
- **Live-Feedback**: Slider-Änderungen zeigen sofortigen Wert-Indikator
- **A11y**: Range Slider haben `<label>`, `<output>`, und ARIA-Attribute

## Randfälle

| Situation                      | Erwartetes Verhalten                       |
| ------------------------------ | ------------------------------------------ |
| Viewport <768px                | Stack-Layout, Säulen-Cards untereinander   |
| Range Slider zu nah beeinander | Mindestens 44px Touch-Ziele, kein Überlapp |
| Beschreibungstexte zu lang     | Text kürzen oder als Tooltip auslagern     |

## UX-Details

- **Range Slider Integration**: Slider direkt in Säulen-Cards integriert (spart Platz)
- **Live-Feedback**: Wert-Indikator sofort bei Slider-Änderung sichtbar
- **Mobile-First**: Breakpoints: <768px (1-spaltig), 768-1024px (2-spaltig), >1024px (3-4-spaltig)
- **Touch-Ziele**: Mindestens 44px für Range Slider
- **A11y/BITV**: `<label>`, `<output>`, ARIA-Attribute für Screenreader
