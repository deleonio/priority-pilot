# Geo-Badge hinter dem Task-Titel

**Stand:** 2026-08-30

## Ziel

Im TaskTree (Aufgaben-Liste) steht das Globus-Badge unmittelbar hinter dem Titeltext — durch genau ein geschütztes Leerzeichen (U+00A0) getrennt —, damit der Ortsbezug direkt am Aufgabennamen ablesbar ist und die Badge-Gruppe nur Status-Aussagen (Serie, geändert, Fortschritt, Priorität) trägt.

## Verhalten

### Badge-Position in der Task-Zeile

Bei einer Task-Zeile mit Ortsbezug (`latitude != null || address != null`) liegt das Element `data-testid="geo-badge"` innerhalb des Zeilen-Headers `task-tree-row-header` und im DOM unmittelbar nach dem Titel (`.task-tree-title`) sowie vor `task-tree-row-controls`.

### Genau ein geschütztes Leerzeichen, gemeinsame Umbrucheinheit

Zwischen Titel und Icon steht genau ein Textknoten U+00A0 (kein normales Leerzeichen, kein Mehrfaches). Titel + Icon bilden eine Umbrucheinheit: Bei schmalem Viewport bricht das Icon nicht isoliert in eine eigene Zeile unterhalb des Titeltexts um.

### Badge-Gruppe ohne Geo-Badge

Die Badge-Gruppe `.task-tree-badges` enthält kein `geo-badge`. Sie trägt die Status-Badges Serie, geändert, Fortschritt und Priorität vor dem „…"-Menüschalter, in dieser Reihenfolge.

### Zeilen ohne Ortsbezug

Bei einer Zeile ohne Ortsbezug existiert weder ein `geo-badge` noch ein U+00A0-Textknoten hinter dem Titel.

### GeoBadge-Vertrag

Das Badge ist `role="img"` mit `aria-label="Standort: …"` (aufgelöste Adresse aus dem Reverse-Geocoding, sonst Fallback) und `data-testid="geo-badge"`.

### 375px

Bei 375px überläuft die Task-Zeile mit langem Titel (30 Zeichen) und Globus-Icon den Viewport nicht.
