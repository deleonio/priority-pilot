# Spec #2307 — Widerrufsbelehrung und Zustimmung vor dem Erstkauf

## Ziel

Vor dem PayPal-Redirect sieht der Kunde die Widerrufsbelehrung, stimmt dem sofortigen Leistungsbeginn zu und bestellt über einen Knopf „Zahlungspflichtig bestellen" (§ 312j Abs. 3 BGB).

## Regeln

1. **Knopf (AK1):** Der Erstkauf-Knopf (`book-<plan>-<period>`, nur `paid === null`) trägt den i18n-Text „Zahlungspflichtig bestellen" in allen 10 Sprachen; Paket und Laufzeit stehen nicht im sichtbaren Text.
2. **Gate (AK2):** Eine gemeinsame, nicht vorbelegte Checkbox im Hinweisbereich (`notice`) über der Paketliste schaltet alle Buchen-Knöpfe frei. Ohne Haken: Knopf deaktiviert, kein `POST /billing/subscriptions`. Mit Haken: Ablauf unverändert.
3. **Belehrung (AK3):** Vor dem Knopf stehen Hinweis auf das 14-tägige Widerrufsrecht mit Link `/widerruf/` (im Hinweistext, nicht im Checkbox-Label) und der Checkbox-Text; alle Texte über i18n.
4. **Website (AK4):** `/widerruf/` (nur Deutsch) enthält Widerrufsbelehrung und Muster-Widerrufsformular; der Footer jeder Sprachseite verlinkt sie (`footer.withdrawal`).
5. **Mobil (AK5):** Bei 375 px liegen Link, Checkbox und Knopf innerhalb des Viewports.
6. **Unverändert (AK6):** „Weiterführen" und „Wechseln" ohne Checkbox, bisherige Labels.
7. AK7 (Textfreigabe) ist manuell, kein Test.

## Test-Pflege

`PlansSection.test.tsx` (Knopfname `Pro buchen (monatlich)`) und `billing.spec.ts` AK1 (Klick ohne Checkbox) widersprachen Regel 1/2; angepasst. `i18n-mdr-wording.test.ts` um das Text-Modul der Widerrufsseite erweitern: Aufgabe der Umsetzung (Import existiert vorab nicht).
