# Spec #2226 — Rechtstexte nur auf Deutsch: Hinweis in den anderen Sprachen

Entscheid des Autors (O1): Die deutsche Fassung der Rechtstexte bleibt allein verbindlich, keine Übersetzung.
In den 9 Nicht-Deutsch-Sprachen steht neben den Rechtstext-Links ein übersetzter Hinweis.

## Schlüssel

- Website: `footer.legalGermanOnly` in allen 10 `website/src/i18n/*.json`.
- App: `legal.germanOnly` in allen 10 `frontend/src/i18n/locales/*/messages.json`.
- Der Schlüssel existiert auch in `de` (Paritätstests); die deutsche Oberfläche zeigt ihn nicht.

## Website-Footer

- Ziel: Nutzer einer Nicht-Deutsch-Sprache sieht den Hinweis im Footer.
- Schritte: Landingpage in `en` … `sv` rendern.
- Erwartung: Hinweistext (`footer.legalGermanOnly`) im Footer; `de` zeigt ihn nicht. Datenschutz- und
  Nutzungsbedingungen-Link tragen `hreflang="de"`, `href` bleibt `/datenschutz/` bzw. `/nutzungsbedingungen/`.
- 375 px: Hinweis sichtbar, Bounding-Box innerhalb des Viewports.

## App: Einwilligungsschritt und Hilfe → Impressum

- Ziel: gleicher Hinweis (`legal.germanOnly`) bei Nicht-Deutsch-Sprache im `ConsentStep` und in `LegalLinks`.
- Erwartung: Hinweis bei `en`, keiner bei `de`; Links tragen `hreflang="de"`, Ziele unverändert.
- 375 px: Hinweis im Einwilligungsschritt ohne Überlauf.
