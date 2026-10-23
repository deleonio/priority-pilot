# Spec #2636 — Umbenenn-Feld der Serien-Checkliste: festes Positions-Label

## Ziel

Im Serie-Modus des Checklisten-Editors (`TaskForm.tsx`, `checklist.map` → `isSeriesMode`) trägt
das Umbenenn-Feld jedes Checkpunkts einen festen, positionsgebundenen zugänglichen Namen
(„Checkpunkt 1", „Checkpunkt 2", …) statt des Titels. Beim Tippen bleibt der zugängliche Name
stabil; der Titel ist allein über den Feldwert lesbar. Der unsichtbare `aria-hidden`-Textspiegel
entfällt.

## Ist-Zustand (TaskForm.tsx:2049-2064)

- `<span className="visually-hidden" aria-hidden="true">{item.title}</span>` spiegelt den Titel
  als Textknoten (nur fürs Unit-Testing gedacht, für Screenreader irrelevant).
- `KolInputText _label={item.title}` — der zugängliche Name ist der Titel selbst und ändert sich
  bei jeder Eingabe mit (Screenreader-Ansage kippt mitten im Tippen, #2636-Bericht).

## Soll-Verhalten

- **AK1:** `_label` kommt aus einem neuen i18n-Schlüssel (Vorschlag `checklistCheckpointLabel`;
  de „Checkpunkt {{index}}", en analog; `{{index}}` = 1-basierte Position). Umsortieren
  verschiebt die Nummer mit: an Position 1 steht immer „Checkpunkt 1", unabhängig davon,
  welcher Eintrag dorthin gerutscht ist.
- **AK2:** Der `aria-hidden`-Textspiegel ist aus dem Serie-Modus-Zweig entfernt; der
  Mock-Kontrakt-Kommentar (TaskForm.tsx:2049-2052) ist angepasst. Der Titel existiert nur noch
  als Feldwert, nicht als DOM-Textknoten.
- **AK3:** Die #2501-Unit-Tests (Describe „Checkliste an der Serie (#2501)") lesen den Titel
  über das Feld selbst (`getByLabelText('Checkpunkt N')` + `.value`/`toHaveValue`), nicht mehr
  über `getByText`-Spiegel-Assertions.
- **AK4:** Der zugängliche Name bleibt beim Tippen gleich: eine Eingabe ins Feld ändert das
  Label nicht („Checkpunkt N" bleibt), der neue Wert steht im Feld.

## Testfälle (rote Tests, `frontend/src/components/TaskForm.test.tsx`)

1. **AK1 Initial + AK3-Migration** (bestehender erster #2501-Test, Zeilen 3956-3957): statt
   `getByText('Schritt A')` → `getByLabelText('Checkpunkt 1')` hat Wert „Schritt A",
   `getByLabelText('Checkpunkt 2')` hat Wert „Schritt B".
2. **AK1 Umsortieren** (neu): „Nach oben verschieben" auf Eintrag 2 → danach hat
   `getByLabelText('Checkpunkt 1')` den Wert „Schritt B" und `getByLabelText('Checkpunkt 2')`
   den Wert „Schritt A".
3. **AK2 Spiegel weg** (neu): `queryByText('Schritt A')`/`queryByText('Schritt B')` finden
   keinen Textknoten — der Titel lebt nur im Feldwert.
4. **AK4 Labelstabilität** (neu): `fireEvent.input` mit „Neuer Schritt" in das Feld
   „Checkpunkt 1" → `getByLabelText('Checkpunkt 1')` resolviert weiterhin (Label unverändert),
   `getByLabelText('Neuer Schritt')` findet nichts, und das Feld hält den neuen Wert.

## Grenzen

- Task-Modus (KolInputCheckbox + `.checklist-item-title`) und Anlege-Feld
  („Checklisten-Eintrag") bleiben unberührt — keine Tests dafür.
- e2e `frontend/e2e/series-checklist.spec.ts` liest das Umbenenn-Feld über
  `getByRole('textbox')` ohne Namen (Zeilen 86, 91, 133) → von der Label-Änderung unberührt;
  Regression läuft im kanonischen Gate, kein neuer Test.
- i18n nur de+en befüllen (weitere taskForm-Locales existieren nicht). Der i18n-Schlüssel und
  die Spiegel-Entfernung sind Umsetzungsarbeit (Phase 4) — die Tests sind bis dahin rot.
