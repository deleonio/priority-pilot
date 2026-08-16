# LLM-Test-Schalter für Mistral und OpenRouter

**Issue:** #749  
**Stand:** 2026-08-16  
**Ziel:** Provider-Auswahl für LLM-Anfragen über UI-Schalter steuern

---

## Journey: LLM-Provider für Test-Anfragen auswählen

### Ziel

LLM-Anfragen gezielt an Mistral oder OpenRouter für Test-Zwecke umleiten, ohne den Produktiv-Provider zu ändern.

### Vorbedingung

- Nutzer ist angemeldet
- Dashboard oder Aufgaben-Tab ist geöffnet
- LLM-Feature ist verfügbar (KI-gestützte Erfassung)

### Schritte

1. **Provider-Schalter finden**
   - Schalter-Gruppe ist sichtbar mit zwei Optionen: **„Mistral"** und **„OpenRouter"**
   - Schalter sind als Toggle-Buttons oder Toggle-Switches dargestellt
   - Aktueller Provider ist gehighlightet, inaktive Option ist grau dargestellt

2. **Schalter umlegen auf Mistral**
   - Klick auf **„Mistral"**-Schalter
   - Sofortiges Feedback: Toast/Hinweis **„Provider gewechselt: Mistral"**
   - Mistral-Schalter ist aktiv (highlightet), OpenRouter ist inaktiv

3. **LLM-Anfrage mit Mistral auslösen**
   - Text eingeben: _„Bis Freitag den Kundenbericht fertigstellen"_
   - Klick auf **„Verarbeiten und weiter"**
   - LLM-Anfrage wird an Mistral gesendet
   - Antwort oder Fehler von Mistral wird angezeigt

4. **Schalter umlegen auf OpenRouter**
   - Klick auf **„OpenRouter"**-Schalter
   - Sofortiges Feedback: Toast/Hinweis **„Provider gewechselt: OpenRouter"**
   - OpenRouter-Schalter ist aktiv, Mistral ist inaktiv

5. **LLM-Anfrage mit OpenRouter auslösen**
   - Text eingeben: _„Aufgaben für nächste Woche priorisieren"_
   - Klick auf **„Verarbeiten und weiter"**
   - LLM-Anfrage wird an OpenRouter gesendet
   - Antwort oder Fehler von OpenRouter wird angezeigt

### Erwartetes Ergebnis

- **Standardzustand:** Ohne Schalter-Betätigung wird der konfigurierte Standard-Provider verwendet
- **Mistral aktiv:** LLM-Anfragen gehen an Mistral (Provider-Header/Config entsprechend)
- **OpenRouter aktiv:** LLM-Anfragen gehen an OpenRouter (Provider-Header/Config entsprechend)
- **Persistenz:** Schalter-Zustand ist persistent (Session/App-State)
- **Visuelles Feedback:** Aktiver Provider ist klar erkennbar (highlightet, nicht grau)
- **Sofortiges Feedback:** Nach Umschalten erscheint Toast/Hinweis
- **Exklusivität:** Nur ein Provider kann gleichzeitig aktiv sein

---

## Randfälle & Fehler

| Situation                  | Erwartetes Verhalten                                     |
| -------------------------- | -------------------------------------------------------- |
| Kein LLM-Service verfügbar | Hinweis: „LLM-Dienst derzeit nicht verfügbar."           |
| Provider-Auth fehlhaft     | Hinweis: „Provider-Authentifizierung fehlgeschlagen."    |
| Timeout bei LLM-Anfrage    | Hinweis: „LLM-Anfrage timeout – bitte erneut versuchen." |
| Beide Schalter inaktiv     | Hinweis: „Standard-Provider wird verwendet."             |

---

## UX-Anforderungen (aus KI-UX:END-Block)

**Interaktion:**

- Toggle-Buttons oder Toggle-Switches
- Klare Beschriftung: „Mistral" / „OpenRouter"
- Visuell Feedback: Aktueller Provider gehighlightet, inaktivgrau
- Sofortiges Feedback nach Umschalten: Toast/Hinweis „Provider gewechselt"
- Ladestatus bei LLM-Anfrage: Spinner/Progress-Indikator

**Mobile-First:**

- Schalter in Reihe oder Checkbox-Group für Touch-Ziele (min 44px)
- Portrait: Untereinander; Landscape: Nebeneinander wenn Platz
- Breakpoint <768px: vertikale Stackung

**A11y/BITV:**

- Tastatur-Navigation: Tab/Space/Enter für Schalter
- ARIA: `role="switch"`, `aria-checked`, `aria-label`
- Screenreader: „Mistral Provider - aktiviert/inaktiv"
- Kontrast: ON/OFF-Status vs. Background min 4.5:1
- Fokus-Indikator sichtbar

**KoliBri:**

- `kol-toggle-group` oder `kol-toggle-button` nutzen
- Theme-Integration: `_variant="primary"` für aktiven Provider
- BITV-2.1-PS: Toggle-Switches erfüllen Standard-Interaktionsmuster

**Empfehlung:**

- Exklusive Toggles (nur ein Provider aktiv)
- Default: System-Standard oder erster verfügbarer Provider
- Placement: In Provider-Settings oder Quick-Action Bar
