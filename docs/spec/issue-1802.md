# Spec: Einstellungen — „Konto löschen“ weniger prominent platzieren (#1802)

## Ziel

Der „Konto löschen“-Auslöser ist beim normalen Durchsehen der Einstellungen nicht sichtbar. Er
wandert in ein zugeklapptes `KolAccordion` am Ende des Allgemein-Tabs (Muster `settings-accordion`,
Label-Empfehlung UX: „Konto und Daten“) und verliert die Danger-Variante. Der zweistufige
Bestätigungsdialog aus #1676 bleibt unverändert.

## Verhalten

1. Einstellungen öffnen (Any Tab, z. B. `/app/settings/general` oder `/app/settings/gruppen`):
   kein Button mit zugänglichem Namen „Konto löschen“ sichtbar — auch nicht nach Tab-Wechsel
   (AK1). Der Accordion-Toggle selbst trägt nicht den Namen „Konto löschen“.
2. Accordion „Konto und Daten“ am Ende des Allgemein-Tabs aufklappen: Der Button „Konto löschen“
   ist sichtbar; ein einzelner Klick öffnet den Bestätigungsdialog (Schritt „intent“: Buttons
   „Abbrechen“/„Löschen“, AK2).
3. Der Auslöser nutzt `_variant="secondary"` (nicht `danger`). Rot (`_variant="danger"`) erscheint
   ausschließlich an den Bestätigungs-Buttons im Dialog („Löschen“, „Endgültig löschen“, AK3).
4. Der zweistufige Dialog aus #1676 funktioniert unverändert: intent → scope → Endgültig löschen,
   409-Begründungen; bestehende Unit- und E2E-Tests bleiben nach Test-Pflege grün — die E2E öffnet
   vor dem Trigger-Klick das Accordion (AK4).
5. Bei 375px: AK1/AK2 gelten unverändert; der aufgeklappte Accordion-Bereich erzeugt keinen
   horizontalen Überlauf — geprüft als Bounding-Box (x ≥ 0, x + Breite ≤ 375), nicht via
   `scrollWidth` (App-Shell clippt `overflow-x: hidden`, AK5).

## Vorbedingung

Eingeloggter Nutzer (E2E: `/auth/test-login`), Einstellungen unter `/app/settings/general`.

## Abgedeckte Testfälle

- TF1 (E2E, `issue-1676-konto-loeschen.spec.ts`): AK1 — Auslöser in keinem Tab sichtbar.
- TF2 (E2E, dieselbe Spec): AK2 — nach `openAccordionSection(page, 'Konto und Daten')` sichtbar,
  Klick öffnet Dialog-Schritt „intent“.
- TF3 (Vitest, `DeleteAccount.test.tsx`): AK3 — Trigger ohne `danger`-Variante; Dialog-Buttons
  „Löschen“/„Endgültig löschen“ bleiben `danger`.
- TF4 (Test-Pflege): bestehende #1676-E2E öffnen das Accordion vor dem Trigger-Klick.
- TF5 (E2E, 375px): AK5 — Bounding-Box des aufgeklappten Accordions im Viewport.
