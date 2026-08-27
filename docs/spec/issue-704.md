# Aufgabenbaum-Layout – Priority Pilot

**Stand:** 2026-08-27  
**Ziel:** Saubere, strukturierte Darstellung des Aufgabenbaums mit klarer Hierarchie

Dieser Spec beschreibt das beobachtbare Verhalten des Aufgabenbaum-Layouts, insbesondere die visuelle Darstellung verschachtelter Aufgabenstrukturen.

---

## Journey: Aufgabenbaum betrachten

### Ziel

Den Aufgabenbaum so darstellen, dass verschachtelte Strukturen sofort erkennbar sind, visuelles Chaos vermieden wird und konsistente UI-Prinzipien angewendet werden.

### Vorbedingung

- Mindestens zwei Aufgaben mit Abhängigkeiten existieren (eine Aufgabe hängt von der anderen ab)
- Nutzer ist im Aufgabenwald-Tab

### Schritte

1. **Aufgabenbaum anzeigen**
   - Tab **„Wald"** auswählen
   - Der Aufgabenbaum zeigt Aufgaben als Baumstruktur, sortiert nach Wert

2. **Hierarchie erkennen**
   - **Eltern-Aufgaben** erscheinen oben (weniger eingerückt)
   - Ihre **Unteraufgaben (Vorgänger)** erscheinen darunter mit **erkennbarer Einrückung** (Indentation) —
     eine Unteraufgabe wird als Vorgänger der Eltern-Aufgabe modelliert
   - Die Einrücktiefe korrespondiert mit der Abhängigkeitstiefe (Tiefe 1 = leicht eingerückt, Tiefe 2 = stärker eingerückt, etc.)

3. **Visuelle Konsistenz prüfen**
   - **Whitespace**: Zwischen Aufgaben auf gleicher Hierarchiestufe ist ausreichender Abstand (nicht zusammengedrängt)
   - **Linienführung** (optional): Verbindungen zwischen Vorgänger und Nachfolger sind als klare Linien oder Pfeile sichtbar
   - **Konsistente Einrückung**: Alle Aufgaben gleicher Hierarchiestufe sind gleich stark eingerückt

### Erwartetes Ergebnis

- Verschachtelte Aufgaben sind durch Einrückung sofort erkennbar
- Die Baumstruktur ist auf einen Blick verständlich (kein visuelles Chaos)
- Hierarchie-Ebenen sind durch visuelle Abstände klar unterscheidbar
- Das Layout ist konsistent mit anderen UI-Elementen der App

---

## Randfälle & Fehler

| Situation                           | Erwartetes Verhalten                                     |
| ----------------------------------- | -------------------------------------------------------- |
| Flache Liste (keine Abhängigkeiten) | Aufgaben werden ohne Einrückung angezeigt                |
| Tiefe Verschachtelung (>3 Ebenen)   | Einrückung bleibt lesbar (nicht zu stark komprimiert)    |
| Viele Aufgaben auf gleicher Ebene   | Whitespace bleibt ausreichend (nicht zusammengedrängt)   |
| Mobilansicht                        | Hierarchie bleibt erkennbar (ggf. reduzierte Whitespace) |
