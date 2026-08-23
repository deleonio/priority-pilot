# Issue 787 – Header-Layout und KI-Modell-Auswahl in Toolbar

**Stand:** 2026-08-23  
**Version:** v1.3 (2026-08-23): Nightly-Sync — Accessible Name des Modell-Buttons auf den Ist-Text korrigiert.  
**Ziel:** Header-Layout optimieren und KI-Modell-Auswahl harmonisch in Toolbar integrieren

---

## Journey 1: Header-Layout auf Desktop

### Ziel

Header zeigt die Elemente in der Reihenfolge Logo → Name → Toolbar → Avatar, mit integrierter
KI-Modell-Auswahl. (Korrigiert in v1.2 durch #912 — Avatar steht seither als letztes Element ganz
rechts, siehe Versionierung.)

### Vorbedingung

- Nutzer ist angemeldet
- Anwendung ist auf Desktop-Viewport geöffnet (≥600px)

### Schritte

1. **Header-Elemente identifizieren**
   - Logo (App-Icon/Brand)
   - App-Name „Priority Pilot"
   - Toolbar mit verschiedenen Aktionen
   - User-Avatar mit Profil-Bild

2. **Reihenfolge prüfen**
   - Visuelle Anordnung von links nach rechts: Logo → Name → Toolbar → Avatar
   - Avatar ist das letzte Element ganz rechts im Header
   - Keine Elemente außerhalb dieser Sequenz

