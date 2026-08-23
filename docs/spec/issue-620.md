# User Journey – Frontend-Error-Handling für LLM-Calls

**Stand:** 2026-08-23  
**Version:** v1.1 (2026-08-23): Nightly-Sync — Ist-Meldungstext und Retry-Umfang aus Code belegt ergänzt.  
**Issue:** #620 (Teil von #617)

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
- **Inhalt der Fehlermeldung:** Bei 502/503/504 (oder nicht-JSON-Antwort): „Der KI-Dienst ist gerade nicht erreichbar. Bitte versuche es später erneut."
- **Retry:** Bei transienten 5xx-Fehlern (502/503/504) versucht der Client automatisch bis zu 3 Versuche gesamt — für `parse-text` und `pillars/advisor`; `suggest-pillars` und `lektorat` schlagen direkt fehl
- **UX:** Nutzer kann die Fehlermeldung dismissen oder erneut versuchen
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

- **Scope:** Dieser Journey fokussiert auf das Frontend-Error-Handling für LLM-Calls
- **Implementierung:** Implementierungsagnostisch – beschreibt das beobachtbare Verhalten, nicht den technischen Pfad
- **Test-Strategie:** Tests validieren das User-Experience-Verhalten (verständliche Fehlermeldung) nicht technische Implementierungsdetails
- **Files betroffen:** Frontend-Components für `parse-text` + `pillars/advisor` (Error-Handling/API-Client-Layer)

---

## Versionierung

- **v1.0** (2026-08-13): Initialefassung für Issue #620. Frontend-Error-Handling für LLM-Calls spezifiziert.
