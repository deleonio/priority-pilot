# Aufgabenbaum-Layout – Priority Pilot

**Stand:** 2026-08-30

Die App zeigt die Abhängigkeitsstruktur an genau einer Stelle als Baum: im Tab „Wald". Der Tab „Aufgaben" listet dagegen nur die ausführbaren Aufgaben flach.

---

## Journey: Aufgabenwald betrachten

### Ziel

Der Aufgabenwald (Tab „Wald") zeigt Abhängigkeiten als eingerückte Baumstruktur, sortiert nach Wert.

### Vorbedingung

- Mindestens eine Aufgabe existiert; für eine Baumstruktur mindestens eine Abhängigkeit
- Nutzer ist im Tab „Wald"

### Schritte

1. **Baum anzeigen**
   - Tab **„Wald"** auswählen
   - Unter der Überschrift „Priorisierung" erscheint der Aufgabenwald als Baumstruktur, sortiert nach Wert

2. **Hierarchie erkennen**
   - Jeder Knoten ist eine Card mit Titel („#id – Titel"), Prioritäts-Badge, **Wert** und **Gesamtaufwand** in Tagen
   - Unteraufgaben (Vorgänger) stehen unterhalb ihrer Eltern-Card und sind **je Ebene um einen festen Betrag eingerückt** — die Einrücktiefe korrespondiert mit der Abhängigkeitstiefe
   - Alle Knoten derselben Ebene sind gleich stark eingerückt

### Erwartetes Ergebnis

- Verschachtelte Aufgaben sind durch Einrückung sofort erkennbar
- Der Baum ist auf einen Blick verständlich (kein visuelles Chaos)
- Ein (unerwarteter) Zyklus in den Baumdaten bricht die Darstellung ab, statt sie endlos zu wiederholen

---

## Abgrenzung: Aufgaben-Tab

Der Tab „Aufgaben" (Ansicht „Offen") zeigt ausschließlich die **Blatt-Aufgaben** — Aufgaben ohne Unteraufgaben — als flache Liste ohne Einrückung und ohne Aufklapp-Funktion, sortiert nach Wertbeitrag. Übergeordnete Aufgaben sind nur im Tab „Wald" sichtbar.

---

## Randfälle & Fehler

| Situation                         | Erwartetes Verhalten                                       |
| --------------------------------- | ---------------------------------------------------------- |
| Keine Abhängigkeiten              | Jede Aufgabe ist Wurzel und wird ohne Einrückung angezeigt |
| Tiefe Verschachtelung (>3 Ebenen) | Einrückung wächst je Ebene und bleibt lesbar               |
| Leerer Aufgabenwald               | Card „Keine offenen Aufgabenbäume" mit Hinweistext         |
| Mobilansicht                      | Hierarchie bleibt erkennbar (ggf. reduzierter Abstand)     |
