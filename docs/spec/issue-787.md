# Issue 787 – Header-Layout und KI-Modell-Auswahl in Toolbar

**Stand:** 2026-08-17  
**Ziel:** Header-Layout optimieren und KI-Modell-Auswahl harmonisch in Toolbar integrieren

---

## Journey 1: Header-Layout auf Desktop

### Ziel

Header zeigt die Elemente in der Reihenfolge Logo → Name → Avatar → Toolbar, mit integrierter KI-Modell-Auswahl.

### Vorbedingung

- Nutzer ist angemeldet
- Anwendung ist auf Desktop-Viewport geöffnet (≥600px)

### Schritte

1. **Header-Elemente identifizieren**
   - Logo (App-Icon/Brand)
   - App-Name „Priority Pilot"
   - User-Avatar mit Profil-Bild
   - Toolbar mit verschiedenen Aktionen

2. **Reihenfolge prüfen**
   - Visuelle Anordnung von links nach rechts: Logo → Name → Avatar → Toolbar
   - Keine Elemente außerhalb dieser Sequenz

3. **KI-Modell-Auswahl in Toolbar lokalisieren**
   - KI-Modell-Auswahl ist als Toolbar-Element integriert (nicht separat angehängt)
   - Dropdown-Indikator (Chevron) sichtbar
   - Label zeigt aktuelles Modell (z.B. „Sonnet 5")

### Erwartetes Ergebnis

- Header-Layout folgt strikt der Reihenfolge: Logo → Name → Avatar → Toolbar
- KI-Modell-Auswahl ist visuell Teil der Toolbar (gemeinsamer Style/Container)
- Keine Layout-Shifts oder broken images
- Toolbar-Elemente sind gleichmäßig ausgerichtet

---

## Journey 2: KI-Modell-Auswahl Interaktion

### Ziel

KI-Modell-Auswahl ist funktional und a11y-konform bedienbar.

### Vorbedingung

- Header ist sichtbar
- KI-Modell-Auswahl ist in Toolbar integriert

### Schritte

1. **Click-Target prüfen**
   - KI-Modell-Auswahl hat mindestens 44×44px Click-Target (BITV 2.1, Touch-optimiert)
   - Hover-Visualisierung bei Desktop (Border/Background-Change)

2. **Tastatur-Navigation**
   - Tab-Reihenfolge erreicht KI-Modell-Auswahl nach anderen Toolbar-Elementen
   - Focus-Indikator sichtbar (2px solid, Kontrast ≥3:1)
   - Enter/Space öffnet Dropdown

3. **Screenreader-Test**
   - Element hat role="combobox"
   - aria-expanded wechselt zwischen "true" und "false"
   - Label: „Modell auswählen, aktuell: [Modellname]"

4. **Modell-Auswahl testen**
   - Klick auf KI-Modell-Auswahl öffnet Dropdown
   - Dropdown zeigt verfügbare Modelle
   - Auswahl eines Modells aktualisiert Label sofort (kein Lade-Spin nötig)
   - aria-pressed="true" bei geöffnetem Dropdown

### Erwartetes Ergebnis

- KI-Modell-Auswahl ist klickbar und funktional
- Dropdown öffnet sich und zeigt Modelle
- Auswahl aktualisiert UI sofort
- A11y-Attribute korrekt gesetzt (role, aria-expanded, aria-pressed)
- Screenreader kündigt „KI-Modellauswahl, aktuell [Modellname], X Optionen verfügbar" an

---

## Journey 3: Responsive Verhalten (Mobile)

### Ziel

Header und KI-Modell-Auswahl funktionieren auf Mobile-Viewports (<600px).

### Vorbedingung

- Anwendung ist auf Mobile-Viewport geöffnet (<600px)

### Schritte

1. **Mobile-Layout prüfen**
   - Header-Height konsistent (kein Layout-Shift bei Toolbar-Änderungen)
   - Toolbar-Elemente passen in Viewport

2. **KI-Modell-Auswahl auf Mobile**
   - Touch-Ziele mindestens 48×48px (WCAG 2.5.5)
   - Als Icon-only mit Tooltip oder in Overflow-Menu (je nach Design-Entscheidung)
   - Dropdown/Sheet/Modal erscheint bei Auswahl

3. **Breakpoint-Test**
   - Bei 600px: Volle Toolbar mit Text-Labels
   - Unter 600px: Optimiert für Mobile (Tooltip/Overflow)

### Erwartetes Ergebnis

- Keine horizontalen Scrollbars oder Überläufe
- Touch-Ziele sind ausreichend groß (≥48×48px)
- Header-Height bleibt stabil
- KI-Modell-Auswahl ist bedienbar auf Mobile

---

## Journey 4: A11y und Kontrast

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
   - Tab-Reihenfolge: Logo → Name → Avatar → Toolbar-Elemente
   - Keine Focus-Traps
   - Esc schließt Dropdown

3. **Screenreader-komplette Journey**
   - Alle Elemente sind appropriat gelabelt
   - Status-Änderungen werden angekündigt

### Erwartetes Ergebnis

- Alle Kontrast-Anforderungen erfüllt
- Vollständige Tastatur-Bedienbarkeit möglich
- Screenreader kann alle Elemente und Status-Änderungen erkennen

---

## Randfälle & Fehler

| Situation                               | Erwartetes Verhalten                                                       |
| --------------------------------------- | -------------------------------------------------------------------------- |
| KI-Modell-Auswahl Click-Target <44×44px | Verstößt gegen BITV 2.1 – muss vergrößert werden                           |
| Fehlender aria-expanded Zustand         | Screenreader erkennt Dropdown-Zustand nicht – Attribut muss gesetzt werden |
| Kontrast <4.5:1 bei Text-Icons          | BITV 2.1.1 Verstoß – Kontrast muss erhöht werden                           |
| Layout-Shift bei Toolbar-Änderung       | Header-Height muss stabil bleiben – CSS Grid/Flex für Konsistenz nutzen    |
| Mobile: Touch-Target <48×48px           | WCAG 2.5.5 Verstoß – Touch-Ziele müssen vergrößert werden                  |

---

## Hinweise zur Nutzung

- **Format:** Dieser Spec folgt dem User-Journey-Format aus docs/spec/user-journeys.md
- **Implementierung:** Spezifikation ist implementierungsagnostisch – beschreibt beobachtbares Verhalten
- **Test-Strategie:** E2E-Tests (frontend/e2e/*.spec.ts) prüfen Layout-Reihenfolge, A11y-Attribute, Responsive-Verhalten und Funktionalität
- **KI-UX-Block:** UX-Requirements aus KI-UX:END-Block des Issues sind in diese Journeys integriert

---

## Versionierung

- **v1.0** (2026-08-17): Initialefassung für Issue #787. Header-Layout und KI-Modell-Auswahl in Toolbar spezifiziert.
