# Erledigte Aufgaben als Tabelle — Priority Pilot

**Stand:** 2026-08-27  
**Ziel:** Von außen sichtbares Verhalten der Erledigt-Ansicht (Tabelle der erledigten Aufgaben)

## Journey: Erledigte Aufgaben in der Tabelle betrachten und wieder öffnen

### Ziel

Die Tabelle der erledigten Aufgaben ist auf allen Viewports lesbar und bedienbar: kurze Header, inhaltsbezogene Spaltenbreiten, internes horizontales Scrollen auf schmalen Hosts.

### Vorbedingung

- Angemeldeter Nutzer, „Aufgaben"-Tab aktiv, Offen/Erledigt-Umschalter auf „Erledigt"
- Mindestens ein erledigter Task existiert

### Schritte

1. **Erledigt-Ansicht öffnen**
   - Tab „Aufgaben" → Umschalter „Erledigt"
   - Die Tabelle zeigt je Zeile den Titel, je Säule eine Punkte-Spalte und eine Aktion-Spalte

2. **Spalten betrachten (Desktop)**
   - Header: „Titel" · je Säule eine **gekürzte** Bezeichnung (maximal 20 Zeichen, Längere enden mit „…") · „Aktion"
   - Die Titel-Spalte ist breiter als jede Punkte-Spalte; jede Kopfzelle ist einzeilig

3. **Schmalen Viewport verwenden (z. B. 375 px)**
   - Es gibt keinen Mobile-Karten-Modus: die Kopfzeile bleibt sichtbar
   - Die Tabelle scrollt **intern horizontal** (erste und letzte Spalte — Titel und Aktion — bleiben fixiert), während die Seite selbst nicht horizontal überläuft

4. **Task wieder öffnen**
   - Je Zeile führt der Icon-Button **„Wieder öffnen"** die Aktion aus: Status wechselt auf „Open", Daten laden neu
   - Während der Ausführung ist der Button deaktiviert; ein Fehler erscheint als Meldung über der Tabelle

### Erwartetes Ergebnis

- Erledigt-Tabelle ist eine zugängliche Tabelle (Screenreader-Label „Liste der erledigten Aufgaben")
- Punkte je Säule = anteiliger Wertbeitrag des erledigten Tasks (Punkte-Spalten schmal, Titel dominiert)
- Frisch per Toggle erledigte Aufgaben, die noch im Aufgabenwald sichtbar sind, erscheinen nicht doppelt in der Erledigt-Tabelle
- Ohne erledigte Aufgaben erscheint der Hinweis „Noch keine erledigten Aufgaben vorhanden."

### Randfälle & Fehler

| Situation                    | Erwartetes Verhalten                                              |
| ---------------------------- | ----------------------------------------------------------------- |
| Keine erledigten Aufgaben    | Hinweis: „Noch keine erledigten Aufgaben vorhanden."              |
| „Wieder öffnen" schlägt fehl | Fehlermeldung über der Tabelle (role="alert"), Button reaktiviert |
| Sehr langer Säulenname       | Header auf ≤ 20 Zeichen gekürzt („…" am Ende)                     |
