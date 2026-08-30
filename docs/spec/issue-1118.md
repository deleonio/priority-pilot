# Dashboard-Sektionen als Cards mit Gleichhöhe

**Stand:** 2026-08-30

Jede inhaltliche Dashboard-Sektion ist eine eigenständige `KolCard` — mit Sektionsüberschrift als Card-Label (`_label`) statt separatem `<h3>` — und im zweispaltigen Desktop-Layout schließen zwei nebeneinanderliegende Karten auf gleicher Höhe ab. Auf schmalen Viewports bleibt die einspaltige, inhaltsgetriebene Darstellung unverändert.

## Verhalten

### Je Sektion genau eine Card

Jede der sechs Sektionen `.dashboard-next-task`, `.dashboard-suggestions`, `.dashboard-top-tasks`, `.dashboard-pillars`, `.dashboard-balance` und `.dashboard-deadlines` enthält im DOM **genau ein** `kol-card`-Element. „In der Nähe" (`NearbyCard`) bringt seine Card selbst mit und bleibt genau eine Card — es entsteht kein `kol-card` in `kol-card`. Leerzustände (z. B. „Keine Säulen vorhanden") stehen als Inhalt **in** der Sektions-Card, nicht als eigene zweite Card.

### Card-Label statt `<h3>`

Die Sektionsüberschrift steht als `_label` am jeweiligen `KolCard`; die Sektionen rendern kein separates `<h3>` (keine doppelte Überschrift im Accessibility-Tree). `_level` ist so gesetzt, dass die Card-Überschriften als **dritte Ebene** unter dem Dashboard-`<h2>` ausgelesen werden (`_level="3"`). Die Region „Nächste Aufgabe" bleibt benannt (Name „Nächste Aufgabe"). Die Kennzahlen-Kacheln (`_level={0}`) und die Begrüßung sind keine Sektions-Cards.

### Leerzustände innerhalb der Card

Sektions-Leerzustände („Keine anstehenden Deadlines.", „Aktuell stehen keine weiteren Vorschläge an.", „Keine offenen Aufgaben vorhanden.", „Noch keine Punkte vergeben …", Leerzustand „Meine Themen", „Aktuell steht keine Aufgabe an …") werden **innerhalb** der jeweiligen Sektions-Card gerendert, nicht daneben.

### Gleichhöhe im Desktop-Grid (1280 px)

Bei 1280 px stehen die sechs Sektions-Cards zweispaltig. Karten derselben Grid-Zeile (identische Oberkante) haben identische rendernde Höhe (`offsetHeight`-Differenz 0), auch wenn eine Karte z. B. 8 Listeneinträge und die andere nur 3 enthält.

### Mobil 375 px einspaltig

Bei 375 px stehen alle Sektions-Cards einspaltig untereinander in der Reihenfolge Nächste Aufgabe → Was ist jetzt dran? → In der Nähe → Wichtigste Tasks → Meine Themen → Gesamtguthaben → Anstehende Deadlines. Gemessen wird über Bounding-Boxen (`el.x >= 0` und `el.x + el.width <= 375`); `document.documentElement.scrollWidth` taugt in dieser App nicht als Messwert (App-Shell clippt mit `overflow-x: hidden`).

### Volle Breite der Hauptaussagen

„Nächste Aufgabe", „Was ist jetzt dran?", die Kennzahlen-Kacheln und die Begrüßung belegen im Desktop-Layout die volle Grid-Breite (`grid-column: 1 / -1`, Bounding-Box-Breite ≈ Grid-Innenbreite).

### Signalfäche und Bedienbarkeit

Die Signalfläche der Sektion „Nächste Aufgabe" bleibt sichtbar: mindestens ein Element innerhalb der Region (Light-DOM oder Shadow-DOM) malt effektiv den aufgelösten Wert von `--pp-signal-wash` als Hintergrund. Der Button „Jetzt starten" bleibt per Tastatur fokussierbar und mit Enter auslösbar (Task-Status wechselt).
