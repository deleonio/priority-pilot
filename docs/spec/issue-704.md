# Aufgabenbaum-Layout – Priority Pilot

**Stand:** 2026-08-16  
**Ziel:** Saubere, strukturierte Darstellung des Aufgabenbaums mit klarer Hierarchie (Issue #704, Teil von #702)

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
   - Tab **„Aufgabenwald"** auswählen
   - Der Aufgabenbaum zeigt Aufgaben als Baumstruktur, sortiert nach Wert

2. **Hierarchie erkennen**
   - **Eltern-Aufgaben** erscheinen oben (weniger eingerückt)
   - Ihre **Unteraufgaben (Vorgänger)** erscheinen darunter mit **erkennbarer Einrückung** (Indentation) —
     Baum-Richtung gemäß #336 (`server/src/logics/tree.ts`): eine Unteraufgabe wird als Vorgänger der
     Eltern-Aufgabe modelliert
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

## Akzeptanzkriterien (aus Issue)

- Aufgabenbaum sauber/strukturiert dargestellt
- UX-Prinzipien eingehalten (Whitespace, Hierarchie visuell)
- Konsistentes Erscheinungsbild

---

## Testfälle

- Aufgaben mit verschachtelter Struktur sind klar erkennbar
- Einrückung/Indentation ist intuitiv
- Kein visuelles Chaos (keine unklaren Hierarchien)

---

## Randfälle & Fehler

| Situation                           | Erwartetes Verhalten                                     |
| ----------------------------------- | -------------------------------------------------------- |
| Flache Liste (keine Abhängigkeiten) | Aufgaben werden ohne Einrückung angezeigt                |
| Tiefe Verschachtelung (>3 Ebenen)   | Einrückung bleibt lesbar (nicht zu stark komprimiert)    |
| Viele Aufgaben auf gleicher Ebene   | Whitespace bleibt ausreichend (nicht zusammengedrängt)   |
| Mobilansicht                        | Hierarchie bleibt erkennbar (ggf. reduzierte Whitespace) |

---

## Hinweise zur Implementierung

- **Format:** Dieser Spec beschreibt das beobachtbare Verhalten, nicht die technische Implementierung.
- **Test-Strategie:** Da es sich um Layout/UI handelt, werden Tests primär über E2E-Tests abgebildet, die das visuelle Ergebnis prüfen.
- **UX-Prinzipien:** Der Spec orientiert sich an etablierten UI-Prinzipien (Whitespace, visuelle Hierarchie, Konsistenz).

---

## Versionierung

- **v1.0** (2026-08-16): Initialefassung für Issue #704.
