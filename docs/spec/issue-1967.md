# Spec #1967 — Zweckbestimmung, Begriffsliste, Hinweis auf ärztlichen Rat

Ziel: Balamentum bleibt Lebensbalance- und Selbstfürsorge-Impuls, kein Medizinprodukt.

## Doku (AK1, kein Test)

- `docs/fuersorge-tonalitaet.md` erhält den Abschnitt „Zweckbestimmung und Begriffsliste“ (erlaubt/zu meiden: Burnout-Prävention, Therapie, Heilung, Diagnose, Behandlung, Stressabbau; verbindlich für Website, App, Store).

## Website (AK2, AK3)

- Kein `website/src/i18n/*.json`, `terms.ts`, `privacy.ts` enthält einen Zu-meiden-Begriff (Spiegel der Doku-Liste, `i18n-mdr-wording.test.ts`).
- Jede gerenderte Landingpage (10 Sprachen) nennt die Zweckbestimmung (kein Medizinprodukt, kein Ersatz für ärztlichen Rat), sprachspezifisch „medical device“/„Medizinprodukt“ usw.
- `renderTerms` enthält „kein Medizinprodukt“ als eigenen Absatz.

## App (AK4, AK5)

- `CareHint` zeigt in beiden Varianten (leer und mit Vorschlag) „ärztlichen Rat“ und einen Light-DOM-Link `<a href="tel:08001110111">` (TelefonSeelsorge, kostenfrei, rund um die Uhr).
- Bei 375 px ist der Link sichtbar, mindestens 44 px hoch und ohne horizontalen Überlauf.
