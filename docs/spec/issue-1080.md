# Settings KI deaktivierbar

**Stand:** 2026-08-30

## Ziel

Im Settings-Tab „KI-Provider" gibt es zwei voneinander unabhängige, clientseitig persistierte Schalter: „KI-Features aktiv" (Hauptschalter) und „Schnellerfassung aktiv". Ist der Hauptschalter aus, verschwindet der Toolbar-Button „Säulen-Berater" und die Lektorat-Buttons aus dem Anlage- und Bearbeiten-Formular. Ist die Schnellerfassung aus, öffnet „Neuen Task anlegen" direkt das Task-Formular statt des Capture-Schritts.

## Schalter

- Beide Schalter stehen im Tab „KI-Provider" als Switch-Zeilen, **positiv** formuliert (Switch an = Funktion vorhanden), in der Reihenfolge Hauptschalter → Hinweis-Alert → Schnellerfassung-Option.
- Persistenz rein clientseitig per `localStorage` (Keys `pp-ai-enabled` und `pp-quick-capture-enabled`), Best-Effort: fehlender, ungültiger oder nicht lesbarer Eintrag → Default (**an**).
- Änderungen wirken sofort (kein Speichern-Button) und überleben `page.reload()`.

## Verhalten

| Schalter | Aus-Wirkung                                                                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| KI-Features aktiv | Toolbar-Button „Säulen-Berater" wird nicht gerendert; Anlege- und Bearbeiten-Formular enthalten keinen „… lektorieren"-Button (beide nutzen dasselbe Formular) |
| Schnellerfassung aktiv | „Neuen Task anlegen" öffnet direkt das Task-Formular (Feld „Titel") ohne Capture-Textarea „Beschreibe deinen Task"; ein Berater-Text wird weiterhin als Beschreibung vorbelegt |

Die beiden Schalter sind unabhängig wählbar (auch Schnellerfassung aus bei aktivem KI-Hauptschalter). Server-Endpunkte bleiben erreichbar — die Deaktivierung ist reine UI-Ausblendung, keine API-Änderung.
