---
name: issue-679-kolinput-counter
description: Spec für Issue 679 - Zeichenzähler für KolInput basierend auf KolInputText/KolTextarea
metadata:
  type: project
---

# Issue 679: Zeichenzähler für KolInput

## Ziel

KolInput soll einen Zeichenzähler erhalten, der auf der bestehenden Counter-Implementierung von KolInputText und KolTextarea basiert.

## Vorbedingung

- KoliBri-Komponenten sind korrekt installiert und konfiguriert (@public-ui/react-v19 v4.3.0)
- Die Implementierung von KolInputText und KolTextarea mit Counter-Logik ist bereits vorhanden

## Schritte

1. Analyse der existierenden Counter-Implementierung von KolInputText/KolTextarea
2. Ableitung der Counter-Logik für KolInput basierend auf den existierenden Implementierungen
3. Implementierung des Counters für KolInput
4. Integration des Counters in die KolInput-Komponente

## Erwartetes Ergebnis

- KolInput zeigt die aktuelle Zeichenanzahl an (Format: "X/Y" oder "X")
- Counter basiert auf KolInputText/KolTextarea Implementierung (Wiederverwendung)
- Counter wird bei Eingabe aktualisiert (reaktiv auf User-Input)

## Testfälle (aus Akzeptanzkriterien)

- Eingabe von 5 Zeichen → Counter zeigt "5"
- Eingabe von 100 Zeichen → Counter zeigt "100"
- Leeres Feld → Counter zeigt "0"

## Technische Hinweise

- Die existierende `getCharacterCounter()` Funktion aus `titleLengthValidation.ts` zeigt das Counter-Format "X/Y"
- KolInputText und KolTextarea haben bereits Counter-Implementierung in KoliBri
- Die Implementierung soll Wiederverwendung bestehender Counter-Logik priorisieren
