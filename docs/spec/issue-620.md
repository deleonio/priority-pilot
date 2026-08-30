# User Journey – Frontend-Error-Handling für LLM-Calls

**Stand:** 2026-08-30

---

## Journey: KI-Dienst-Ausfall behandeln

### Ziel

Bei Ausfall/Timeout des Mistral-Dienstes eine verständliche Fehlermeldung anzeigen statt roher HTTP 502, und optional bei transienten Fehlern einen Retry versuchen.

### Vorbedingung

- Nutzer ist angemeldet
- KI-gestützte Erfassung ist verfügbar (parse-text oder pillars/advisor)

### Schritte

1. **KI-gestützte Erfassung auslösen**
   - Text eingeben: _„Bis Freitag den Kundenbericht fertigstellen, hohe Priorität, etwa ein halber Tag"_
   - Klick auf **„Verarbeiten und weiter"** (sendet den erfassten Text an die KI)

2. **Mistral-Ausfall simulieren**
   - Mistral-Dienst antwortet mit HTTP 502 (Bad Gateway) oder Timeout
   - Optional: Retry-Logik tritt in Kraft bei transienten 5xx-Fehlern

3. **Fehlerbeobachtung**
   - Anstelle von rohem HTTP 502 wird eine verständliche Fehlermeldung angezeigt
   - Fehlermeldung ist nutzerfreundlich formuliert

### Erwartetes Ergebnis

- **Primär:** Fehlermeldung ist verständlich und nicht technisch (keine rohe HTTP 502)
- **Inhalt der Fehlermeldung:** Bei 502/503/504: „Der KI-Dienst ist gerade nicht erreichbar. Bitte versuche es später erneut."
- **Retry:** Bei transienten 5xx-Fehlern (502/503/504) versucht der Client automatisch bis zu 3 Versuche gesamt — für `parse-text` und `pillars/advisor`; `suggest-pillars` und `lektorat` schlagen direkt fehl
- **UX:** Die Fehlermeldung erscheint im Fehler-Alert des jeweiligen Dialogs; der Nutzer kann den Vorgang erneut versuchen
- **Persistenz:** Fehlerzustand wird nicht gespeichert, Nutzer kann es erneut versuchen

---

## Randfälle & Fehler

| Situation                              | Erwartetes Verhalten                                                                                                                                        |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mistral-Dienst antwortet mit HTTP 502  | Verständliche Fehlermeldung statt roher Fehlercode                                                                                                          |
| Mistral-Dienst Timeout                 | Verständliche Fehlermeldung statt technischer Timeout-Meldung                                                                                               |
| Transienter 5xx-Fehler (502, 503, 504) | Automatischer Retry (bis 3 Versuche gesamt) bei `parse-text`/`pillars/advisor`, danach verständliche Fehlermeldung; `suggest-pillars`/`lektorat` ohne Retry |
| API-Key ungültig                       | Verständliche Fehlermeldung über Konfigurationsproblem                                                                                                      |
| Netzwerkprobleme (Client-seitig)       | Verständliche Fehlermeldung über Netzwerkprobleme                                                                                                           |
| Wiederholte Fehler nach Retry          | Klarstellung, dass der Dienst vorübergehend nicht erreichbar ist                                                                                            |

---

## Hinweise zur Nutzung

- **Implementierung:** Implementierungsagnostisch – beschreibt das beobachtbare Verhalten
