# Spec — #2415: Schalter und Dialogtitel nennen Serie und Vorlage

## Ziel

Der Anlege-Dialog des TaskForm benennt den Aufgabe/Serie-Umschalter und den
Serien-Anlege-Titel stimmig als „Serie oder Vorlage" (ADR 0020 Punkt 5: der
Website-Begriff „Projekt-Vorlage" wird nicht verwendet). Reine Textänderung an
zwei Quellstellen — kein Layout, keine neue Aktion.

## Voraussetzungen

- Anlege-Modus des TaskForm (über „Neuen Task anlegen" bzw. Schnellerfassung).
- `taskFormModalTitle` (`frontend/src/lib/task.ts:37-43`) liefert die Dialogtitel
  für `TaskFormModal` und `QuickCaptureModal`.
- Der Umschalter ist der `KolInputCheckbox` (`_variant="switch"`) im
  `mode-switch`-Wrapper (`frontend/src/components/TaskForm.tsx:1245-1262`).

## Schritte

1. Anlege-Dialog öffnen → Schalter im `mode-switch`-Wrapper betrachten (AK1).
2. Schalter auf Serie umschalten → Dialogtitel wechselt (AK2); zurückschalten
   → „Aufgabe anlegen".
3. Anlege-Dialog bei 375 px Viewport öffnen und umschalten (AK3).

## Erwartetes Ergebnis

- **AK1:** Der Umschalter trägt das Label „Serie oder Vorlage". Im Bearbeiten-Modus
  bleibt er wie bisher komplett ausgeblendet (durch bestehende #316-Tests gesichert,
  unverändert).
- **AK2:** `taskFormModalTitle(null, null, 'series')` liefert „Serie oder Vorlage anlegen".
  Unverändert bleiben: „Aufgabe anlegen" (Task-Modus), „Serie bearbeiten: \<title\>",
  „Aufgabe bearbeiten: \<title\>", „Unteraufgabe zu …", Fallback „Neuen Task anlegen".
- **AK3:** Bei 375 px bricht die längere Beschriftung nicht unschön: kein horizontaler
  Overflow des Dialogs, Label nicht abgeschnitten (natürlicher Mehrzeilenumbruch ist ok).
- **AK4:** `docs/user-guide.md` (Hinweis „Aufgabe oder Serie?", ca. Z. 309, und Abschnitt
  Serien, ca. Z. 494) nennt die neue Beschriftung; „Projekt-Vorlage" kommt darin nicht vor.

## Tests (Vertrag)

| AK  | Test                                                                                | Rot-Grund                                                              |
| --- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| AK1 | `frontend/src/components/TaskForm.test.tsx` — zugänglicher Name des Switch          | Mock rendert `_label` als `aria-label`: „Serie" ≠ „Serie oder Vorlage" |
| AK2 | `frontend/src/lib/task.test.ts` — Titel-Vertrag Serie-Anlegen                       | Assertion: „Serie anlegen" ≠ „Serie oder Vorlage anlegen"              |
| AK2 | `frontend/e2e/series-in-taskform.spec.ts` — Heading nach Umschalten                 | Heading „Serie oder Vorlage anlegen" existiert noch nicht              |
| AK2 | `frontend/e2e/keyboard-shortcuts.spec.ts` — Heading verschwindet nach Shortcut-Save | Heading „Serie oder Vorlage anlegen" existiert noch nicht              |

## Bewusst ohne eigenen Test

- **AK3 (Layout):** Ein eigener Test wäre mit dem alten Kurzlabel „Serie" bereits grün —
  kein Rot-Zustand phrasierbar, kein Biss. Die bestehende AK7-e2e
  (`series-in-taskform.spec.ts`, 375 px, Serie-Dialog ohne horizontales Scrollen) deckt
  denselben Dialog ab und bleibt nach der Umsetzung grün; Feinschliff des Umbruchs wird
  visuell im Review verifiziert.
- **AK4 (Doku):** Markdown ist kein Anwendungscode (ADR 0001) — Verifikation im Review.
