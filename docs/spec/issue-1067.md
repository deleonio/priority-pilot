# Fokus in Suchfeld nach dem Schließen des Suchdialogs

**Stand:** 2026-08-30

## Ziel

Nach dem Auslösen der Suche im SearchModal (Enter oder Button „Suche starten") wechselt die App auf den Aufgaben-Tab und filtert die Liste. Damit der Nutzer sofort weitertippen kann, liegt der Tastaturfokus anschließend im Filterfeld (`task-filter-search__field`, „Nach Titel filtern") — programmatisch gesetzt, ohne dass der Nutzer klickt. Schließen OHNE Suche (Escape, „Abbrechen") ändert sein Verhalten nicht: Der Fokus kehrt zum Auslöser (Toolbar-Button „Suche") zurück.

## Preconditions

- Der Toolbar-Button „Suche" öffnet das SearchModal; die Suche wechselt auf den Aufgaben-Tab und wendet den Filter an.
- Das Filterfeld im Aufgaben-Tab ist unkonditional gerendert und existiert damit immer im DOM — auch bei aktivem anderem Tab.
- Der `Modal`-Cleanup gibt beim Unmount den Fokus per `setTimeout(0)` an den Auslöser zurück — der Filterfeld-Fokus greift NACH dieser Rückgabe (Retrying-Assertion über `toBeFocused` mit Timeout).

## Verhalten

### Fokus im Filterfeld nach ausgelöster Suche

Nach dem Auslösen der Suche (Enter-Taste ODER Button „Suche starten") mit mindestens einem Zeichen liegt der Fokus im Filterfeld des Aufgaben-Tabs; der Aufgaben-Tab ist aktiv und die Liste ist nach dem Suchbegriff gefiltert.

### Weitertippen direkt nach dem Wechsel

Eine Tastatureingabe unmittelbar nach dem Wechsel (ohne Mausklick/Tab dazwischen) landet im Filterfeld: Das Zeichen erscheint im Feld, und die Filterung reagiert auf den ergänzten Begriff (nach Enter/„Filtern" im deferred-Filter-Modell).

### Mobile 375px

Dieses Verhalten gilt auch bei 375px Viewport (mobile-first).

### Schließen ohne Suche

Beim Schließen des SearchModal ohne Suche (Escape, „Abbrechen") kehrt der Fokus zum Auslöser zurück und liegt NICHT im Filterfeld.

## Abgrenzung

- Kein Umbau des deferred-Filters: Tippen allein setzt weiterhin nur den Entwurf; der Filter wird erst per Enter/„Filtern" übernommen.
