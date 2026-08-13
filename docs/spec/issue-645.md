# LLM-Textfunktion – Kürzen und Lektorieren

**Stand:** 2026-08-13
**Issue:** #645
**Ziel:** LLM-basierte Textfunktion zum Kürzen und Lektorieren mit optionaler Längenbegrenzung

## Implementierungsstand

Umgesetzt in PR #647 als `lektoratTextWithMistral` in [`server/src/llm/llm.ts`](../../server/src/llm/llm.ts).
Die Funktion ist **noch nicht an einen Endpunkt angebunden** — Journeys 1+2 (Backend-Vertrag) sind
erfüllt, Journeys 3+4 (Frontend-Anwendung auf Titel/Beschreibung) sind offen.

---

## Journey 1: Text lektorieren

### Ziel

Einen Text durch LLM korrigieren lassen (Rechtschreibung, Grammatik, Stil) ohne die Länge zu ändern.

### Vorbedingung

- LLM-Service ist verfügbar
- Eingabetext ist vorhanden

### Schritte

1. **Eingabetext bereitstellen**
   - Text mit Fehlern: _„Dieser Text hat Tippfehler und ist schlecht formuliert."_

2. **LLM-Lektorat anfordern**
   - Funktion aufrufen mit Text und ohne `maxLength`
   - LLM verarbeitet den Text

3. **Lektorierten Text erhalten**
   - Funktion gibt korrigierten Text zurück

### Erwartetes Ergebnis

- Text ist korrigiert (keine Tippfehler, korrekte Grammatik)
- Stil ist verbessert, der Inhalt bleibt gleich
- Länge ist ähnlich zum Original (keine Kürzung)

---

## Journey 2: Text kürzen mit Max-Länge

### Ziel

Einen Text durch LLM kürzen UND lektorieren lassen mit einer maximalen Zeichenlänge.

### Vorbedingung

- LLM-Service ist verfügbar
- Eingabetext ist länger als die Ziel-Länge

### Schritte

1. **Langen Eingabetext bereitstellen**
   - Text: _„Dies ist ein sehr langer Text mit viel Inhalt und vielen Details, der gekürzt werden soll..."_ (80 Zeichen)

2. **Kürzung mit Max-Länge anfordern**
   - Funktion aufrufen mit Text und `maxLength=50`
   - LLM verarbeitet den Text mit Längen-Begrenzung

3. **Gekürzten Text erhalten**
   - Funktion gibt gekürzten Text zurück

### Erwartetes Ergebnis

- Text ist ≤50 Zeichen (respektiert `maxLength`)
- Text ist lektorisiert (keine Tippfehler)
- Kerninhalt ist erhalten
- Text ist sinnvoll gekürzt (nicht einfach abgeschnitten)

---

## Journey 3: Titel lektorieren und kürzen _(offen — Frontend)_

### Ziel

Einen Aufgabentitel durch LLM lektorieren/optimal kürzen für die Anzeige in der UI.

### Vorbedingung

- LLM-Service ist verfügbar
- Ursprünglicher Titel ist vorhanden

### Schritte

1. **Titel bereitstellen**
   - Original-Titel: _„GROSSES PROJEKT mit viel Aufwand und DRINGEND"_

2. **Titel-Optimierung anfordern**
   - Funktion aufrufen mit Text und `maxLength=30`
   - LLM verarbeitet den Titel-typischen Text

3. **Optimierten Titel erhalten**
   - Funktion gibt optimierten Titel zurück

### Erwartetes Ergebnis

- Titel ist ≤30 Zeichen (UI-Platz)
- Titel ist lektorisiert (keine Caps-lock-Fehler)
- Titel ist aussagekräftig und professionell
- Wesentliche Information ist erhalten

---

## Journey 4: Beschreibung lektorieren _(offen — Frontend)_

### Ziel

Eine Aufgabenbeschreibung durch LLM lektorieren für bessere Lesbarkeit.

### Vorbedingung

- LLM-Service ist verfügbar
- Ursprüngliche Beschreibung ist vorhanden

### Schritte

1. **Beschreibung bereitstellen**
   - Original-Beschreibung: _„Dies ist die beschreibung für die aufgabe die viel arbeit macht"_

2. **Beschreibungs-Lektorat anfordern**
   - Funktion aufrufen mit Text und ohne `maxLength`
   - LLM verarbeitet den Beschreibungstext

3. **Lektorierte Beschreibung erhalten**
   - Funktion gibt korrigierte Beschreibung zurück

### Erwartetes Ergebnis

- Beschreibung ist grammatikalisch korrekt
- Groß-/Kleinschreibung ist korrigiert
- Inhalt/Information ist unverändert
- Länge ist ähnlich zum Original

---

## Technische Schnittstelle

Implementiert als `lektoratTextWithMistral` (Mistral → OpenRouter-Kaskade).

| Eingabe (`LektoratInput`) | Typ    | Pflicht | Beschreibung                                         |
| ------------------------- | ------ | ------- | ---------------------------------------------------- |
| `text`                    | string | Ja      | Der zu verarbeitende Text (nicht leer)               |
| `maxLength`               | number | Nein    | Maximale Länge in Zeichen (positiv, falls angegeben) |

| Ausgabe (`LektoratOutput`) | Typ    | Beschreibung                                       |
| -------------------------- | ------ | -------------------------------------------------- |
| `text`                     | string | Verarbeiteter Text (lektorisiert und ggf. gekürzt) |

---

## Randfälle & Fehler

| Situation                         | Erwartetes Verhalten                        |
| --------------------------------- | ------------------------------------------- |
| Leerer / nur-Whitespace-Text      | Wirft `MistralRequestError` (kein API-Call) |
| `maxLength` = 0 oder negativ      | Wirft `MistralRequestError`                 |
| Kein API-Key konfiguriert         | Wirft `MissingApiKeyError`                  |
| Alle Provider ausgefallen         | Wirft `MistralRequestError`                 |
| Text schon kürzer als `maxLength` | Text wird nur lektoriert, nicht gekürzt     |

---

## Hinweise zur Nutzung

- **Fokus:** Diese Funktion ist spezialisiert auf Text-Optimierung, nicht auf Content-Generierung.
- **Anwendbarkeit:** Für Titel (kurz, prägnant) und Beschreibungen (länger, detailliert) geeignet.
- **LLM-Verhalten:** Die genaue Längen-Respektierung hängt vom LLM ab – bei sehr kurzen
  `maxLength`-Werten kann der Text leicht variieren.
