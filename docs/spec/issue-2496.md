# #2496 — Fest kodierte Texte und rohe Schlüssel im Balance-/Gruppen-UI

## Ziel

Keine deutschen Resttexte und keine rohen i18n-Schlüssel in vier Stellen der Oberfläche:

1. Der Ring-`<title>` in `BalanceFigure` (`frontend/src/components/BalanceFigure.tsx`) ist
   übersetzt — „X von Y“ wird beim Sprachwechsel mitübersetzt, die Zahlen bleiben.
2. Die Meilenstein-Liste der Monatsrückblick-Card (`MonthlyBalanceCard`) zeigt denselben
   übersetzten Text wie der SVG-Export (`meilensteinText()`), nicht den rohen Schlüssel
   (`streak-7`).
3. Die Vorschau-Beschriftung der Bildwahl (`BalanceVariantSetting`) nennt das gewählte Bild in
   der eingestellten Sprache und folgt einem Sprachwechsel ohne Reload.
4. `GroupDetail` rendert die Einladen-Bereiche (Nutzersuche, Einladungslinks) erst, wenn die
   Mitgliederliste geladen ist (`members !== null`) — kein Einladen-Angebot gegen einen
   unbekannten Stand. Die Duo-Obergrenze (#1991: volles Duo sperrt Einladen) bleibt unverändert.

## Voraussetzungen

- i18n-Mechanik existiert: `meilensteinText()` (`MonthlyBalanceCard.tsx:32-37`),
  `settings:balanceVariant.preview` = „Vorschau: {{name}}“ mit übersetzten Variant-Labels als
  Gettern (`lib/balanceVariant.ts`), Tests laufen global auf Deutsch (`vitest.setup.ts`),
  Sprachwechsel im Test per `i18next.changeLanguage`.
- AK3 ist im Code bereits erfüllt (aria-label übersetzt bereits über `{{name}}`) — der Test
  sichert das als Regressionsschutz.

## Schritte & erwartetes Ergebnis

1. **AK1 (Ring-Titel):** Bei englischer Oberfläche enthält kein Arc-`<title>` der
   `BalanceFigure` das deutsche „von“; die Zahlen (Ist, Soll 100) bleiben lesbar. Implementierung
   übersetzt über i18n (neuer Schlüssel in **allen** Sprachdateien unter
   `frontend/src/i18n/locales/*/`); nur der `<title>`-Text ändert sich — aria-label-Mechanik und
   SVG-Export unberührt.
2. **AK2 (Meilensteine):** Die `<li>`-Liste der Monatskarte zeigt `meilensteinText(schluessel)`
   („Streak 7“), niemals den rohen Schlüssel (`streak-7`).
3. **AK3 (Vorschau-Beschriftung):** Die Vorschau der Bildwahl trägt das übersetzte Bild als
   aria-label (de: „Vorschau: Herz“, en: „Preview: Heart“); nach `changeLanguage` aktualisiert
   sich die Beschriftung ohne Reload.
4. **AK4 (Lade-Gate):** Solange `members === null` ist, erscheinen weder „Mitglieder einladen“
   noch „Einladungslinks“; nach dem Laden sieht ein Admin beide Bereiche; ein volles Duo (2
   Mitglieder) bleibt ohne Einladen-Bereich.

## Testfälle

Vitest-Units je Fundstelle: `BalanceFigure.test.tsx` (neu, AK1),
`MonthlyBalanceCard.test.tsx` (erweitert, AK2 — bestehende AK2-Assertion auf den rohen
Schlüssel wird auf den übersetzten Text umgestellt, Test-Pflege im PR-Body),
`BalanceVariantSetting.test.tsx` (neu, AK3), `GroupDetail.test.tsx` (erweitert, AK4 — drei
Fälle: lädt / geladen+Admin / volles Duo). Rein visuelle Aspekte gibt es nicht (nur Text- und
Render-Gating-Änderungen, kein Layout-Bezug).
