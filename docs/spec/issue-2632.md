# Spec #2632 — Streak-Refresh nach dem Erledigen

**Stand:** 2026-10-15
**Ziel:** Nach dem Erledigen einer Aufgabe über den gemeinsamen Trichter (`TASKS_CHANGED_EVENT`, #2522) lädt die Streak-Card auf dem Dashboard ohne Seitenreload neu; Inline-Erfolg und Karte bilden Streak 1 in der Einzahl und Streak 2 in der Mehrzahl (de und en).

## Vorbedingung

- Nutzer ist angemeldet, Dashboard geöffnet, Streak-Card (`data-testid="streak-card"`) sichtbar.
- Mind. eine offene Aufgabe vorhanden; heute ist noch nichts erledigt (Streak aktuell = 0, Zustandstext `streak-zero`).

## Schritte

1. Aufgabe im Signal-Panel „Nächste Aufgabe" per „Erledigen" abschließen (Direkt-Erledigen, ADR 0024; der Trichter feuert `notifyTasksChanged`, `App.tsx`).
2. Inline-Erfolg erscheint an der Tipp-Stelle (aria-live-Region, Muster #2526) mit der Streak-Rückmeldung.
3. Die Streak-Card aktualisiert sich ohne Nutzerinteraktion und ohne Seitenreload.

## Erwartetes Ergebnis

- **AK1:** `StreakCard` hört auf `TASKS_CHANGED_EVENT` (Muster `CareHint.tsx:99-107`), ruft `GET /scores/streak` erneut auf und zeigt den neuen Stand — nach dem ersten Erledigen „1 Tag" bzw. „1 day" statt des Streak-gerissen-Zustands.
- **AK2:** Der Inline-Erfolg (`nextTask.streakDays`, `Dashboard.tsx`) pluralisiert über i18next `count`: Locale-Schlüssel `streakDays_one`/`streakDays_other` (Muster `days_one`/`days_other`, `dashboard.json`) mit de „Streak {{count}} Tag"/„Streak {{count}} Tage" und en „Streak {{count}} day"/„Streak {{count}} days" — Streak 1 in der Einzahl, Streak 2 in der Mehrzahl, auf Deutsch und Englisch.
- **AK3:** Das Nachladen verursacht keinen Layout-Sprung: bis zur neuen Antwort bleibt der bisherige Karteninhalt stehen (kein `streak.loading`-Zustand beim Re-Load — Muster `CareHint`, Layout-Sprung-Verbot #2625).
- **AK4:** AK1–AK2 gelten auch bei 375×812 Viewport ohne horizontales Verschieben der Karte (Bounding-Box + `scrollWidth`, Muster AK6 in `issue-1360-streak.spec.ts`).
