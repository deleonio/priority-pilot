# Spec: Issue 2110 — readChecked zentralisieren, Beispiel-Gruppe benennen, Fokus-Wiedereinstieg

## Ziel

Drei Review-Befunde (#2110): (1) `readChecked` ist identisch doppelt definiert, (2) die
Beispielaufgaben-Gruppe im `EmptyState` ist für Screenreader ein unbenanntes `div`, (3) der
Fokus-Wiedereinstieg nach „Flow fortsetzen“ setzt den Fokus nicht auf die Schritt-Überschrift.

## AK1 — Eine `readChecked`-Definition

- **Vorabzustand:** `readChecked` existiert identisch in `frontend/src/components/EmptyState.tsx`
  (Zeilen 19–26) und `frontend/src/components/OnboardingFlow.tsx` (Zeilen 25–32).
- **Schritte:** `grep -rn "readChecked" frontend/src` nach der Umsetzung ausführen.
- **Erwartung:** Genau eine Definitionsstelle in `frontend/src/lib/inputValue.ts` (dritter Export
  neben `readString`/`readNumber`, JSDoc analog `readString`); alle weiteren Treffer sind Importe.
  Checkbox-Verhalten unverändert (bestehende Unit-Tests bleiben grün).
- **Prüfung:** grep-Beleg in der PR-Beschreibung (kein automatisierter Test — Konfigurations-/Refactoring-
  Prüfung ohne auswertbares Verhalten).

## AK2 — Benannte Beispiel-Gruppe im EmptyState

- **Vorabzustand:** Der Container `.onboarding-cards` im `EmptyState` ist ein unbenanntes `div`.
- **Schritte:** EmptyState rendern (ohne `onReenter`).
- **Erwartung:** Der Container trägt `role="group"` mit dem zugreifbaren Namen
  `t('onboarding.beispiele')` („Beispiele zum Ausprobieren“) und enthält genau die drei
  Beispielaufgaben-Checkboxen (`EXAMPLE_TASKS`). Nur diese Gruppe — die `.onboarding-cards`-Container
  im `OnboardingFlow` bleiben außerhalb des Scopes. Der einleitende `<p>` bleibt stehen.
- **Test:** `frontend/src/components/EmptyState.test.tsx` — `getByRole('group', { name: 'Beispiele
zum Ausprobieren' })` mit genau 3 `kol-input-checkbox` darin.

## AK3 — Fokus-Wiedereinstieg ohne Datenverlust

- **Vorabzustand:** `App.tsx` hält den Flow verdeckt gemountet (`hidden={onboardingDismissed}`);
  `onReenter` setzt nur `onboardingDismissed=false`, `step` ändert sich nicht → der Fokus-`useEffect`
  (Deps `[step, finished]`) feuert nicht.
- **Schritte:** Erststart-Flow starten, Freitext eingeben, per „Später“ abbrechen (EmptyState
  erscheint), „Flow fortsetzen“ klicken.
- **Erwartung:** Die Schritt-Überschrift (`h2.onboarding-heading`) trägt den Fokus (`toBeFocused`);
  der Flow-Zustand ist erhalten — der vor dem Abbruch eingegebene Freitext steht noch im Feld.
  Kein Remount des Flows (sonst gingen Freitext/Auswahl verloren, #2070 AK4). Lösungsmuster:
  Sichtbarkeit (z. B. Prop `active`) in die Effekt-Deps aufnehmen.
- **Test:** `frontend/e2e/onboarding-flow.spec.ts` — neuer Test im #2070-Block nach dem AK4-Test.

## Test-Pflege

Keine konfliktierenden Bestands-Tests identifiziert; bestehende `EmptyState.test.tsx`,
`OnboardingFlow.test.tsx` und `onboarding-flow.spec.ts` bleiben unverändert grün (Randbedingung).
