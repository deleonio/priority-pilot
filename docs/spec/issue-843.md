# Settings Screen Layout – Priority Pilot

**Stand:** 2026-08-17  
**Ziel:** Konsistentes Layout im Settings Screen mit einheitlichen Spacing-Werten, korrektem Alignment und lesbarer Typografie

Diese Spezifikation beschreibt das beobachtbare Layout-Verhalten des Settings Screen. Sie ist implementierungsagnostisch und fokussiert auf visuelle Konsistenz.

---

## Ziel

Settings Screen verwendet einheitliche Layout-Werte für Abstände, Alignment und Typografie, um ein konsistentes, lesbares Erscheinungsbild zu gewährleisten.

### Vorbedingung

- Nutzer ist angemeldet
- Settings Screen ist geöffnet (Tab "Settings" oder Menüpunkt "Einstellungen")

### Schritte

1. **Settings Screen öffnen**
   - Klick auf **„Settings"** oder **„Einstellungen"** in der Navigation
   - Settings Screen erscheint mit verfügbaren Einstellungsbereichen

2. **Layout-Inspektion: Spacing**
   - Vertikale Abstände zwischen Sections (z.B. Theme-Auswahl zu Sprachaufnahme) messen: **16dp**
   - Vertikale Abstände zwischen Elementen innerhalb einer Section messen: **12dp**
   - Linker Margin aller Controls (Radio-Buttons, Toggles, Button) prüfen: **24dp**

3. **Layout-Inspektion: Alignment**
   - Alle Controls (Radio-Buttons, Checkbox-Toggles, Button) starten an derselben linken Position: **24dp**
   - Controls sind vertikal gestapelt, keine horizontale Anordnung

4. **Typografie-Inspektion**
   - Deskriptiver Text (z.B. Beschreibungen zu Einstellungen) hat Schriftgröße ≥ **16sp**
   - Farbe des deskriptiven Textes ist **#616161** (besserer Kontrast als bisher #757575)

5. **Icon-Inspektion**
   - Checkmark-Icons (z.B. für aktivierte Einstellungen) haben Größe **20×20dp**
   - Icons haben **8dp Padding** um das Icon herum

### Erwartetes Ergebnis

- Settings Screen verwendet konsistente Spacing-Werte (24dp linker Margin, 16dp Section-Abstand, 12dp Element-Abstand)
- Alle Controls sind auf 24dp linker Margin aligned
- Deskriptiver Text ist lesbar (≥16sp, Farbe #616161)
- Checkmark-Icons haben ausreichende Größe (20×20dp) mit Padding (8dp)

---

## Randfälle & Fehler

| Situation                | Erwartetes Verhalten                                                             |
| ------------------------ | -------------------------------------------------------------------------------- |
| Settings Screen leer     | Hinweis: „Keine Einstellungen verfügbar."                                        |
| Control ohne Label       | Label ist erforderlich, Controls ohne Label werden nicht gerendert               |
| Deskriptiver Text fehlt  | Optional – wenn vorhanden, muss er ≥16sp und #616161 sein                        |
| Icon-Größe nicht 20×20dp | Icon sollte 20×20dp sein, Abweichungen führen zu inkonsistentem Erscheinungsbild |

---

## Hinweise zur Nutzung

- **Format:** Diese Spezifikation verwendet ein informelles „Given/When/Then"-Format
- **Implementierung:** Diese Spec ist implementierungsagnostisch – sie beschreibt beobachtbares Layout-Verhalten, nicht CSS-Details
- **Test-Strategie:** Aus dieser Spec werden E2E-Tests abgeleitet, die:
  - **visuell** sind (Screenshot-Vergleich, Layout-Messung)
  - **konsistenzorientiert** sind (einheitliche Werte prüfen)
  - **zugänglich** sind (Kontrast, Lesbarkeit prüfen)
- **Änderungen:** Bei Layout-Änderungen muss diese Spec aktualisiert werden

---

## Versionierung

- **v1.0** (2026-08-17): Initialefassung für Issue #843. Layout-Spezifikation für Settings Screen erstellt.
