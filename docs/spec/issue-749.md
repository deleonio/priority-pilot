# LLM-Test-Schalter – Issue 749

**Stand:** 2026-08-17  
**Ziel:** LLM-Anfragen über Test-Schalter an Mistral oder OpenRouter umleiten

---

## Journey: LLM-Provider über Schalter umleiten

### Ziel

LLM-Anfragen für Tests gezielt an Mistral oder OpenRouter senden, statt den Standard-Provider zu nutzen.

### Vorbedingung

- Priority Pilot App ist geöffnet
- Nutzer hat Zugriff auf LLM-Features (z. B. KI-gestützte Task-Erfassung)

### Schritte

1. **Provider-Schalter anzeigen**
   - UI zeigt zwei Schalter: „Mistral" und „OpenRouter"
   - Schalter sind als Toggles dargestellt (Toggle-Switches oder Toggle-Buttons)
   - Aktueller Provider ist visuell gehighlightet
   - Inaktiver Provider ist grau dargestellt

2. **Provider umschalten**
   - Nutzer klickt auf „Mistral"-Schalter
   - Sofortiges Feedback: Toast-Hinweis „Provider gewechselt: Mistral"
   - „Mistral"-Schalter ist nun highlightet, „OpenRouter" grau
   - ANDERE Schalter geht automatisch aus (exklusiv)

3. **LLM-Anfrage mit umgeleitetem Provider**
   - Nutzer löst LLM-Anfrage aus (z. B. KI-gestützte Task-Erfassung)
   - Anfrage geht an den aktuell gewählten Provider (z. B. Mistral)
   - Antwort wird wie gewohnt verarbeitet

4. **Provider-Schalter persistieren**
   - Nutzer schließt App und öffnet sie erneut
   - Zuletzt gewählter Provider ist noch aktiv
   - Schalter-Position entspricht dem persistenten State

5. **Mobile-Nutzung**
   - Auf Mobile (<768px) sind Schalter vertikal gestapelt
   - Touch-Ziele sind mindestens 44px hoch
   - Schalter sind gut tappbar

6. **Tastatur-Navigation (A11y)**
   - Nutzer navigiert mit Tab zu den Schaltern
   - Space/Enter schaltet den Provider um
   - ARIA-Attribute sind korrekt gesetzt: `role="switch"`, `aria-checked`, `aria-label`
   - Screenreader kündigt „Mistral Provider - aktiviert" an

### Erwartetes Ergebnis

- Schalter sind persistent (Session/App-State)
- Schalter schalten LLM-Anfragen um auf den jeweiligen Provider
- Nur ein Provider gleichzeitig aktiv (exklusiv)
- Visuelles Feedback ist sofort sichtbar
- Mobile-First-Design ist gewährleistet
- Tastatur-Navigation und Screenreader funktionieren

---

## Randfälle & Fehler

| Situation                         | Erwartetes Verhalten                                   |
| --------------------------------- | ------------------------------------------------------ |
| Kein Provider verfügbar           | Schalter sind deaktiviert oder nicht sichtbar          |
| Provider-Antwort fehlerhaft       | Fehlermeldung wie gewohnt, kein spezielles Handling    |
| Schalter werden nicht persistiert | Standard-Provider wird beim nächsten App-Start genutzt |
| Beide Schalter gleichzeitig aktiv | Nicht möglich – exklusive Toggles (nur einer aktiv)    |

---

## UX-Anforderungen (aus KI-UX:END-Block)

**Interaktion:**

- Schalter als Toggle-Buttons oder Toggle-Switches
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
