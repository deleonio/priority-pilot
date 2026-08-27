# Spec #1067 — Fokus in Suchfeld nach dem Schließen des Suchdialogs

## Ziel

Nach dem Auslösen der Suche im SearchModal (Enter oder Button „Suche starten") wechselt die App
auf den Aufgaben-Tab und filtert die Liste. Damit der Nutzer sofort weitertippen kann, liegt der
Tastaturfokus anschließend im Filterfeld (`KolInputText.task-filter-search__field`,
„Nach Titel filtern", `App.tsx:542`) — programmatisch gesetzt, ohne dass der Nutzer klickt.
Schließen OHNE Suche (Escape, „Abbrechen", Backdrop) ändert sein Verhalten nicht: Der Fokus
kehrt zum Auslöser (Toolbar-Button „Suche") zurück.

## Preconditions

- Der Toolbar-Button „Suche" öffnet das SearchModal; die Suche wechselt auf den Aufgaben-Tab,
  setzt `searchDraft` und wendet den Filter an (`App.tsx:638-646`).
- Das Filterfeld im Aufgaben-Tab ist unkonditional gerendert (`App.tsx:527`, slot `tab-1`) und
  existiert damit immer im DOM — auch bei aktivem anderem Tab.
- Der `Modal`-Cleanup gibt beim Unmount den Fokus per `setTimeout(0)` an den Auslöser zurück
  (`Modal.tsx:136-145`) — der neue Filterfeld-Fokus muss NACH dieser Rückgabe greifen
  (Retrying-Assertion über `toBeFocused` mit Timeout).

## Verhalten (Akzeptanzkriterien)

### AK1 — Fokus im Filterfeld nach ausgelöster Suche

Nach dem Auslösen der Suche im SearchModal (Enter-Taste ODER Button „Suche starten") mit
mindestens einem Zeichen liegt der Fokus im Filterfeld `task-filter-search__field` des
Aufgaben-Tabs; der Aufgaben-Tab ist aktiv und die Liste ist nach dem Suchbegriff gefiltert.

### AK2 — Weitertippen direkt nach dem Wechsel

Eine Tastatureingabe unmittelbar nach dem Wechsel (ohne Mausklick/Tab dazwischen) landet im
Filterfeld: Das Zeichen erscheint im Feld, und die Filterung reagiert auf den ergänzten Begriff
(nach Enter/„Filtern" im deferred-Filter-Modell, `App.tsx:84-90`).

### AK3 — Mobile 375px

AK1 gilt auch bei 375px Viewport (mobile-first).

### AK4 — Schließen ohne Suche unverändert

Beim Schließen des SearchModal ohne Suche (Escape, „Abbrechen") bleibt das bisherige Verhalten
erhalten: Der Fokus kehrt zum Auslöser zurück und liegt NICHT im Filterfeld.

## Abgrenzung / Nicht-Ziele

- Kein Umbau des deferred-Filters: Tippen allein setzt weiterhin nur `searchDraft`; der Filter
  wird erst per Enter/„Filtern" übernommen.
- Schließen ohne Suche (AK4) bekommt kein neues Verhalten — reine Regressionssicherung.
- Keine Änderung an `Modal.tsx`-Fokus-Rückgabe an sich.

## Tests (rot, aus dieser Spec abgeleitet)

| Testdatei                                       | AK       | prüft                                                                                                                        |
| ----------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `frontend/e2e/search-modal.spec.ts` (erweitert) | AK1      | Suche per „Suche starten" → Modal zu, Aufgaben-Tab aktiv, Liste gefiltert, Filterfeld `toBeFocused()` (shadow-durchdringend) |
| `frontend/e2e/search-modal.spec.ts` (erweitert) | AK1, AK2 | Suche per Enter → Filterfeld fokussiert; Weitertippen ohne Klick ergänzt den Begriff im Feld, Enter verengt die Liste        |
| `frontend/e2e/search-modal.spec.ts` (erweitert) | AK3      | AK1 bei 375px Viewport                                                                                                       |
| `frontend/e2e/search-modal.spec.ts` (erweitert) | AK4      | Escape bzw. „Abbrechen" → Fokus auf Toolbar-Such-Button, nicht im Filterfeld                                                 |

Kein Duplikat: Die bestehenden Tests der Spec prüfen Tab-Wechsel, Filterung und Feldwert
(`toHaveValue`), aber nirgends den Fokus nach dem Schließen.
