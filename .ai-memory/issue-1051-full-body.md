### Was ist das Problem?

Im Header-Toolbar gibt es unterschiedliche Button-Varianten (Schalter), und im Such-Dialog ist der Mikrofon-Button versetzt.

### Wie soll es sein?

Alle Schalter im Header-Toolbar sollen einheitlich aussehen, und der Mikrofon-Button im Such-Dialog soll sauber ausgerichtet sein.

### Wo tritt es auf?

- Dashboard Header-Toolbar
- Such-Dialog (Mikrofon-Button)

### Woran messen wir das?

- Alle Schalter im Header-Toolbar haben konsistente Abmessungen/Platzierung
- Der Mikrofon-Button im Such-Dialog ist vertikal/horizontal sauber ausgerichtet
- Kein versetzter Button mehr

### Thema

UX/UI

### Komplexität

Einfach (klar definiert, Layout-Adjustment)

### Screenshots / weitere Hinweise (optional)

<img width="1006" height="599" alt="Image" src="https://github.com/user-attachments/assets/21c7b575-225d-434f-9394-6b683b91592d" />

<!-- KI-ANALYSE:START stand=2026-08-27T02:21:43Z -->
### Umsetzungskontext
- Betroffene Dateien: `frontend/src/App.tsx`, `frontend/src/app.css`
- Betroffene Komponenten: `toolbarItems` in `App.tsx:387-439` (Kopf-Toolbar via `KolToolbar`, gerendert in `App.tsx:477`), CSS `.voice-field--input > .mic-button` in `frontend/src/app.css:1279-1283` (Mic-Button des `VoiceField`, genutzt im `SearchModal.tsx:45-65`)
- Vorhandenes Muster: fuenf der sechs Toolbar-Items sind bereits `_variant: 'secondary'` (`App.tsx:394/410/418/426/434`); Bottom-Anker des Mic-Buttons am Wrapper mit dokumentierter Kalibrier-Logik (`app.css:1258-1274`)
- Randbedingungen: KoliBri rendert die Toolbar-Buttons im Shadow-DOM — Varianten nur ueber `_variant` der Items steuern, nicht per Light-DOM-CSS; `VoiceField variant="input"` wird ausser dem Such-Dialog auch in `TaskForm`, `QuickCaptureModal` und `PillarAdvisorModal` genutzt — die CSS-Korrektur wirkt global und darf dort nichts verschlechtern; Mic-Button bleibt `tabIndex={-1}` (#522 AC2c); Toolbar-Button-Hoehe haengt an `--pp-toolbar-height`/`--a11y-min-size` (`app.css:360-362`), nicht anfaessen
- Erwartetes Ergebnis: alle sechs Kopf-Toolbar-Buttons zeigen dieselbe Variante; der Mikrofon-Button im Such-Dialog sitzt vertikal mittig IN der Inputbox statt am oberen Rand klebend

### Ursachenanalyse
1. Toolbar: "Neuen Task anlegen" ist als einziges Item `_variant: 'primary'` (`App.tsx:402`), die anderen fuenf sind `secondary` → genau der im Screenshot dunkel gefuellte Button.
2. Mic-Button: `.voice-field--input > .mic-button` zentriert mit `top: 50%; transform: translateY(-50%)` auf den GESAMTEN `.voice-field`-Wrapper — der umschließt das sichtbare Label ÜBER der Inputbox (`KolInputText` rendert Label und Input im Shadow-DOM) → der Button wandert um ca. die halbe Label-Hoehe zu hoch und klebt an der oberen Inputkante (matcht den Screenshot: Mitte des Buttons auf Hoehe der Input-Oberkante).

### Loesungsschritte
1. `App.tsx:402`: `_variant: 'primary'` → `'secondary'` — damit sind alle sechs Items einheitlich (Mehrheits-Variante, keine neuen Design-Entscheidungen noetig).
2. `app.css:1279-1283`: vertikale Positionierung des Mic-Buttons an der Inputbox statt am Gesamt-Wrapper ausrichten — z. B. Bottom-Anker mit kalibrierbarer Inputbox-Höhe als Custom Property (der CSS-Kommentar `app.css:1276-1278` sieht genau diese Kalibrierung bereits vor). Vor dem Fix die anderen `variant="input"`-Call-Sites (TaskForm, QuickCaptureModal, PillarAdvisorModal) gegenchecken.

### Akzeptanzkriterien
- AK1: Alle sechs Buttons der Kopf-Toolbar rendern mit derselben KoliBri-Variante — kein einzelner Button mit abweichender Fuellung/Farbe.
- AK2: Im Such-Dialog liegt die vertikale Mitte des Mikrofon-Buttons innerhalb der Inputbox (zwischen Ober- und Unterkante des Eingabefelds) und der Button bleibt vollstaendig innerhalb des Feldes sichtbar.
- AK3 (Mobile-first, 375px): Auch bei 375px Viewport bleiben die Kopf-Toolbar-Buttons einheitlich und der Mikrofon-Button im Such-Dialog korrekt ausgerichtet.

### Testfälle
- AK1: e2e `frontend/e2e/*.spec.ts` (Stil `crud.spec.ts`): Kopf-Toolbar-Buttons per shadow-piercing Locator einsammeln (Playwright pierct offene Shadow-Roots) und gleiche berechnete Hintergrundfarbe aller sechs Buttons asserten.
- AK2: e2e: Such-Dialog oeffnen, Bounding-Boxen messen — `mic-button` (Light-DOM, `.voice-field--input > .mic-button`) Center-Y innerhalb `[input.y, input.y + input.height]` und rechte Kante ≤ rechte Input-Kante (`input[type=search]` im KoliBri-Shadow-DOM via Locator erreichbar).
- AK3: gleiche Pruefungen wie AK1/AK2 in einem zweiten Lauf mit `viewport: { width: 375, height: ... }`.
- Ebene: Feature/UI-Verhalten → acceptance e2e; die reine CSS-Geometrie (AK2) wird per Bounding-Box-Messung verifiziert, nicht per Screenshot.

### Ampel
- Ampel: 🟢
- Begründung: beide Ursachen im Code eindeutig lokalisiert (`App.tsx:402`, `app.css:1279-1283`), ein PR, keine offenen fachlichen Fragen, AKs verifizierbar formuliert.

### ❓ Offene Fragen
- keine
<!-- KI-ANALYSE:END -->

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

<!-- ai-phase-routing:START -->
| Phase | Run | Modell | Effort |
| --- | --- | --- | --- |
| ux | ja | haiku | low |
| spec | ja | sonnet | low |
| impl | ja | sonnet | low |
| review | ja | sonnet | medium |
<!-- ai-phase-routing:END -->
