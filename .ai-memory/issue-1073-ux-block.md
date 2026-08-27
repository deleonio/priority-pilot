<!-- KI-UX:START stand=2026-08-27 -->

## UX-Beratung

### Interaktion
- Reiner Info-Text im Footer, keine Click-Targets — Daumen-Zonen/Touch-Targets nicht betroffen.
- Async-Verlauf sichtbar gestalten (mobile-ui-rules Regel 7): `position` liegt sofort vor, `address` (Nominatim, `useGeolocation.ts:167`) trifft verzögert ein oder bleibt aus. Erwartung: kein Flackern mit Layout-Sprung — Fallback Koordinaten zuerst rendern und beim Eintreffen der Adresse austauschen ist ok, aber die Footer-Höhe darf nicht springen (Text einzeilig halten, siehe Mobile-First). Ein eigener Ladezustand (Skeleton/Spinner) ist für eine Fußzeile **übertrieben** — bewusst keiner.
- Fehler-/Leerzustand: `address === null` ist kein Fehlerfall für die Nutzenden — stiller Fallback auf Koordinaten ist die richtige Entscheidung, kein `KolAlert`.

### Mobile-First
- Adressen sind lang („Musterstraße 1, 10115 Berlin" ≈ 30–40 Zeichen; je nach Ortslage deutlich länger). Bei 375px Referenz-Viewport droht Zeilenumbruch/Überlauf im einzeiligen Footer. Empfehlung: `min-width: 0` + `text-overflow: ellipsis` / `overflow-wrap` vorsehen, damit kein horizontales Scrollen entsteht (Regel 3, WCAG 1.4.10). AK6 sollte deshalb nicht nur „lesbar bei 375px" prüfen, sondern auch bei 200 % Textvergrößerung.
- Trennung: statt `marginRight: 1rem` (aktuell `Footer.tsx:8`) den geforderten Separator „ | " als sichtbares Trennzeichen zwischen Adresse und Version setzen; auf sehr schmalen Viewports darf der Separator mit umbrechen (Trennung dann visuell über Abstand `--pp-space-2`/`--pp-space-3` statt nur Pipe).
- Kein horizontales Scrollen bei 320px/200 % Textgröße — im e2e zusätzlich zur 375px-Prüfung abdecken.

### A11y/BITV
- `role="contentinfo"` bleibt (AK5) — korrekt, keine zusätzliche Landmark nötig.
- Separator „ | " wird von Screenreadern als „vertical line/bar" vorgelesen und ist als Textzonentrennung akzeptabel; sauberer wäre eine `aria-hidden`-Dekoration + strukturelle Trennung (`<span>`-Paare), aber das ist Kür, nicht Pflicht — „ | " blockiert nicht.
- 📍-Emoji ist dekorativ und muss `aria-hidden="true"` bekommen, sonst liest der Screenreader „Obelisk/eingestifteter Brief". Gilt auch, wenn die Adresse die Koordinaten ersetzt: Emoji weglassen oder verstecken, die Adresse selbst trägt die Information.
- Text: `--pp-ink-muted` (≥ 4.5:1 laut Token-Vertrag) für Footer-Text ist zulässig; Kontrast in hell **und** dunkel rechnen, nicht schauen (ux-design.md Regel 1).
- Reflow bei 200 % Textvergrößerung (Regel 3 / WCAG 1.4.10) — kein Clipping der Versionsnummer, sonst ist die Version nicht mehr lesbar.

### KoliBri
- Keine bedienbare Komponente im Spiel → KoliBri-Pflicht greift hier nicht; reines `span`-Text ist laut ux-design.md („Rohes HTML ausschließlich für Layout-Container") grenzwertig, aber im bestehenden Footer bereits etabliert und für statischen Text ohne Aktion zulässig — kein neuer Kommentar-Pflicht-Verstoß, solange kein `<button>`/`<input>`/`<table>` dazukommt.
- Falls die Adresse später klickbar werden soll (z. B. Karten-Link), wäre das ein eigenes Ticket mit `KolButton`/`KolLink` + 44px Touch-Target — hier bewusst nicht Teil des Scopes.

### Design-Sprache
- Farbe: keine Signal-/Brand-Rolle — neutraler Text (`--pp-ink-muted`) auf `--pp-surface-0`; keine Hintergrundänderung, daher keine Pflicht zur `color`-Kopplung.
- Typo/Skala: eine der fünf Stufen (`--pp-font-size-sm` ok für Sekundärtext, aber Fließtext ≥ 16px gilt nicht für Fußzeilen-Metadaten — sm = 0.875rem ist bestehende Konvention, beibehalten); Abstände nur aus `--pp-space-*` (Regel 6), damit ersetzt `marginRight: 1rem` ein Hardcode-Beispiel durch ein Token.

### Offene UX-Fragen
- [ ] Keine blockierenden. Hinweis (nicht blockierend): Emoji 📍 beibehalten oder streichen — ohne Adresse wirkt das Ortssymbol neben einer Adresse doppelt; Empfehlung: streichen oder `aria-hidden` setzen. Entscheidung kann in der Umsetzung fallen.

<!-- KI-UX:END -->
