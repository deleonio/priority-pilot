# Spec #2255 — Marken-Fußzeile auf der Monats-Rückblick-Karte

## Ziel

Monatsrückblick (In-App-Karte `monthly-balance-card` und geteiltes PNG) zeigt eine gemeinsame
Marken-Fußzeile: Balamentum-Logo, Domain `balamentum.app` (einziger Link) sowie Google-Play- und
PWA-Logo. Keine Store-/Install-URLs (Autoren-Entscheidung deleonio, 2026-10-05 — Logos ohne URL).

## Voraussetzung

- Bestehende Karte aus #1995: `erzeugeMonatsKarteSvg` (`frontend/src/lib/monthlyShareCard.ts`),
  `MonthlyBalanceCard` (`frontend/src/components/MonthlyBalanceCard.tsx`).
- Rasterung lädt das SVG als data-URL in ein `Image` — externe Referenzen werden dort nie geladen,
  also müssen alle drei Logos **inline eingebettet** sein (Inline-Pfade oder `<image href="data:…">`).
- Generator bleibt rein (kein DOM, keine neue npm-Abhängigkeit). `KARTE_BREITE/HOEHE` teilt sich die
  Wochenkarte — Höhenänderung nur monatsspezifisch.

## Verhalten

1. `erzeugeMonatsKarteSvg` bettet drei Logos inline ein, jeweils in einer Gruppe
   `id="brand-balamentum"` / `id="brand-google-play"` / `id="brand-pwa"` mit `<title>` (AK1).
2. Die Domain `balamentum.app` steht als sichtbarer Text im SVG; einzige http(s)-URL im gesamten
   SVG ist `https://balamentum.app` (Bestands-Fußzeilen-Link) (AK2).
3. Play- und PWA-Logo tragen übersetzbare Bezeichnungen: Der Generator nimmt dazu einen optionalen
   Parameter `marken` (`{ balamentum; play; pwa }`) entgegen; ohne Parameter gelten deutsche
   Default-Texte („Balamentum“, „Erhältlich bei Google Play“, „Als App installierbar (PWA)“) (AK3).
   Die Component übergibt die `t()`-Texte.
4. Die In-App-Karte zeigt in ihrer Fußzeile drei Bilder mit Alt-Text (Balamentum, Google Play, PWA)
   und die Domain als `KolLink` auf `https://balamentum.app`; die Logos tragen keinen eigenen
   Link/Button — kein `play.google.com` in der Karte (AK4).
5. Neue Texte (Alt-Texte/Logo-Bezeichnungen) existieren in allen 10 Locales unter
   `monthlyCard.marken.*` (AK5; der bestehende i18n-Vollständigkeitstest `config.test.ts` wacht darüber).
6. Bei 375 px liegen Logos und Domain innerhalb der Karte ohne horizontalen Überlauf (Bounding-Box
   gegen die Karte, nicht scrollWidth — die Shell clippt); der Domain-Link ist ≥ 44 px hoch
   (Touch-Target) (AK6).
7. Die Wochenkarte (`weeklyShareCard`) bleibt unverändert; ihre bestehenden Tests bleiben grün (AK7).

## Erwartetes Ergebnis

- PNG und In-App-Karte zeigen die drei Logos als erkennbare Branding-Einheit in der Fußzeile
  (Logo → Domain → Play/PWA, DOM-Reihenfolge = Lesereihenfolge).
- Nur die Domain ist verlinkt; Logos unverzerrt in Markenoptik, nicht in `--pp-*`-Rollen umgefärbt.
- Alle AKs durch Tests gedeckt: AK1–AK3 Unit (`monthlyShareCard.test.ts`), AK4 Component
  (`MonthlyBalanceCard.test.tsx`), AK6 E2E (`monthly-balance-card.spec.ts`); AK5/AK7 durch
  bestehende Tests (keine Duplikate).