3. **KI-Modell-Auswahl in Toolbar lokalisieren**
   - KI-Modell-Auswahl ist als Toolbar-Element integriert (nicht separat angehängt)
   - Dropdown-Indikator (Chevron) sichtbar
   - Label zeigt das aktuell konfigurierte Modell (z. B. „sonnet-5"). Benennt das letzte Segment der
     Modell-ID nur die Preisklasse (`openrouter/free` → „free"), zeigt das Label die vollständige ID —
     ein Label muss das Modell identifizieren.

### Erwartetes Ergebnis

- Header-Layout folgt strikt der Reihenfolge: Logo → Name → Toolbar → Avatar
- KI-Modell-Auswahl ist visuell Teil der Toolbar: gemeinsamer Container, gemeinsame Ausrichtung,
  direkt benachbart
- Keine Layout-Shifts oder broken images
- Toolbar-Elemente sind gleichmäßig ausgerichtet

### Abgrenzung: ARIA-Rolle `toolbar`

„Teil der Toolbar" ist eine **visuelle** Anforderung. Die Rolle `toolbar` trägt allein die
KoliBri-Toolbar (`kol-toolbar`), die auch deren Tastatur-Erwartung (Pfeiltasten-Navigation zwischen
den Items) umsetzt. Der umgebende Container bekommt **kein** zweites `role="toolbar"`: Das ergäbe
verschachtelte Toolbars mit identischem Accessible Name und verspräche eine Pfeiltasten-Navigation,
die er nicht implementiert. Die KI-Modell-Auswahl ist als eigenständiges, benanntes Bedienelement im
`banner` vollständig zugänglich.
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
   - Enter/Space öffnet den Dialog

3. **Screenreader-Test** _(geändert durch Menschen-Entscheidung zu #929)_
   - Element ist ein nativer Button — Semantik, Fokus-Optik und Accessible Name
     („KI-Modell: [Kurzname]") trägt `kol-toolbar` im Shadow-DOM selbst
   - Der frühere role="combobox"-Vertrag (aria-haspopup, aria-expanded, Chevron) ist aufgehoben:
     `kol-toolbar` verwirft ARIA-Attribute an Items still, ein nachgerüstetes combobox-Semantik-
     Muster wäre nicht einklagbar. Die Bedienbarkeit bleibt über den nativen Button erhalten.

4. **Modell-Auswahl testen**
   - Klick auf KI-Modell-Auswahl öffnet das Popup
   - Popup zeigt die verfügbaren Modelle
   - Auswahl eines Modells aktualisiert Label sofort (kein Lade-Spin nötig)
   - Escape schließt das Popup

### Erwartetes Ergebnis

- KI-Modell-Auswahl ist klickbar und funktional
- Popup öffnet sich und zeigt Modelle
- Auswahl aktualisiert UI sofort
- Button ist als natives KoliBri-Toolbar-Bedienelement vollständig zugänglich

### Abgrenzung: Popup-Art und Label

Das Popup ist der bestehende modale **Dialog** zur Modell-Auswahl (#742), keine Listbox — der
Toolbar-Button öffnet ihn wie jeder Aktionsbutton. Die Liste der auswählbaren Modelle bleibt der
Dialog-Inhalt aus #742.

Das Screenreader-Label enthält **keine** Anzahl verfügbarer Optionen: Die Free-Modell-Liste lädt
dynamisch erst der Dialog (`GET /models/free`). Eine im Button hartcodierte Zahl wäre eine
Falschaussage, sobald sich die Liste ändert.

---

## Journey 3: Responsive Verhalten

### Ziel

Der Header funktioniert auf allen Viewports; die KI-Modell-Auswahl ist ab 48rem bedienbar (unter 48rem existiert bewusst kein Einstieg — bekannte Lücke, siehe Abgrenzung unten).

### Vorbedingung

- Anwendung ist auf Mobile- (<48rem) und Tablet-/Desktop-Viewport (≥48rem) geöffnet

### Schritte

1. **Mobile-Layout prüfen**
   - Header-Height konsistent (kein Layout-Shift bei Toolbar-Änderungen)
   - Toolbar-Elemente passen in Viewport

2. **KI-Modell-Auswahl ab 48rem**
   - Touch-Ziel des Header-Buttons mindestens 44×44px (WCAG 2.5.5)
   - Design-Entscheidung: Unter 48rem ist die Auswahl **nicht** im Header und es existiert kein
     anderer Einstieg — siehe Abgrenzung unten
   - Modal erscheint bei Auswahl

3. **Breakpoint-Test**
   - Ab 48rem (768px): KI-Modell-Auswahl im Header mit Modell-Label
   - Unter 48rem: kein Einstieg in die KI-Modell-Auswahl (bekannte Lücke)
   - Ab 64rem (1024px): zusätzlich der App-Name im Header

### Erwartetes Ergebnis

- Keine horizontalen Scrollbars oder Überläufe
- Touch-Ziel der KI-Modell-Auswahl ist ausreichend groß (≥44×44px ab 48rem)
- Header-Height bleibt stabil
- KI-Modell-Auswahl ist ab 48rem bedienbar

### Abgrenzung: KI-Modell-Auswahl unter 48rem

Der Header muss auf 375px einzeilig bleiben — das ist ein bestehender, mehrfach abgesicherter
Vertrag (#485 AK6, #718 AK4/AK5, `mobile-shell.spec.ts`). Bei 375px stehen 343px Inhaltsbreite zur
Verfügung, die Logo (44px), Avatar (44px) und die fünf Kopf-Aktionen (#691, je 44px) bereits
ausfüllen. Ein sechstes Bedienelement passt dort nicht mehr hinein — auch nicht icon-only.

Deshalb ist die KI-Modell-Auswahl unter 48rem im Header ausgeblendet. Der frühere Mobile-Ausweg —
der Dashboard-Einstieg aus #742 mit 48×48px-Touch-Ziel — wurde mit 8a7d182 bewusst entfernt
(„Unerwünschter KI-Modell-Button im Dashboard-Bereich"): Unter 48rem existiert damit **kein**
Einstieg mehr. Das ist eine bekannte, bewusst akzeptierte Lücke; soll die Modell-Auswahl mobil
wieder erreichbar sein, braucht es eine eigene Entscheidung (z. B. Einstellungs-Seite/Menü) —
nicht die Wiedereinführung des Dashboard-Buttons. Ab 48rem steht die Auswahl wie spezifiziert in
der Kopfzeile; der Header-Button misst dort 44×44px über die gemeinsame Toolbar-Einheit
(`--pp-toolbar-height`) und erfüllt WCAG 2.5.5.

### Abgrenzung: App-Name und #406

#406 hat die redundante Text-H1 „Priority Pilot" aus dem Header entfernt — damals trug die
Wort-Bild-Marke den Namen selbst. Seit #485 ist das Logo icon-only, der Name ist also nicht mehr
redundant. #787 führt ihn deshalb wieder ein, aber **als `span`, nicht als Überschrift**: Die
Kernaussage von #406 („keine zweite H1 im Header") bleibt unangetastet, der zugehörige E2E-Vertrag
in `header-logo.spec.ts` prüft das weiterhin.

### Abgrenzung: „Header-Height bleibt stabil"

Gemeint ist die Stabilität **nach** dem Aufbau der Ansicht: Ist die Toolbar ausgelayoutet und das
aktuelle Modell geladen, darf keine Interaktion (Öffnen des Popups, Auswahl eines Modells) die
Header-Höhe verändern. Während der Hydration wächst der Header dagegen erwartungsgemäß auf seine
Endhöhe — `kol-toolbar` baut ihre Buttons asynchron im Shadow-DOM auf.

Auf 375px bleibt der Header einzeilig (Vertrag aus #485 AK6 / #718 AK4): Logo, Avatar und die fünf
Kopf-Aktionen füllen die Zeile aus — die KI-Modell-Auswahl ist dort deshalb ausgeblendet (siehe
Abgrenzung oben). Ein zweizeiliger Umbruch tritt nicht ein; die Anforderung „keine horizontalen
Überläufe" bleibt erfüllt.

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
   - Tab-Reihenfolge folgt der visuellen Reihenfolge über die **bedienbaren** Elemente:
     Logo → KI-Modell-Auswahl → Toolbar-Elemente
   - App-Name und Avatar sind reine Anzeige-Elemente und erzeugen bewusst **keinen** Tab-Stopp: Ein
     Tab-Stopp ohne Aktion ist eine Sackgasse für Tastatur-Nutzende. WCAG 2.4.3 fordert eine
     sinnvolle Reihenfolge der bedienbaren Elemente, nicht einen Stopp je sichtbarem Element.
   - Keine Focus-Traps
   - Esc schließt das Popup

3. **Screenreader-komplette Journey**
   - Alle Elemente sind appropriat gelabelt
   - Status-Änderungen werden angekündigt

### Erwartetes Ergebnis

- Alle Kontrast-Anforderungen erfüllt
- Vollständige Tastatur-Bedienbarkeit möglich
- Screenreader kann alle Elemente und Status-Änderungen erkennen

---

## Randfälle & Fehler

| Situation                                   | Erwartetes Verhalten                                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| KI-Modell-Auswahl Click-Target <44×44px     | Verstößt gegen BITV 2.1 – muss vergrößert werden                                                             |
| Fehlender aria-expanded Zustand             | Screenreader erkennt Dropdown-Zustand nicht – Attribut muss gesetzt werden                                   |
| Kontrast <4.5:1 bei Text-Icons              | BITV 2.1.1 Verstoß – Kontrast muss erhöht werden                                                             |
| Layout-Shift bei Toolbar-Änderung           | Header-Height muss stabil bleiben – CSS Grid/Flex für Konsistenz nutzen                                      |
| Mobile: kein Einstieg in die Modell-Auswahl | Bekannte Lücke seit 8a7d182 (bewusst akzeptiert) – eigener Beschluss nötig, falls mobil erreichbar sein soll |

---

## Hinweise zur Nutzung

- **Format:** Dieser Spec folgt dem User-Journey-Format aus docs/spec/user-journeys.md
- **Implementierung:** Spezifikation ist implementierungsagnostisch – beschreibt beobachtbares Verhalten
- **Test-Strategie:** E2E-Tests (frontend/e2e/*.spec.ts) prüfen Layout-Reihenfolge, A11y-Attribute, Responsive-Verhalten und Funktionalität
- **KI-UX-Block:** UX-Requirements aus KI-UX:END-Block des Issues sind in diese Journeys integriert

---

## Versionierung

- **v1.0** (2026-08-17): Initialefassung für Issue #787. Header-Layout und KI-Modell-Auswahl in Toolbar spezifiziert.
- **v1.1** (2026-08-17): Abgrenzungen ergänzt, nachdem die Tests die technische Realität gegengeprüft
  haben: ARIA-Rolle `toolbar` bleibt bei `kol-toolbar`, das Popup ist ein Dialog (nicht Listbox),
  Label ohne hartcodierte Options-Anzahl, Tab-Reihenfolge über die bedienbaren Elemente,
  Header-Stabilität ab Ende der Hydration.
- **v1.2** (2026-08-20): Journey 1 korrigiert für #912 — Nutzer-Feedback ergab, dass der Avatar
  links-mittig direkt neben der Wortmarke sitzt statt rechtsbündig. Reihenfolge geändert von
  Logo → Name → Avatar → Toolbar auf Logo → Name → Toolbar → Avatar; der Avatar ist jetzt das
  letzte Element ganz rechts im Header. Größenrelation (1,25 × `--pp-toolbar-height`) und
  Einzeiler-Vertrag bei 375px/768px bleiben unverändert.
