# Spec #2443 — Feedback-Formular: Vorauswahl „Wünsche und Ideen"

**Ziel:** Hilfe → Feedback öffnet mit der Kategorie „Wünsche und Ideen" (`wunsch`).

**Vorbedingung:** Nutzer ist angemeldet, Feedback-Tab geöffnet.

**Schritte / erwartetes Ergebnis**

1. Formular öffnen → Kategorie-Select zeigt „Wünsche und Ideen" (AK1). Optionsreihenfolge unverändert: Fragen und Hilfe, Wünsche und Ideen, Fehler melden.
2. Titel und Beschreibung füllen, ohne Kategorie-Wechsel senden → `POST /api/v1/feedback` mit `category: 'wunsch'` (AK2).
3. „Fragen und Hilfe" / „Fehler melden" bleiben wählbar und senden `frage` / `bug` (AK3, durch e2e AK8/AK9 gedeckt).
