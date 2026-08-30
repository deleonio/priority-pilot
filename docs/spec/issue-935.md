# Spec #935 — Säulen-Formular: Beschreibung als Textarea, Name auf 30 Zeichen begrenzt

**Stand:** 2026-08-30

## Journey: Säule anlegen oder bearbeiten

### Ziel

Im Säulen-Formular wird die Beschreibung mehrzeilig erfasst und der Name ist konsistent zu Aufgaben und Serienaufgaben auf 30 Zeichen begrenzt.

### Vorbedingung

- Nutzer ist angemeldet
- Einstellungen → Tab „Säulen" geöffnet
- Für „Bearbeiten": mindestens eine Säule existiert

### Schritte

1. **Formular öffnen**
   - Anlegen über die Säulenliste oder Bearbeiten über eine bestehende Säule
   - Der Dialog zeigt das Namensfeld als einzeiliges Eingabefeld und das Feld „Beschreibung" als mehrzeiliges Textfeld

2. **Mehrzeilige Beschreibung erfassen**
   - Beschreibung mit Zeilenumbruch eingeben und speichern
   - Nach dem Neuladen steht im Bearbeiten-Dialog dieselbe Beschreibung zeilengenau im Textfeld

3. **Name erfassen**
   - Das Namensfeld akzeptiert maximal 30 Zeichen; längere Eingaben werden direkt gekappt (`_maxLength` des Eingabefelds)

### Erwartetes Ergebnis

- Beschreibung bleibt mit ihren Zeilenumbrüchen persistent gespeichert
- Name ist auf 30 Zeichen begrenzt; derselbe Grenzwert gilt wie für Aufgaben- und Serientitel
- Anlegen, Bearbeiten und Abbrechen verhalten sich sonst unverändert; ein leerer Name zeigt den Hinweis „Name darf nicht leer sein." im Fehler-Alert
