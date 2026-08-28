# Issue 787 – Header-Layout

**Stand:** 2026-08-28  
**Ziel:** Header-Layout beschreiben: Reihenfolge, Responsivität, Bedienbarkeit

---

## Journey 1: Header auf Desktop

### Ziel

Der Header zeigt seine Elemente in der festen Reihenfolge Logo → Name → Toolbar → Avatar.

### Vorbedingung

- Nutzer ist angemeldet
- Anwendung ist auf Desktop-Viewport geöffnet (≥600px)

### Schritte

1. **Header-Elemente identifizieren**
   - Logo (App-Icon, icon-only)
   - App-Name „Priority Pilot"
   - Toolbar mit den Kopf-Aktionen „Suche", „Neuen Task anlegen", „Säulen-Berater", „Einstellungen", „Hilfe", „Abmelden" —
     sechs Aktionen bei aktivierter KI (Default); ist die KI-Nutzung in den Einstellungen deaktiviert, entfällt
     „Säulen-Berater" ersatzlos (nicht nur ausgeblendet, sondern nicht gerendert) und es bleiben fünf
   - User-Avatar mit Profil-Bild

2. **Reihenfolge prüfen**
   - Visuelle Anordnung von links nach rechts: Logo → Name → Toolbar → Avatar
   - Avatar ist das letzte Element ganz rechts im Header

### Erwartetes Ergebnis

- Header-Layout folgt der Reihenfolge Logo → Name → Toolbar → Avatar
- Keine Layout-Shifts nach abgeschlossenem Aufbau, keine defekten Bilder
- Toolbar-Elemente sind gleichmäßig ausgerichtet

### Abgrenzung: ARIA-Rolle `toolbar`

Die Rolle `toolbar` trägt allein die KoliBri-Toolbar (`kol-toolbar`), die deren Tastatur-Erwartung
(Pfeiltasten-Navigation zwischen den Items) umsetzt. Der umgebende Container hat **kein** zweites
`role="toolbar"`: Das ergäbe verschachtelte Toolbars mit identischem Accessible Name und verspräche
eine Pfeiltasten-Navigation, die er nicht implementiert.

### Abgrenzung: Menüstruktur über alle Viewports

Der Header zeigt auf allen Bildschirmbreiten (Desktop, Tablet, Mobile) dieselbe Menüstruktur:
dieselben Kopf-Aktionen, keine Elemente, die nur in bestimmten Breiten erscheinen.
Responsives Verhalten entsteht nur durch Layout/Positionierung, nicht durch Entfernen von Menüpunkten
(die KI-abhängige Ein-/Ausblendung von „Säulen-Berater" ist viewport-unabhängig, siehe Journey 1).

### Abgrenzung: Tab-Leisten über alle Viewports

Beide Tab-Leisten der App bleiben auch auf schmalen Viewports (< 768px) horizontal nebeneinander
statt vertikal zu stapeln: die Ansichten-Wahl („Dashboard / Aufgaben / Serien / Wald") und die
Settings-Bereiche („Allgemein / Säulen / KI-Provider"). Bei echtem Platzmangel bricht die Leiste
sauber um, statt einen horizontalen Seitenüberlauf zu erzeugen. Dies ist eine bewusste Abweichung
von der Mobile-First-Regel „eine primäre Aktion pro Zeile": Sie gilt für Tab-Leisten nicht.

### Abgrenzung: KI-Modell-Auswahl

Die KI-Modellwahl lebt in den Einstellungen (Tab „KI-Provider"). Es gibt keinen Einstieg dazu in
der Kopfzeile.

---

## Journey 2: Responsive Verhalten

### Ziel

Der Header funktioniert auf allen Viewports.

### Vorbedingung

- Anwendung ist auf Mobile- (<48rem) und Tablet-/Desktop-Viewport (≥48rem) geöffnet

### Schritte

1. **Mobile-Layout prüfen**
   - Header-Höhe konsistent nach abgeschlossenem Aufbau
   - Toolbar-Elemente passen in den Viewport

2. **Breakpoint prüfen**
   - Unter und ab 48rem (768px): alle Kopf-Aktionen (icon-only) im Header
   - Ab 64rem (1024px): zusätzlich der App-Name im Header

### Erwartetes Ergebnis

- Keine horizontalen Scrollbars oder Überläufe
- Touch-Ziele der Kopf-Aktionen mindestens 44×44px (WCAG 2.5.5)
- Die Header-Höhe ändert sich durch keine Interaktion

### Abgrenzung: App-Name und Logo

Der Header trägt den App-Namen **als `span`, nicht als Überschrift** — es gibt keine zweite
Text-H1 im Header. Das Logo ist icon-only, der Name ist also nicht redundant.

### Abgrenzung: Header-Höhe nach Aufbau

Während der Hydration wächst der Header erwartungsgemäß auf seine Endhöhe (`kol-toolbar` baut ihre
Buttons asynchron im Shadow-DOM auf). Ist die Toolbar ausgelayoutet, darf keine Interaktion die
Header-Höhe verändern.

Auf 375px bleibt der Header einzeilig: Logo, Avatar und die Kopf-Aktionen füllen die Zeile aus.
Ein zweizeiliger Umbruch tritt nicht ein.

---

## Journey 3: A11y und Kontrast

### Ziel

Alle Header-Elemente erfüllen BITV-Kontrast- und Bedienbarkeits-Anforderungen.

### Vorbedingung

- Header ist sichtbar mit allen Elementen

### Schritte

1. **Kontrast prüfen**
   - Text-Icons ≥4.5:1 Kontrast
   - UI-Elemente ≥3:1 Kontrast
   - Focus-Indikator ≥3:1 Kontrast

2. **Tastatur-Navigation**
   - Tab-Reihenfolge folgt der visuellen Reihenfolge über die **bedienbaren** Elemente:
     Logo → Toolbar-Elemente
   - App-Name und Avatar sind reine Anzeige-Elemente ohne Tab-Stopp
   - Keine Focus-Traps

3. **Screenreader-Journey**
   - Alle Elemente sind gelabelt
   - Status-Änderungen werden angekündigt

---

## Randfälle & Fehler

| Situation                      | Erwartetes Verhalten                            |
| ------------------------------ | ----------------------------------------------- |
| Kontrast <4.5:1 bei Text-Icons | Kontrast erhöhen                                |
| Interaktion während Nutzung    | Header-Höhe bleibt stabil                       |
| Mobile Überlauf der Kopfzeile  | Header bleibt einzeilig (≤ 64px, kein Overflow) |
