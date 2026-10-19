# Spec: Preis und Verlängerungshinweis im Bestell-Dialog (#2766)

## Ziel

Der Bestell-Dialog des PayPal-Kaufwegs zeigt vor dem Bestellknopf den Gesamtpreis des
gewählten Pakets und Zeitraums (aus `GET /plans`, kein USt-Ausweis gemäß § 19 UStG) sowie
einen Satz zu automatischer Verlängerung und Kündigung — beides im selben Blick wie der
Bestellknopf, in beiden App-Sprachen (de/en) und ohne horizontalen Überlauf bei 375 px.

## Voraussetzung

- Nutzer ist angemeldet, Plans-Katalog über `api.getPlansCatalog()` geladen; Pro/monatlich
  kostet im Katalog 899 Cent („8,99 €“ de / „€8.99“ en, `formatEuro`).
- Dialog wird über den Paket-Knopf (`book-pro-monthly`) geöffnet (Muster #2661).

## Schritte

1. Paket-Knopf „Bestellen“ (Pro/monatlich) klicken → Dialog öffnet sich.
2. Dialoginhalt lesen: Einleitung (`checkoutDialog.intro`), Preiszeile, Verlängerungssatz,
   Zustimmung, Bestellknopf.

## Erwartetes Ergebnis

- **Preiszeile** (Test-ID `checkout-price`): steht zwischen Intro und Bestellknopf, direkt
  oberhalb des Bestellknopfs; zeigt den Gesamtpreis des gewählten Pakets/Zeitraums aus
  `catalog.prices[targetPlan][targetPeriod]`, formatiert mit `formatEuro` (de: „8,99 €“,
  en: „€8.99“), inklusive Endpreis-Hinweis (§ 19 UStG — de-Schlüssel-Fragment „Endpreis“,
  en „final price“). Solange kein Preis geladen ist, erscheint kein Platzhalter/„0 €“.
- **Verlängerungssatz** (Test-ID `checkout-renewal`): Fließtext im selben Blick, oberhalb
  des Bestellknopfs, vor der Widerrufs-Zustimmung (Lesereihenfolge Intro → Preis →
  Verlängerung → Zustimmung → Knopf). Neue Textschlüssel unter `checkoutDialog.*` in
  `de/billing.json` und `en/billing.json`; de-Fragment „automatisch“, en-Fragment
  „automatically“.
- Beide Angaben bleiben im 375-px-Viewport innerhalb der Dialogbreite (Bounding-Box
  0 ≤ x, x+Breite ≤ 375; App-Shell clippt overflow-x).
- Keine zweite Preisquelle: Store-Preise und hartcodierte Centbeträge bleiben unberührt;
  Freigabe-Logik (Rechnungsadresse + Widerrufs-Checkbox) unverändert; `ChangeDialog`
  nicht Scope.

## Testfälle

- TF1 (E2E, `issue-2661-checkout-dialog.spec.ts`): Dialog nach `book-pro-monthly` zeigt
  „8,99 €“ (Pro/monthly aus dem Katalog-Mock) und den Endpreis-Hinweis.
- TF2 (E2E, gleiche Spec): `checkout-renewal` mit de-Fragment „automatisch“ ist sichtbar,
  oberhalb des Bestellknopfs.
- TF3 (E2E, gleiche Spec, `i18nextLng=en`, Muster `issue-1901-terms-consent.spec.ts`):
  Dialog zeigt „€8.99“ und die englischen Fragmente („automatically“, „final price“).
- TF4 (E2E, gleiche Spec, Viewport 375 px): Bounding-Box von Preiszeile und
  Verlängerungssatz bleibt innerhalb der Dialogbreite.
