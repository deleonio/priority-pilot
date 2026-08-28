<!-- KI-UX:START -->

## UX-Beratung

### Interaktion

- Settings = flache Liste mit sichtbarem Zustand ohne Antippen (Regel 4): Beide Schalter in `.settings-switch-row` (SettingsPage.tsx:153-236), `KolInputCheckbox _variant="switch"` — Zustand sofort lesbar, kein Speichern-Button (localStorage-Autospeichern passt exakt zu Regel 4).
- Deaktivierung wird dadurch sichtbar, dass Bedienelemente **verschwinden** (Toolbar-Button „Säulen-Berater", Lektorat-Buttons). Das ist korrekt, aber ein Zustand ohne Erklärung: Nach dem Abschalten sollte im Tab „KI-Provider" ein kurzer Hinweis stehen, was nun ausgeblendet ist (KolAlert `_type="info"` unter dem Hauptschalter) — sonst wirkt die App für die Person „kaputt" statt „konfiguriert".
- AK4-Konsequenz positiv: Direktes Öffnen des TaskFormulars ist ein Gewinn (ein Screen, eine Aufgabe, Regel 5) — ein Schritt weniger im Haupt-Flow.

### Mobile-First

- AK6 über das bestehende Muster lösen: `.settings-switch-row` (app.css:1519) ist bereits mobil Stack (<768px) und Desktop-Zeile (≥768px), inkl. Full-Bleed-Trick und ≥44px Touch-Ziel. Kein neues CSS, keine neue Breitenlogik — neue Zeilen in denselben Container hängen.
- Zwei Schalter + evtl. Alert beim 375px-Viewport: Reihenfolge Hauptschalter → Alert → Schnellerfassung-Option; Abstände aus `--pp-space-*` (3/4 innerhalb der Sektion).

### A11y/BITV

- `KolInputCheckbox _variant="switch"` rendert natives Input mit Rolle Switch und implizitem `aria-checked` — Label über `_label`, Erklärtext über `_hint` (nicht Placeholder). Icon-only-Verzichts-/Ausblend-Logik braucht keine Zusatz-ARIA, da nur gerendert/nicht gerendert wird (kein `aria-hidden`-Toggling).
- Information nie allein über Farbe (1.4.1): „ausgeblendet wegen KI aus" bitte als Text ausdrücken, nicht als graue/deaktivierte Optik.
- Fokus-Ring über `--pp-focus-ring` bleibt KoliBri-seitig erhalten; DOM-Reihenfolge = visuelle Reihenfolge (Hauptschalter zuerst).
- Kontrast der Hint-Texte in **beiden** Themes gegenprüfen (Konvention: ≥4.5:1, siehe `--pp-text-hint`-Kommentar in app.css:1557).

### KoliBri

- Komponentenwahl korrekt: `KolInputCheckbox _variant="switch"` (Sample `sample/input-checkbox/switch`), Hinweistext als `KolAlert`, keine rohen `<input>`/`<button>`.

### Design-Sprache

- Nur `--pp-space-*`/`--pp-ink*`/`--pp-surface-*`-Tokens, kein Hex; Farbrollen unaufgeregt (Settings = Operate → Restrained, kein Signalfarb-Einsatz nötig). Hauptschalter als Sektions-`KolHeading _level=3` gliedern statt Card-Rahmen (Regel 4: Gruppierung durch Überschrift/Abstand, nicht Rahmen).

### Offene UX-Fragen

- Advisory, nicht blockierend: Ticket formuliert „Schnellerfassung **deaktivieren**" — negativ formulierter Switch mit Default=an invertiert das mentale Modell (Switch-an = Funktion-weg). Empfehlung: positiv formulieren („KI-Features aktiv", „Schnellerfassung aktiv", beide Default an) und im Spec festnageln.
- Visuelle Behandlung der Schnellerfassungs-Option bei ausgeschaltetem Hauptschalter ist bewusst offen gelassen (AK3: unabhängig wählbar). Empfehlung: sichtbar lassen und bedienbar halten (kein Disable-Grau), da AK5 Persistenz sonst zwei Zustände koppelt.

<!-- KI-UX:END -->
