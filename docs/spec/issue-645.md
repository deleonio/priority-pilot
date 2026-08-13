# LLM-Textfunktion – Kürzen und Lektorieren

**Stand:** 2026-08-13  
**Issue:** #645  
**Ziel:** LLM-basierte Textfunktion zum Kürzen und Lektorieren mit optionaler Längenbegrenzung

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
   - Funktion aufrufen mit Text und Parameter `max_length=null`
   - LLM verarbeitet den Text

3. **Lektorierten Text erhalten**
   - Funktion gibt korrigierten Text zurück

### Erwartetes Ergebnis

- Text ist korrigiert (keine Tippfehler, korrekte Grammatik)
- Stil ist verbessert aber contenido bleibt gleich
- Länge ist ähnlich zum Original (keine Kürzung)

---

## Journey 2: Text kürzen mit Max-Länge

### Ziel

Einen Text durch LLM kürzen UND lektorieren lassen mit einer maximalen Zeichenlänge.

### Vorbedingung

- LLM-Service ist verfügbar
- Eingabetext ist länger als die Ziel-Länge

### Schritte

1. **Langeingabetext bereitstellen**
   - Text: _„Dies ist ein sehr langer Text mit viel Inhalt und vielen Details, der gekürzt werden soll..."_ (80 Zeichen)

2. **Kürzung mit Max-Länge anfordern**
   - Funktion aufrufen mit Text und Parameter `max_length=50`
   - LLM verarbeitet den Text mit Längen-Begrenzung

3. **Gekürzten Text erhalten**
   - Funktion gibt gekürzten Text zurück

### Erwartetes Ergebnis

- Text ist ≤50 Zeichen (respektiert max_length)
- Text ist lektorisiert (keine Tippfehler)
- Kerninhalt/Content ist erhalten
- Text ist sinnvoll gekürzt (nicht einfach abgeschnitten)

---

## Journey 3: Titel lektorieren und kürzen

### Ziel

Einen Aufgabentitel durch LLM lektorieren/optimal kürzen für Anzeige in UI.

### Vorbedingung

- LLM-Service ist verfügbar
- Ursprünglicher Titel ist vorhanden

### Schritte

1. **Titel bereitstellen**
   - Original-Titel: _„GROSSES PROJEKT mit viel Aufwand und DRINGEND"_

2. **Titel-Optimierung anfordern**
   - Funktion aufrufen mit Text und Parameter `max_length=30`
   - LLM verarbeitet den Titel-typischen Text

3. **Optimierten Titel erhalten**
   - Funktion gibt optimierten Titel zurück

### Erwartetes Ergebnis

- Titel ist ≤30 Zeichen (UI-Platz)
- Titel ist lektorisiert (keine Caps-lock-Fehler)
- Titel ist aussagekräftig und professionell
- Wesentliche Information ist erhalten

---

## Journey 4: Beschreibung lektorieren

### Ziel

Eine Aufgabenbeschreibung durch LLM lektorieren für bessere Lesbarkeit.

### Vorbedingung

- LLM-Service ist verfügbar
- Ursprüngliche Beschreibung ist vorhanden

### Schritte

1. **Beschreibung bereitstellen**
   - Original-Beschreibung: _„Dies ist die beschreibung für die aufgabe die viel arbeit macht"_

2. **Beschreibungs-Lektorat anfordern**
   - Funktion aufrufen mit Text und Parameter `max_length=null`
   - LLM verarbeitet den Beschreibungstext

3. **Lektorierte Beschreibung erhalten**
   - Funktion gibt korrigierte Beschreibung zurück

### Erwartetes Ergebnis

- Beschreibung ist grammatikalisch korrekt
- Groß-/Kleinschreibung ist korrigiert
- Inhalt/Information ist unverändert
- Länge ist ähnlich zum Original

---

## Technische Randbedingungen

| Parameter  | Typ            | Pflicht | Beschreibung                                        |
| ---------- | -------------- | ------- | --------------------------------------------------- |
| text       | string         | Ja      | Der zu verarbeitende Text                           |
| max_length | number \| null | Nein    | Maximale Länge in Zeichen (null = keine Begrenzung) |

| Rückgabe | Typ    | Beschreibung                                          |
| -------- | ------ | ----------------------------------------------------- |
| result   | string | Der verarbeitete Text (lektorisiert und ggf. gekürzt) |

---

## Randfälle & Fehler

| Situation                        | Erwartetes Verhalten                    |
| -------------------------------- | --------------------------------------- |
| Leerer Text                      | Gibt leeren String zurück               |
| max_length = 0                   | Gibt leeren String zurück               |
| max_length negativ               | Fehler/Validierung                      |
| LLM nicht verfügbar              | Fehler/Timeout                          |
| Text schon kürzer als max_length | Text wird nur lektoriert, nicht gekürzt |

---

## Hinweise zur Nutzung

- **Fokus:** Diese Funktion ist spezialisiert auf Text-Optimierung, nicht auf Content-Generierung
- **Anwendbarkeit:** Funktion ist für Titel (kurz, prägnant) und Beschreibungen (länger, detailiert) geeignet
- **LLM-Verhalten:** Die genaue Längen-Respektierung hängt vom LLM ab – bei sehr kurzen max_length-Werten kann der Text leicht variieren

---

## Versionierung

- **v1.0** (2026-08-13): Initialefassung für Issue #645. LLM-Textfunktion spezifiziert.
