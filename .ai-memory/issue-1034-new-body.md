IST:

<img width="1713" height="182" alt="Image" src="https://github.com/user-attachments/assets/914d4652-e52d-435a-92fe-91d0c966b1fc" />

Ich möchte, dass die Benachrichtigungen für Update und Offline in der App mobil besser bedienbar sind, sodass sich der Schalter leicht antippen lässt. Zudem sollte der Text menschlicher und beschreibender formuliert sein.

<!-- KI-ANALYSE:START stand=2026-08-26T02:16:49Z -->

### UI-Bezug

- UI-Bezug: ja
- Begründung: Sichtbares Layout und Texte der PWA-Update-/Offline-Card, Mobile-Bedienbarkeit.

### Spec

- Spec nötig: ja
- Begründung: Anwendungscode (`frontend/src/**`) mit prüfbarem Verhalten (Tap-Target, Texte).

### Aufwandsklasse

- Aufwandsklasse: sonnet
- Begründung: Eine Komponente plus ein CSS-Block; der Aufwand hängt an den Mobile-Messungen im e2e-Test und am Nachziehen der bestehenden Unit-Tests.

### Umsetzungskontext

- Betroffene Dateien: `frontend/src/components/UpdatePrompt.tsx`, `frontend/src/app.css`, `frontend/src/components/UpdatePrompt.test.tsx`, `frontend/e2e/pwa-update-prompt.spec.ts`
- Betroffene Komponenten: `UpdatePrompt` (die beiden `KolCard`-Blöcke "Update"/"Offline" samt `KolButton`, `UpdatePrompt.tsx:29-48`), CSS-Klasse `.update-prompt` (`app.css:1555-1572`)
- Vorhandenes Muster: `frontend/e2e/issue-996-pillar-row-mobile.spec.ts` — dort ist die 44px-Tap-Target-Regel (WCAG 2.5.8) plus Volle-Breite-Messung auf Mobile bereits als e2e-Vertrag umgesetzt; `frontend/e2e/pwa-update-prompt.spec.ts:48-91` zeigt, wie der CSS-Kontrakt von `.update-prompt` über ein injiziertes Stellvertreter-Element geprüft wird.
- Randbedingungen:
  - Der echte Service-Worker-Update-Zyklus ist in Playwright nicht deterministisch reproduzierbar (begründet in `pwa-update-prompt.spec.ts:5-13`) — Layout-AK deshalb über injiziertes Stellvertreter-Markup messen, Text-AK über Vitest mit gemocktem `useRegisterSW`.
  - Der native `span`-Wrapper mit `data-testid="pwa-update-reload"` bzw. `pwa-offline-close` um den `KolButton` muss bleiben (JSDOM kann `KolButton._on.onClick` nicht auslösen). Wird der Button auf volle Breite gebracht, muss der Wrapper Block-Level werden, sonst bleibt die Klickfläche schmal.
  - `.update-prompt` trägt `pointer-events: none`, nur `kol-card` bekommt `auto` zurück — die Fixierung am unteren Rand (`position: fixed`, `bottom: 0`) inklusive iOS-Safe-Area darf nicht brechen (bestehende AK aus #373).
  - Textänderungen brechen bestehende Assertions in `UpdatePrompt.test.tsx` — die Datei wird mitgezogen.
- Erwartetes Ergebnis: Auf einem 375px-Viewport steht der Aktionsbutton beider Cards als breite, mindestens 44px hohe Fläche unter dem Hinweistext; die Texte benennen in ganzen Sätzen, was passiert ist und was zu tun ist.

### Akzeptanzkriterien

- AK1: Bei einer Viewport-Breite von 375px ist der Aktionsbutton beider Cards (Update, Offline) mindestens 44x44px gross und füllt mindestens 90 Prozent der Card-Innenbreite.
- AK2: Bei 320px liegt kein Kind-Element der `.update-prompt`-Card ausserhalb des Viewports (rechte Bounding-Box-Kante kleiner gleich Viewport-Breite).
- AK3: Ab 768px bleibt `.update-prompt` unverändert am unteren Rand fixiert (`position: fixed`, `bottom: 0px`) — keine Desktop-Regression.
- AK4: Die Update-Card zeigt einen beschreibenden Fliesstext statt eines Stichworts. Vorschlag: Card-Label "Neue Version verfügbar", Text "Priority Pilot wurde aktualisiert. Lade die App neu, um die neue Version zu nutzen.", Button-Label "Jetzt neu laden".
- AK5: Die Offline-Card zeigt einen beschreibenden Fliesstext. Vorschlag: Card-Label "Offline einsatzbereit", Text "Priority Pilot funktioniert ab jetzt auch ohne Internetverbindung.", Button-Label "Verstanden".
- AK6: Die bestehende Klick-Wirkung bleibt erhalten: Klick auf `pwa-update-reload` ruft `updateServiceWorker(true)`, Klick auf `pwa-offline-close` setzt `offlineReady` auf false.

### Testfälle

- Zu AK1 — Akzeptanz-e2e (`frontend/e2e/pwa-update-prompt.spec.ts`, Stil `issue-996-pillar-row-mobile.spec.ts`): Bei 375px Stellvertreter-Markup der Card injizieren, `boundingBox()` des Button-Hosts messen; Höhe mindestens 44, Breite mindestens 44 und mindestens 90 Prozent der Card-Innenbreite. Das ist zugleich das Mobile-First-Kriterium.
- Zu AK2 — Akzeptanz-e2e (gleiche Datei): Viewport 320px, für jedes Kind-Element gilt `x + width` kleiner gleich 321 (1px Sub-Pixel-Toleranz). Bewusst Bounding-Box statt `scrollWidth`, weil die App-Shell mit `overflow-x: hidden` clippt.
- Zu AK3 — Akzeptanz-e2e (gleiche Datei): Viewport 1280px, `getComputedStyle` des Stellvertreters liefert `position: fixed` und `bottom: 0px`.
- Zu AK4 — Vitest-Unit (`frontend/src/components/UpdatePrompt.test.tsx`): `useRegisterSW` mit `needRefresh: true` mocken, die drei erwarteten Zeichenketten per `getByText` bzw. über das `_label`-Attribut des `kol-button` prüfen.
- Zu AK5 — Vitest-Unit (gleiche Datei): `offlineReady: true` mocken, analoge Textprüfung.
- Zu AK6 — Vitest-Unit (gleiche Datei): die bestehenden Tests (`fireEvent.click` auf die `data-testid`-Wrapper) bleiben grün.

### Ampel

- Ampel: 🟢
- Begründung: Betroffene Dateien und Zeilen sind bekannt, die Anforderungen sind über etablierte Repo-Muster (44px-Tap-Target, Stellvertreter-CSS-Test) prüfbar formulierbar und in einem PR umsetzbar. Der Wortlaut der Texte liegt als konkreter Vorschlag vor und wird in der UX-Phase final geschärft.

### ❓ Offene Fragen

- Keine.

<!-- KI-ANALYSE:END -->

<!-- KI-UX:START -->

## UX-Beratung

### Interaktion

Die Update- und Offline-Cards werden als **modale Benachrichtigungen** am unteren Rand über dem Inhalt gelagert. Jede Card enthält **genau eine Primäraktion** (Button), die den Zustand auflöst: „Jetzt neu laden" (Update) oder „Verstanden" (Offline). Benutzer müssen die Card **mit dem Daumen** im unteren Drittel des Viewports antippen können — das ist der häufigste Handgriff auf Smartphones. **Prüfpunkt**: Die `<span data-testid>` Wrapper um die Buttons sind ein JSDOM-Workaround, damit Unit-Tests `click` auslösen können. Ihre `pointer-events: none`-Strategie auf dem Container-Level passt zur Regel, aber die Span-Elemente müssen sicherstellen, dass die tappbare Fläche der Button-Breite entspricht (sonst bleibt die Fläche schmal, wenn der Button später auf Block-Breite wächst). Wenn der Button auf `display: block; width: 100%` geht, muss der Wrapper ebenfalls Block-Level werden (`display: block`).

### Mobile-First

**Breakpoint:** Das Repo nutzt `@media (max-width: 767px)` als Obergrenze für Mobile-Regeln. Basis ist 375px Viewport-Breite (AK1, AK2).

- **Bei 375px:** Der Button wird **mindestens 44×44px** gross (Touch-Target nach WCAG 2.5.8, Repo-Minimum; Ziel: 48dp gemäss Material Design). Der Button füllt **mindestens 90 % der Card-Innenbreite**, sodass der Daumen ihn sicher trifft.
- **Bei 320px:** Kein Kind-Element überragt den rechten Viewport-Rand (AK2). Das ist eine «Keine-Reflow»-Regel — auch Text und Button dürfen nicht horizontal scrollen.
- **Bei 768px+:** `.update-prompt` bleibt `position: fixed; bottom: 0px` (Desktop-Regression ausgeschlossen, AK3). Auf breiten Screens kann die Card eingeengt werden (z. B. `max-width: 90vw; margin: 0 auto`), muss aber das Fixed-Bottom-Verhalten behalten.
- **Tokens statt Hardcodes:** Der Button-Padding und die Card-Innenabstände müssen aus der Skala kommen (`--pp-space-3/4` für Card-Inhalte, `--pp-space-1/2` zwischen Button und Textblock). Keine fixen Pixel-Werte im CSS.

### A11y/BITV

1. **Kontrast (WCAG 1.4.3):** Die Card und der Button bekommen per KoliBri eine Farbrollen-Zuweisung (z. B. `--pp-signal` oder `--pp-success`). Diese Rollen **müssen in hellen UND dunklen Farbschemata** ein Kontrastverhältnis von mindestens **4,5:1** gegen die Hintergrund-Rolle (`--pp-surface-1`) erfüllen. **Prüfpunkt:** Vor der Implementierung die Kontraste im Design-System (`frontend/src/app.css`) nachrechnen.
2. **Fokus (WCAG 2.4.7):** Der Button hat einen sichtbaren `:focus-visible`-Ring (per KoliBri). Der Wrapper-`<span>` wird nicht fokussierbar (keine `tabindex="0"`). Falls die Span-Wrapper **später** interaktiv werden müssen (z. B. für Touch-Targeting oder a11y-Repairs), müssen sie `role="button"`, `tabindex="0"` und `:focus-visible`-Styling bekommen. **Aktuell OK**, weil der Button fokussierbar ist.
3. **Screenreader (WCAG 1.3.1):** Der KolButton trägt über die `_label` Property (bzw. `aria-label` intern) eine aussagekräftige Beschriftung: „Jetzt neu laden" oder „Verstanden". Die Text-Beschreibung oberhalb (AK4: „Priority Pilot wurde aktualisiert…", AK5: „Priority Pilot funktioniert…") ist Fliesstext, keine Label — sie wird vom Screenreader vorgelesen, bevor der Button kommt. Das ist gut: Kontext vor Aktion.
4. **Tastatur (WCAG 2.1.1):** Alle Funktionen müssen per Tastatur erreichbar sein. Der Button ist fokussierbar und aktivierbar per Enter/Space. Die `pointer-events: none` Regel beeinträchtigt das nicht (CSS-only).

### KoliBri

- **KolCard** wird für beide Benachrichtigungen verwendet (Update + Offline). Richtige Wahl — bietet eine semantische Fläche mit optionalem Header/Footer. Keine Bedenken.
- **KolButton** wird für die Primäraktion verwendet. Richtige Wahl — sollte mit `_variant="primary"` (default) oder `_variant="secondary"` konfiguriert werden. **Regel 5 (ein Screen, eine Aufgabe):** Diese Phase ist nicht ein Screen, sondern ein Overlay. Die Regel erlaubt, dass jedes Overlay eine Primäraktion hat. Beide Cards sind logisch getrennt (nicht gleichzeitig sichtbar), also ist je ein `_variant="primary"` Button OK.
- **KoliBri-Host-Breite:** KoliBri-Komponenten sind `display: block` und füllen 100 % der verfügbaren Breite (LayoutShift durch Shadow DOM ist ausgeschlossen). Der Button-Host (das `<kol-button>` Element) muss deshalb explizit auf Breite gesetzt werden — nicht das interne Shadow-Button-Element. CSS-Regel: `.update-prompt kol-button { width: 100%; }` oder per Flex auf dem Wrapper.

### Design-Sprache

- **Farbrollen:** Die Analyse schlägt Texte vor (AK4-5), aber nicht die Farbrollen. Vorschläge (zur Schärfung):
  - **Update-Card:** Könnte `--pp-signal` sein (die eine Antwort, Aktion erforderlich) oder `--pp-success` (Update erfolgreich verfügbar). Welche Rolle passt semantisch besser?
  - **Offline-Card:** Könnte `--pp-success` sein (Offline-Funktion erfolgreich aktiviert) oder informativ neutral (`--pp-surface-1`).
  - **Prüfpunkt:** Farbrollen festlegen und Kontraste rechnen.
- **Abstände:** Die Card sollte `--pp-space-4` (16px) Padding innen haben (Standard für Cards). Der Button braucht oben/unten jeweils `--pp-space-2/3` (8–12px Padding) plus `--pp-space-4` (16px) Höhen-Mindest-Fläche = Total ≥44px. Die Skala bietet hier `--pp-space-6 = 32px` oder `--pp-space-7 = 48px` für volle Button-Höhe.
- **Typografie:** AK4-5 nennen konkrete Wortlaute (ganze Sätze, nicht Stichworte). Das ist gut — „Copy benennt Action" (Craft Floor). Die Fliesstext-Grösse sollte `--pp-font-size-base` (1rem = 16px) sein, die Card-Überschrift `--pp-font-size-lg` (1.125rem). Beides ist in der Skala vorhanden.
- **Bewegung:** `.update-prompt` hat aktuell keine Übergänge (CSS `app.css:1555`). Wenn eine Slide-In-Animation hinzukommt, sollte sie `--pp-motion-base` (200ms, `ease-out` erscheinen / `ease-in` verschwinden) nutzen. **Nicht aktuell nötig**, aber Vorschlag für die Zukunft.

### Offene UX-Fragen

1. **Wrapper-`<span>` Semantik:** Der JSDOM-Workaround nutzt einen unsichtbaren `<span>` mit `data-testid` um den Button. Soll dieser für die UX-Phase als OK betrachtet werden (funktional korrekt, a11y-neutral weil der Button dahinter fokussierbar bleibt), oder sollte in der Spec eine Alternative (z. B. direktes `fireEvent` auf den KolButton ohne Wrapper) geprüft werden? **Empfehlung:** als gegeben betrachten, da Vitest+JSDOM-Limitation bekannt ist.

2. **Farbrollen für Update vs. Offline:** Die Analyse schlägt Texte vor, aber nicht die Farbrollen. **Empfehlung:** Implementierungsphase soll festlegen, welche `--pp-*` Rolle(n) verwendet werden (Signal? Success? Brand?), und Kontraste mit `scripts/validate_palette.js` (dataviz-Skill) prüfen.

3. **Safe-Area-Insets iOS:** `.update-prompt` mit `position: fixed; bottom: 0` kann auf iPhones mit Notch/Dynamic Island unter die sogenannte Safe Area rutschen. **Empfehlung:** CSS sollte `bottom: env(safe-area-inset-bottom, 0)` verwenden, damit die Card den Sicherheitsbereich respektiert (Regel 8 aus mobile-ui-rules). KoliBri-Card respektiert das bereits intern, aber `.update-prompt`-CSS muss das durchleiten.

<!-- KI-UX:END -->
