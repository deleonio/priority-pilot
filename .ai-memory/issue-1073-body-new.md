## Was ist das Problem?
In der Fußzeile der App werden aktuell die Koordinaten (Breiten- und Längengrad) und die Version der App angezeigt. Dies ist für Nutzer nicht intuitiv lesbar.

## Wie soll es sein?
Statt der Koordinaten soll die lesbare Adresse (aus Reverse Geocoding) angezeigt werden, gefolgt von der Versionsnummer. Zwischen Adresse und Version ist ein geeigneter Separator zu verwenden.

## Wo tritt es auf?
Die Anzeige betrifft die Footer-Komponente (`frontend/src/components/Footer.tsx`), die in der gesamten App am unteren Bildschirmrand sichtbar ist.

## Woran messen wir das?
- Fußzeile zeigt die lesbare Adresse aus `useGeolocation().address` an, wenn verfügbar
- Falls `address` nicht verfügbar ist (null/leer), werden die Koordinaten als Fallback angezeigt
- Adresse und Version werden durch den Separator " | " getrennt
- Die Versionsnummer wird weiterhin korrekt angezeigt
- Das `role="contentinfo"`-Attribut bleibt erhalten
- Mobile-First: Anzeige bleibt bei 375px Viewport lesbar (kein Überlaufen)

<!-- KI-ANALYSE:START stand=2026-08-27T20:30:14Z -->
### Umsetzungskontext
- Betroffene Dateien: `frontend/src/components/Footer.tsx`
- Betroffene Komponenten: `Footer` React-Komponente
- Vorhandenes Muster: `useGeolocation`-Hook liefert bereits `address` (String) aus Reverse Geocoding (Nominatim)
- Randbedingungen: Adresse kann `null` sein (keine Position, Rate-Limit, Fehler) – in diesem Fall Koordinaten als Fallback anzeigen
- Erwartetes Ergebnis: Fußzeile zeigt "<Adresse> | Version <version>" oder bei fehlender Adresse "<Koordinaten> | Version <version>"

### Akzeptanzkriterien
- AK1: Fußzeile zeigt die lesbare Adresse aus `useGeolocation().address` an, wenn verfügbar
- AK2: Falls `address` nicht verfügbar ist (null/leer), werden die Koordinaten als Fallback angezeigt
- AK3: Adresse und Version werden durch den Separator " | " getrennt
- AK4: Die Versionsnummer wird weiterhin korrekt angezeigt
- AK5: Das `role="contentinfo"`-Attribut bleibt erhalten
- AK6: Mobile-First: Anzeige bleibt bei 375px Viewport lesbar (kein Überlaufen)

### Testfälle
- Backend/Logic: nicht zutreffend (reine UI-Anpassung)
- Frontend UI: `frontend/e2e/issue-1073-footer-address.spec.ts` (e2e-Akzeptanztest)
  - Test: AK1 – Adresse wird angezeigt, wenn `address` verfügbar ist
  - Test: AK2 – Koordinaten werden als Fallback angezeigt, wenn `address` null ist
  - Test: AK3 – Separator " | " steht zwischen Adresse und Version
  - Test: AK6 – Mobile-First: Text passt bei 375px Viewport
- Frontend Unit: `frontend/src/components/Footer.test.tsx` erweitern
  - Test: AK4 – Versionsnummer wird korrekt gerendert
  - Test: AK5 – `role="contentinfo"` ist vorhanden

### Ampel
- Ampel: 🟢
- Begründung: Anforderungen sind eindeutig, betroffene Dateien bekannt, `address` steht bereits über `useGeolocation` zur Verfügung, Umsetzung in einem PR machbar

### ✔️ Offene Fragen
- [ ] Keine

<!-- ai-phase-routing:START -->
| Phase | Run | Modell | Effort |
| --- | --- | --- | --- |
| ux | ja | sonnet | low |
| spec | ja | sonnet | low |
| impl | ja | sonnet | low |
| review | ja | sonnet | low |
<!-- ai-phase-routing:END -->
<!-- KI-ANALYSE:END -->

