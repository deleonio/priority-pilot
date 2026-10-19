# Spec #2769 — Zugänglichkeitserklärung nach BFSG (Website)

## Ziel

Die Website erhält eine Unterseite „Barrierefreiheit“ (de/en) nach dem Muster der Rechtsseiten
(`renderPrivacy`/`renderTerms`), aus dem Footer jeder der zehn Sprachversionen verlinkt. Sie nennt
Konformitätsgrad, bekannte Einschränkungen, Feedback-Kontakt und Durchsetzungsstelle (§ 14 BFSG).

## Regeln

1. **Seitenpfade und Footer (AK1):** `SUBPAGES.accessibility = { de: '/barrierefreiheit/', en: '/en/accessibility/' }`;
   der Footer jeder der zehn Sprachversionen enthält den Link mit lokalisiertem Label
   `footer.accessibility` (hreflang-Muster wie Datenschutz: de auf die deutsche, alle übrigen auf
   die englische Fassung).
2. **Pflichtinhalte (AK2):** `renderAccessibility` (Export in `render.ts`, Muster `renderPrivacy`)
   rendert de und en mit allen vier Pflichtinhalten: angestrebter Konformitätsgrad WCAG 2.2;
   Abschnitt „Bekannte Einschränkungen“ (en: „Known limitations“); Feedback-Kontakt als
   mailto-Link mit der Adresse aus `operator.ts`; Durchsetzungsstelle nach BFSG (de:
   „Durchsetzungsstelle“, en nennt „enforcement“ und das Kürzel BFSG).
3. **Build und Sitemap (AK3):** Der Build erzeugt `dist/barrierefreiheit/index.html` und
   `dist/en/accessibility/index.html`; beide Pfade stehen in der Sitemap (Aufnahme läuft
   automatisch über `page()` in `build.ts`).
4. **Textentwurf und Freigabe (AK4):** kein maschineller Test — Konformitätsgrad und
   Einschränkungen stehen als Entwurf in der PR-Beschreibung mit Freigabevermerk durch den
   Menschen; der FAQ-Text (WCAG-Aussage) bleibt unverändert.
5. **Tonalitätsspiegel:** `i18n-mdr-wording.test.ts` um das Textmodul `accessibility.ts`
   erweitern — Aufgabe der Umsetzung (Import existiert vorab nicht, Muster #2307).

## Test-Pflege

Keine Widersprüche zu bestehenden Tests: `landing.spec.ts` prüft Footer-Links einzeln (kein
Count/Snapshot), additive Links brechen nichts. Der bestehende Build-Test (#1672 AK3) wurde um die
Barrierefreiheit-Assertions (dist + Sitemap) erweitert statt einen zweiten Build-Lauf zu starten.
