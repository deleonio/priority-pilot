# #2771 — Checklisten-Eintrag per Enter-Taste anlegen

## Ziel

Im TaskForm legt **Enter** im Checklisten-Eingabefeld denselben Eintrag an wie der
„Hinzufügen“-Button — ohne zweite Anlege-Logik: Enter ruft exakt `addChecklistItem()`
(TaskForm.tsx) auf und erbt damit Leertitel-Guard und `CHECKLIST_LIMIT` (50).

## Voraussetzungen

- Task- oder Serie-Modus des TaskForm geöffnet, „Optional“-Akkordeon aufgeklappt.
- Checklisten-Eingabefeld (Label „Checklisten-Eintrag“, `type="search"`) im
  `data-testid="checklist-section"`-Block.

## Ablauf / erwartetes Ergebnis

| #   | Schritt                                        | Erwartet                                                                                                        |
| --- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| AK1 | Text eingeben, **Enter** drücken (Anzahl < 50) | Eintrag erscheint (`checklist-item`), Feld wird geleert, Fokus bleibt im Eingabefeld (`document.activeElement`) |
| AK2 | Leeres Feld, **Enter**                         | Kein Eintrag; Liste unverändert                                                                                 |
| AK3 | 50 Einträge vorhanden, **Enter**               | Feld deaktiviert (`disabled`), kein 51. Eintrag, Limit-Hinweis sichtbar                                         |
| AK4 | 2 Einträge per Enter anlegen, dann speichern   | Beide Titel im gespeicherten Task- **und** Series-Payload; Button-Pfad unverändert                              |
| AK5 | 375 px Viewport, Anlegen per Enter             | Feld + Liste sichtbar und bedienbar, kein horizontaler Scroll (Bounding-Box)                                    |

## Randbedingungen

- Der „Hinzufügen“-Button behält sein Verhalten (kein Doppelanlegen bei Enter+Klick).
- Kein eigener Enter-Pfad neben `addChecklistItem()` — Muster: `_on.onKeyDown` mit
  `event.key === 'Enter'` wie in `App.tsx` (Task-Filter).

## Abdeckung

- TF1 (AK1, AK2): Vitest, `frontend/src/components/TaskForm.test.tsx` — keyDown-Events am
  Checklisten-Input; Fokus via `document.activeElement`.
- TF2 (AK3): Vitest, dito — 50 Einträge via `initialValues.checklist`, `disabled`-Attribut +
  Limit-Hinweis + kein 51. Eintrag.
- TF3 (AK4): E2E `frontend/e2e/issue-2771-checklist-enter.spec.ts` — Task- und Serie-Modus,
  Payload-Prüfung über API (Muster `series-checklist.spec.ts`).
- TF4 (AK5): E2E, 375 px — Enter-Anlegen + Bounding-Box-Check (kein `scrollWidth`, App-Shell
  clippt overflow).
