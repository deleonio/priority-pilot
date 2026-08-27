<!-- KI-UX:START -->

## UX-Beratung

### Interaktion

Die Kopf-Toolbar enthält sechs gleichrangige Aktionen (Einstellungen, Filter, Tasks, QuickCapture, Such-Dialog, Task anlegen). Alle dienen der Navigation/Utility, nicht dem Primär-Flow des Dashboards. Die derzeitige Variante-Mischung (ein `primary`, fünf `secondary`) signalisiert eine falsche Hierarchie: Toolbar-Items sind auf gleicher Ebene und sollten visuell neutral auftreten. **Empfehlung:** Alle sechs Toolbar-Buttons auf `_variant: 'secondary'` vereinheitlichen — das entspricht ihrem Charakter als sekundäre Aktionen.

Der Mikrofon-Button im Such-Dialog ist visuell vom Input entkoppelt (oberes kleben statt vertikales Zentrieren). Das beeinträchtigt die semantische Zuordnung "Mikrofon gehört zur Such-Eingabe". Die geplante CSS-Korrektur (Bottom-Anker mit kalibrierbarer Inputbox-Höhe) stellt die wahrgenommene Zusammengehörigkeit wieder her.

### Mobile-First

Bei 375px Viewport bleiben die Toolbar-Buttons durch KoliBri-Basis (`--a11y-min-size: 2.75rem`) ausreichend tappbar (≥44px). Die Varianten-Vereinheitlichung verbessert die visuelle Konsistenz auf kleinen Screens, wo Toolbar-Items dichter gepackt sind. Der Mikrofon-Button liegt in der Inputbox — er bleibt bei 375px vollständig im Feld sichtbar und geht nicht über die rechte Kante hinaus (entspricht AK2/AK3 aus der Analyse).

### A11y/BITV

KoliBri-Components sind BITV-2.1-konform. Die Varianten-Änderung beeinflusst Fokus-Indikatoren nicht — diese bleiben in Hell/Dunkel sichtbar (`--pp-focus-ring`). Der Mikrofon-Button behält `tabIndex={-1}` (#522 AC2c) und ist damit dekorativ; die CSS-Korrektur ändert nichts an seiner A11y-Rolle. Screenreader lesen die Toolbar-Items weiterhin in DOM-Reihenfolge, unabhängig von `_variant`.

### KoliBri

`KolToolbar` mit `_items` ist die korrekte Komponentenwahl. Die Toolbar rendert Buttons im Shadow-DOM — Varianten werden über `_variant` der Items gesteuert, nicht per Light-DOM-CSS. Die geplante Änderung (`_variant: 'primary'` → `'secondary'` in `App.tsx:402`) greift diesen Mechanismus und ist sauber umsetzbar. Für den Mikrofon-Button gibt es kein KoliBri-Äquivalent (`VoiceField` ist Custom) — die CSS-Korrektur in `app.css:1279-1283` ist der richtige Weg.

### Design-Sprache

Das Muster "Ruhe vor Reichtum" (ux-design.md) verlangt, dass Farbe ein Signal ist, nicht Dekoration. Ein einzelner `primary`-Button in einer Gruppe von Utility-Aktionen ist kein semantisches Signal, sondern visuelles Rauschen. Die einheitliche `secondary`-Variante entspricht der Rolle der Toolbar als neutrale Navigationsleiste — die eigentliche Primäraktion des Dashboards ist das Task-Management, nicht der Toolbar-Button.

Der Mikrofon-Button ist mit `bottom`-Anker und Custom Property für die Inputbox-Höhe kalibrierbar (app.css:1258-1274) — das entspricht der Tokenisierung in ux-design.md (feste Skalen statt Magic Numbers).

### Offene UX-Fragen

Keine — das Problem ist lokalisiert und die Lösung ist aus UX-Sicht klar. Die CSS-Korrektur für den Mikrofon-Button sollte gegen die anderen `variant="input"`-Call-Sites (TaskForm, QuickCaptureModal, PillarAdvisorModal) verifiziert werden, um Kollateralschäden auszuschließen.

<!-- KI-UX:END -->
