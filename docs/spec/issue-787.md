# Issue 787 – Header-Layout

**Stand:** 2026-08-25  
**Ziel:** Header-Layout optimieren und stabil halten

---

## Journey 1: Header-Layout auf Desktop

### Ziel

Header zeigt die Elemente in der Reihenfolge Logo → Name → Toolbar → Avatar.

### Vorbedingung

- Nutzer ist angemeldet
- Anwendung ist auf Desktop-Viewport geöffnet (≥600px)

### Schritte

1. **Header-Elemente identifizieren**
   - Logo (App-Icon/Brand)
   - App-Name „Priority Pilot"
   - Toolbar mit den fünf Kopf-Aktionen (#691: „Neuen Task anlegen", „Säulen-Berater", „Einstellungen", „Hilfe", „Abmelden")
   - User-Avatar mit Profil-Bild

2. **Reihenfolge prüfen**
   - Visuelle Anordnung von links nach rechts: Logo → Name → Toolbar → Avatar
   - Avatar ist das letzte Element ganz rechts im Header
   - Keine Elemente außerhalb dieser Sequenz

### Erwartetes Ergebnis

- Header-Layout folgt strikt der Reihenfolge: Logo → Name → Toolbar → Avatar
- Keine Layout-Shifts oder broken images
- Toolbar-Elemente sind gleichmäßig ausgerichtet

### Abgrenzung: ARIA-Rolle `toolbar`

Die Rolle `toolbar` trägt allein die KoliBri-Toolbar (`kol-toolbar`), die auch deren
Tastatur-Erwartung (Pfeiltasten-Navigation zwischen den Items) umsetzt. Der umgebende Container
bekommt **kein** zweites `role="toolbar"`: Das ergäbe verschachtelte Toolbars mit identischem
Accessible Name und verspräche eine Pfeiltasten-Navigation, die er nicht implementiert.

### Abgrenzung: KI-Modell-Auswahl

Die KI-Modellwahl lebt seit dem Provider-System (#951) in den Einstellungen (Tab „KI-Provider")
— es gibt keinen Einstieg mehr in der Kopfzeile. Frühere Journeys dazu (Toolbar-Button,
Modell-Dialog, #929/#965) sind obsolet.

---

## Journey 2: Responsive Verhalten

### Ziel

Der Header funktioniert auf allen Viewports.

### Vorbedingung

- Anwendung ist auf Mobile- (<48rem) und Tablet-/Desktop-Viewport (≥48rem) geöffnet

### Schritte

1. **Mobile-Layout prüfen**
   - Header-Height konsistent (kein Layout-Shift bei Toolbar-Änderungen)
   - Toolbar-Elemente passen in Viewport

2. **Breakpoint-Test**
   - Unter und ab 48rem (768px): alle fünf Kopf-Aktionen (icon-only) im Header
   - Ab 64rem (1024px): zusätzlich der App-Name im Header

### Erwartetes Ergebnis

- Keine horizontalen Scrollbars oder Überläufe
- Touch-Ziele der Kopf-Aktionen mindestens 44×44px (WCAG 2.5.5)
- Header-Height bleibt stabil

### Abgrenzung: App-Name und Logo

Der Header trägt den App-Namen **als `span`, nicht als Überschrift** — es gibt keine zweite
Text-H1 im Header. Das Logo ist icon-only, der Name ist also nicht redundant. Der zugehörige
E2E-Vertrag in `header-logo.spec.ts` prüft beides.

### Abgrenzung: „Header-Height bleibt stabil"

Gemeint ist die Stabilität **nach** dem Aufbau der Ansicht: Ist die Toolbar ausgelayoutet, darf
keine Interaktion die Header-Höhe verändern. Während der Hydration wächst der Header dagegen
erwartungsgemäß auf seine Endhöhe — `kol-toolbar` baut ihre Buttons asynchron im Shadow-DOM auf.

Auf 375px bleibt der Header einzeilig (Vertrag aus #485 AK6 / #718 AK4): Logo, Avatar und die fünf
Kopf-Aktionen (#691) füllen die Zeile aus. Ein zweizeiliger Umbruch tritt nicht ein; die
Anforderung „keine horizontalen Überläufe" bleibt erfüllt.

---

## Journey 3: A11y und Kontrast

### Ziel

Alle UI-Elemente erfüllen BITV 2.1 Kontrast-Anforderungen.

### Vorbedingung

- Header ist sichtbar mit allen Elementen

### Schritte

1. **Kontrast-Prüfung**
   - Text-Icons ≥4.5:1 Kontrast
   - UI-Elemente ≥3:1 Kontrast (BITV 2.1.1)
   - Focus-Indikator ≥3:1 Kontrast

2. **Tastatur-Navigation vollständig**
   - Tab-Reihenfolge folgt der visuellen Reihenfolge über die **bedienbaren** Elemente:
     Logo → Toolbar-Elemente
   - App-Name und Avatar sind reine Anzeige-Elemente und erzeugen bewusst **keinen** Tab-Stopp: Ein
     Tab-Stopp ohne Aktion ist eine Sackgasse für Tastatur-Nutzende. WCAG 2.4.3 fordert eine
     sinnvolle Reihenfolge der bedienbaren Elemente, nicht einen Stopp je sichtbarem Element.
   - Keine Focus-Traps

3. **Screenreader-komplette Journey**
   - Alle Elemente sind appropriat gelabelt
   - Status-Änderungen werden angekündigt

### Erwartetes Ergebnis

- Alle Kontrast-Anforderungen erfüllt
- Vollständige Tastatur-Bedienbarkeit möglich
- Screenreader kann alle Elemente und Status-Änderungen erkennen

---

## Randfälle & Fehler

| Situation                         | Erwartetes Verhalten                                                                     |
| --------------------------------- | ---------------------------------------------------------------------------------------- |
| Kontrast <4.5:1 bei Text-Icons    | BITV 2.1.1 Verstoß – Kontrast muss erhöht werden                                         |
| Layout-Shift bei Toolbar-Änderung | Header-Height muss stabil bleiben – CSS Grid/Flex für Konsistenz nutzen                  |
| Mobile: Überlauf der Kopfzeile    | Header bleibt einzeilig (≤ 64px, kein Overflow) – Platz über Gap/Padding, nie Ausblenden |

---

## Hinweise zur Nutzung

- **Format:** Dieser Spec folgt dem User-Journey-Format aus docs/spec/user-journeys.md
- **Implementierung:** Spezifikation ist implementierungsagnostisch – beschreibt beobachtbares Verhalten
- **Test-Strategie:** E2E-Tests (frontend/e2e/*.spec.ts) prüfen Layout-Reihenfolge, A11y-Attribute und Responsive-Verhalten
