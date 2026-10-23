# Spec: Issue 2522 — Frontend: Fürsorge-Hinweis nach dem Erledigen aktuell

**Stand:** 2026-10-13 (Spec-Phase)
**Quellen:** Harness-Kommentar (KI-ANALYSE stand=2026-10-13T11:33:35Z, kein KI-UX-Block — ux=nein), `frontend/src/lib/tasksChanged.ts`, `docs/spec/issue-1793.md`.

## Ziel

Erledigt man auf dem Dashboard eine Aufgabe, zeigt der Fürsorge-Hinweis ohne Seiten-Reload denselben Stand wie ein unmittelbar folgender Reload — die erledigte Aufgabe erscheint nicht mehr als Vorschlag.

## Vertrag (Testsaum)

- `CareHint` abonniert `TASKS_CHANGED_EVENT` (`frontend/src/lib/tasksChanged.ts`) und lädt bei dem Event `getCareSuggestions` (und `listPillars`) wie beim Mount neu — Muster `NearbyCard.tsx:63-69` (Refresh-Key), Listener nur für die Lebensdauer der Komponente.
- Bis zur Antwort bleibt der bisherige Hinweis stehen (kein `undefined`-Zwischenstand, „Nächste Aufgabe" springt nicht — #1793-Vertrag).
- Der Refetch ersetzt nur `vorschlaege`/`saeulen`; localStorage-Sperren (Nachrueck-Cursor `pp-care-hint-nachrueck`, abgelehnte Aufgaben, KI-Snooze) und die `ausgeblendet`/`leerzustand`-Semantik aus #1793/#1977 bleiben unberührt.
- Die App feuert `notifyTasksChanged()` nach dem erfolgreichen Erledigen — einmal am Ende von `completeTask` (gemeinsamer Trichter für CompleteTaskDialog und Signal-Panel „Erledigt"); der Zusatzaufruf von `refreshKeepingDialog` ist idempotent.
- Server `GET /scores/care-suggestions` bleibt unverändert — er liefert nach dem Erledigen dieselbe Liste wie nach einem Reload (das stellt AK2 ab).

## Schritte / erwartetes Ergebnis

| Schritt                                                        | Erwartung                                                                                                                |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `TASKS_CHANGED_EVENT`, Folgeantwort ohne den Vorschlag         | Hinweis nennt den erledigten Vorschlag ohne Seiten-Reload nicht mehr (AK1)                                               |
| `TASKS_CHANGED_EVENT`, leere Folgeantwort                      | Hinweis zeigt den Leerzustand — derselbe Stand wie nach einem Reload (AK2)                                               |
| `TASKS_CHANGED_EVENT` bei erledigter anderer Aufgabe           | identische Folgeantwort: Hinweistext bleibt während und nach der Antwort unverändert stehen (AK3)                        |
| Erledigen über „Nächste Aufgabe" (CompleteTaskDialog), 375×812 | ohne Reload nennt der Hinweis die Aufgabe nicht mehr; Hinweistext vor dem Reload = Hinweistext danach (AK1/AK2/AK4, E2E) |

## Nicht getestet

Das Feuern des Events aus `completeTask` als eigener Unit-Test — kein `App`-Test-Muster dieser Tiefe im Repo; das E2E deckt den echten UI-Pfad (Karte → CompleteTaskDialog → Trichter) ab. Visuelle Details: unverändert, von #1793/#2445 abgedeckt.
