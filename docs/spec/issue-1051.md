# Header-Toolbar-Buttons einheitlich + Mikrofon-Button ausrichten

**Stand:** 2026-08-30

## Ziel

Alle sechs Buttons der Kopf-Toolbar rendern mit derselben KoliBri-Variante.
Der Mikrofon-Button im Such-Dialog ist vertikal mittig in der Inputbox ausgerichtet.

## Vorbedingung

- App ist geladen und authentifiziert (Dashboard sichtbar)

## AK1 — Toolbar-Varianten einheitlich

### Schritte

1. Alle Buttons der Toolbar „Kopf-Aktionen" einsammeln.
2. Für jeden Button die berechnete Hintergrundfarbe (`getComputedStyle().backgroundColor`) ermitteln.

### Erwartetes Ergebnis

- Alle sechs Buttons haben dieselbe berechnete Hintergrundfarbe.

## AK2 — Mikrofon-Button vertikal in Inputbox zentriert

### Schritte

1. Such-Modal über Toolbar-Button „Suche" öffnen.
2. Bounding-Box des Mikrofon-Buttons (`.voice-field--input > .mic-button`) messen.
3. Bounding-Box des Eingabefelds (`role=searchbox`) messen.

### Erwartetes Ergebnis

- Die vertikale Mitte des Mikrofon-Buttons liegt innerhalb der Inputbox (zwischen `input.y` und `input.y + input.height`).
- Der Mikrofon-Button ist vollständig innerhalb des Feldes sichtbar (rechte Kante ≤ rechte Input-Kante).

## AK3 — Mobile-First (375px)

### Schritte

1. Viewport auf 375×812 setzen.
2. AK1 und AK2 wiederholen.

### Erwartetes Ergebnis

- Gleiche Ergebnisse wie AK1/AK2 bei 375px Viewportbreite.

## Randbedingungen

- Der Mikrofon-Button ist nicht per Tastatur fokussierbar (kein Tab-Stopp).
- Die Ausrichtung des Mikrofon-Buttons gilt für alle Eingabefelder mit Sprachaufnahme (Suchdialog, Task-Formular, Schnellerfassung, Säulen-Berater).
