# LLM-Test-Schalter – Issue 749

**Stand:** 2026-08-19
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
   - UI zeigt die Auswahl „Mistral", „OpenRouter" und „System-Standard"
   - Dargestellt als exklusive Radio-Group (`KolInputRadio`, `kol-input-radio`).
     _Präzisierung bei der Umsetzung:_ Die ursprüngliche Annahme „zwei Toggle-Switches"
     trägt den dritten Zustand „System-Standard (Kaskade)" nicht — bei genau-einem-von-drei
     ist eine Radio-Group das semantisch korrekte Muster (ARIA `role="radio"` statt `switch`).
   - Aktueller Provider ist visuell hervorgehoben, inaktive Optionen sind abgesetzt

2. **Provider umschalten**
   - Nutzer klickt auf „Mistral"-Schalter
   - Sofortiges Feedback: Toast-Hinweis „Provider gewechselt: Mistral"
   - „Mistral"-Schalter ist nun highlightet, „OpenRouter" grau
   - ANDERE Schalter geht automatisch aus (exklusiv)

3. **LLM-Anfrage mit umgeleitetem Provider**
   - Nutzer löst LLM-Anfrage aus (z. B. KI-gestützte Task-Erfassung)
   - Anfrage geht an den aktuell gewählten Provider (z. B. Mistral)
   - Antwort wird wie gewohnt verarbeitet
   - **Verdrahtung:** Frontend hängt Query-Param `provider` an jeden
     LLM-Endpunkt (`/tasks/parse-text`, `/tasks/suggest-pillars`,
     `/pillars/advisor`, `/lektorat`). Der Server pinnt die Kaskade auf den
     genannten Provider — kein Fallback, keine Verfeinerungs-Stufe.
     Fehlt der Parameter → Kaskade wie bisher. Ungültiger Wert → HTTP 400.

4. **Provider-Schalter persistieren**
   - Nutzer schließt App und öffnet sie erneut
   - Zuletzt gewählter Provider ist noch aktiv
   - Schalter-Position entspricht dem persistenten State

5. **Mobile-Nutzung**
   - Auf Mobile (<768px) sind Schalter vertikal gestapelt
   - Touch-Ziele sind mindestens 44px hoch
   - Schalter sind gut tappbar

6. **Tastatur-Navigation (A11y)**
   - Nutzer navigiert mit Tab zur Radio-Group, wählt mit Pfeiltasten/Space
   - ARIA-Attribute sind korrekt gesetzt: `role="radio"`, `aria-checked` je Option,
     Gruppen-Label „LLM-Provider" (KoliBri setzt die Attribute auf die nativen Inputs)
   - Screenreader kündigt die Option mit Auswahlzustand an

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

- Tastatur-Navigation: Tab/Pfeiltasten/Space für die Radio-Group
- ARIA: `role="radio"`, `aria-checked` je Option, Gruppen-Label `aria-label`
- Screenreader: Option mit Auswahlzustand („Mistral, ausgewählt")
- Kontrast: aktiver/inaktiver Status vs. Background min 4.5:1
- Fokus-Indikator sichtbar

**KoliBri:**

- `kol-input-radio` nutzen (exklusive Auswahl, drei Optionen inkl. „System-Standard")
- BITV-2.1-PS: Radio-Group erfüllt das Standard-Interaktionsmuster für „genau einer von n"

**Empfehlung:**

- Exklusive Toggles (nur ein Provider aktiv)
- Default: System-Standard oder erster verfügbarer Provider
- Placement: In Provider-Settings oder Quick-Action Bar

---
## Versionierung

- **v1.1** (2026-08-19): Nightly-Sync — Ist-Stand verifiziert, LLM-Test-Schalter implementiert
- **v1.0** (2026-08-17): Initialefassung für Issue #749