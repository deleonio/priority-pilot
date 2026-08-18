# Issue 886: LLM-Provider-Button-Layout-Fix

## Ziel

Der "Speichern"-Button im LLM-Provider-Settings-Formular ist vollständig sichtbar und der Button-Container nutzt die verfügbare Breite responsiv aus.

## Vorbedingung

- User befindet sich auf der LLM-Provider-Settings-Seite
- Ein LLM-Provider ist ausgewählt
- Viewport kann Desktop (≥1024px), Tablet (768-1023px) oder Mobile (≤767px) sein

## Schritte

1. User öffnet die LLM-Provider-Settings-Seite
2. User gibt API-Key ein (optional)
3. User prüft den "Speichern"-Button am unteren Rand des Formulars

## Erwartetes Ergebnis

1. **Desktop-Viewport (≥1024px):** Der "Speichern"-Button ist vollständig sichtbar (Text "Speichern" komplett lesbar), kein horizontaler Scroll erforderlich
2. **Tablet-Viewport (768-1023px):** Der "Speichern"-Button ist vollständig sichtbar, ggf. mit Zeilenumbruch im Button-Container
3. **Mobile-Viewport (≤767px):** Button-Text vollständig lesbar, kein horizontales Scrollen (einzelner Button benötigt kein vertikales Stapeln)

## Technische Anforderungen

- Button-Container nutzt `display: flex` mit `flex-wrap: wrap`
- Container-Breite `width: 100%` sichern
- Buttons haben `min-width: 0` um Flexbox-Overflow zu verhindern
- Kein horizontaler Scroll auf Viewports ≤768px, Button-Text vollständig lesbar

## Akzeptanzkriterien-Referenz

- AK1: Button "Speichern" vollständig sichtbar
- AK2: Button-Container nutzt verfügbare Breite
- AK3: Responsive ohne Abschneideeffekte auf kleinen Viewports
