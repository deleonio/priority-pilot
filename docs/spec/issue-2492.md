# Spec #2492 — Android-App (Kanal `play`): Pakete ohne Kaufweg

Grundlage: ADR 0016, Nachtrag 2026-10-08. Bis zur PO-Freigabe zeigt die Android-App die Pakete ohne Kaufmöglichkeit.

## Kanal `play`, Nutzer ohne Abo

- **Vorbedingung:** `__PP_CHANNEL__ = 'play'`, Paketübersicht (`/app/settings/pakete`).
- **Erwartet:**
  - Katalogpreise aus dem Server (kein Store-Preis); keine Buchen-Zeilen, kein Kauf-Button.
  - Kein Aufruf an Google Play (`CdvPurchase.store.initialize/get/order`).
  - Hinweis `store-purchase-notice`: „Kauf in der App folgt“ (de) / „In-app purchase coming soon“ (en).
  - Weder Link noch Text „PayPal“ in der Übersicht.
  - 375 px: Hinweis und Matrix sichtbar, Hinweis ragt nicht über den Viewport.

## Kanal `web`

PayPal-Kaufweg unverändert (Buchen-Zeilen, kein Store-Hinweis).

## Test-Pflege

`PlansSection.test.tsx` „play: Preise aus Google Play“ (#1692) und `play-pakete.spec.ts` („Google Play nicht erreichbar“, „Kauf-Buttons ≥ 44 px“) widersprechen dem Nachtrag und sind ersetzt. AK6 (ADR-Verweis auf #2492) ist Doku, kein Test.
