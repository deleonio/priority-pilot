# Settings Screen Layout – Priority Pilot

**Stand:** 2026-08-28
**Ziel:** Konsistentes Layout im Settings Screen mit einheitlichen Spacing-Werten, korrektem Alignment und lesbarer Typografie

Diese Spezifikation beschreibt das beobachtbare Layout-Verhalten des Settings Screen. Sie ist implementierungsagnostisch und fokussiert auf visuelle Konsistenz.

---

## Ziel

Settings Screen verwendet einheitliche Layout-Werte für Abstände, Alignment und Typografie, um ein konsistentes, lesbares Erscheinungsbild zu gewährleisten.

### Vorbedingung

- Nutzer ist angemeldet
- Settings Screen ist geöffnet (Tab "Settings" oder Menüpunkt "Einstellungen")

### Schritte

1. **Settings Screen öffnen** - Klick auf **„Settings"** oder **„Einstellungen"** in der Navigation - Settings Screen erscheint mit verfügbaren Einstellungsbereichen (Tabs „Allgemein", „Säulen", „KI-Provider")

2. **Layout-Inspektion: Spacing (Tab „Allgemein"/„KI-Provider")** - Vertikale Abstände zwischen den Bedienelementen eines Tabs (z.B. Darstellung, Sprachaufnahme, Standort erfassen) messen: **16dp** - Innerhalb einer Schalter-Zeile (Schalter + zugehöriger Hinweis/Alert) beträgt der Abstand **8dp** unterhalb 768px Breite bzw. **16dp** ab 768px Breite

3. **Layout-Inspektion: Alignment** - Im Tab „Allgemein" starten alle Controls (Schalter, Buttons, Radio-Gruppe „Darstellung") an derselben linken Position: **24dp** vom Container-Rand - Im Tab „KI-Provider" gilt dieses 24dp-Alignment nicht; dort bestimmt nur das allgemeine Seiten-Padding die linke Position - Controls sind je Tab vertikal gestapelt; ab 768px Breite ordnen sich Schalter und zugehöriger Hinweis/Alert innerhalb einer Zeile nebeneinander an, ebenso die Optionen der Radio-Gruppe „KI-Provider"

4. **Typografie-Inspektion** - Deskriptiver Statustext (z.B. Lade-/Fehlermeldungen im Tab „KI-Provider") hat Schriftgröße **14px** (0,875rem) - Farbe des deskriptiven Textes ist **#616161**

### Erwartetes Ergebnis

- Settings Screen verwendet konsistente Spacing-Werte innerhalb eines Tabs (16dp Abstand zwischen den Bedienelementen; 24dp linker Startpunkt im Tab „Allgemein")
- Controls im Tab „Allgemein" sind horizontal aligned (gleiche X-Position, 24dp vom Container-Rand); im Tab „KI-Provider" gilt dieses Alignment nicht
- Deskriptiver Statustext ist lesbar (14px, Farbe #616161)

---

## Randfälle & Fehler

| Situation               | Erwartetes Verhalten                          |
| ----------------------- | ---------------------------------------------- |
| Deskriptiver Text fehlt | Optional – wenn vorhanden, 14px und Farbe #616161 |