<!-- KI-UX:START stand=2026-08-27 -->

## UX-Beratung

### Interaktion
- Reiner Info-Text im Footer, keine Click-Targets — Daumen-Zonen/Touch-Targets nicht betroffen.
- Async-Verlauf gestalten (mobile-ui-rules Regel 7): `position` liegt sofort vor, `address` (Nominatim, `useGeolocation.ts:167`) trifft verzögert ein oder bleibt aus. Erst Koordinaten als Fallback rendern und beim Eintreffen der Adresse austauschen ist ok — aber die Footer-Höhe darf nicht springen (Text einzeilig halten, siehe Mobile-First). Ein eigener Ladezustand (Skeleton/Spinner) ist für eine Fußzeile übertrieben — bewusst keiner.
- Fehler-/Leerzustand: `address === null` ist kein Fehlerfall für die Nutzenden — stiller Fallback auf Koordinaten ist richtig, kein `KolAlert`.

### Mobile-First
- Adressen sind lang („Musterstraße 1, 10115 Berlin" ≈ 30–40 Zeichen, je nach Ortslage länger). Bei 375px Referenz-Viewport droht Zeilenumbruch/Überlauf im Footer. Empfehlung: `min-width: 0` + `overflow-wrap`/`text-overflow: ellipsis` vorsehen, damit kein horizontales Scrollen entsteht (Regel 3, WCAG 1.4.10). AK6 sollte nicht nur „lesbar bei 375px" prüfen, sondern auch bei 200 % Textvergrößerung (Reflow, 320px).
- Separator „ | " (AK3) ersetzt die aktuelle Trennung nur über `marginRight: 1rem` (`Footer.tsx:8`); ergänzend Abstand aus `--pp-space-2`/`--pp-space-3` statt hartem rem-Wert (Regel 6).
- Beim Vorhandensein einer Adresse das 📍-Emoji hinterfragen: neben einer lesbaren Adresse doppelt — streichen oder explizit `aria-hidden="true"` setzen.

### A11y/BITV
- `role="contentinfo"` bleibt (AK5) — korrekt, keine zusätzliche Landmark nötig.
- Der Separator „ | " wird von Screenreadern als „vertical line" vorgelesen und ist als Trennzeichen akzeptabel; sauberer wäre eine `aria-hidden`-Dekoration plus strukturelle `<span>`-Trennung — Kür, nicht Pflicht.
- 📍-Emoji ist dekorativ und muss `aria-hidden="true"` bekommen (bzw. entfallen), sonst liest der Screenreader „Obelisk" o. ä. vor.
- Textfarbe: `--pp-ink-muted` (Token-Vertrag ≥ 4.5:1) ist zulässig; Kontrast in hell **und** dunkel rechnen, nicht schauen (ux-design.md Farbregel 1).
- Reflow bei 200 % Textvergrößerung: die Versionsnummer darf nicht geclippt werden, sonst ist sie unlesbar (Regel 3 / WCAG 1.4.10).

### KoliBri
- Keine bedienbare Komponente im Spiel → die KoliBri-Komponentenpflicht greift hier nicht; reines `span` für statischen Text ist im bestehenden Footer etabliert und zulässig, solange kein `<button>`/`<input>`/`<table>`/`<h1>` dazukommt.
- Falls die Adresse später klickbar wird (z. B. Karten-Link): eigenes Ticket mit `KolButton`/`KolLink` + 44px Touch-Target — hier bewusst nicht Teil des Scopes.

### Design-Sprache
- Farbe: neutraler Sekundärtext (`--pp-ink-muted`) auf `--pp-surface-0`; keine Brand-/Signal-Rolle, keine Hintergrundänderung.
- Typo/Skala: bestehende `--pp-font-size-sm`-Konvention für Fußzeilen-Metadaten beibehalten; Abstände nur aus `--pp-space-*`.

### Offene UX-Fragen
- [ ] Keine blockierenden. Nicht-blockierender Hinweis: 📍-Emoji streichen oder `aria-hidden` setzen — Entscheidung kann in der Umsetzung fallen.

<!-- KI-UX:END -->
