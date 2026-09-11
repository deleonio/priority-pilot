# Settings KI deaktivierbar

**Stand:** 2026-09-11 (Feinschalter „Schnellerfassung aktiv" entfernt, siehe [issue-1335.md](issue-1335.md) AK4)

## Ziel

Im Settings-Tab „KI-Provider" gibt es einen einzigen, clientseitig persistierten Schalter: „KI-Features aktiv". Ist er aus, verschwindet der eine verbleibende Anlege-Einstieg „Neuen Task anlegen" in seiner KI-Ausprägung — der Button öffnet dann direkt das Task-Formular statt des verschmolzenen Dialogs (Details siehe [issue-1335.md](issue-1335.md)).

> Der frühere zweite Schalter „Schnellerfassung aktiv" (samt Accordion „Einzelne KI-Funktionen" und Storage-Key `pp-quick-capture-enabled`) ist mit #1335 ersatzlos entfernt — die Schnellerfassung ist kein eigenständig abschaltbares Feature mehr, sondern Teil des einen KI-Dialogs.

## Schalter

- Der Schalter steht im Tab „KI-Provider" als Switch-Zeile, **positiv** formuliert (Switch an = Funktion vorhanden).
- Persistenz rein clientseitig per `localStorage` (Key `pp-ai-enabled`), Best-Effort: fehlender, ungültiger oder nicht lesbarer Eintrag → Default (**an**).
- Änderungen wirken sofort (kein Speichern-Button) und überleben `page.reload()`.

## Verhalten

| Schalter          | Aus-Wirkung                                                                                                                                                                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| KI-Features aktiv | Toolbar-Button „Säulen-Berater" existiert nicht mehr (entfällt bereits mit #1335); Anlege- und Bearbeiten-Formular enthalten keinen „… lektorieren"-Button (beide nutzen dasselbe Formular); „Neuen Task anlegen" öffnet direkt das Task-Formular statt des verschmolzenen KI-Dialogs |

Server-Endpunkte bleiben erreichbar — die Deaktivierung ist reine UI-Ausblendung, keine API-Änderung.
