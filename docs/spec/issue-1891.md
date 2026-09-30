# Spec #1891 — Nutzungsbedingungen

Ziel: Rechtstext (Konto, Pakete und Abo, Zahlungswege, Haftung) als deutsche Website-Seite, aus Footer und App-Hilfe erreichbar.

## Website (`website/`)

- Vorbedingung: Muster #1672 (`privacy.ts`, `renderPrivacy`, Build, Sitemap).
- `renderTerms({ locale: 'de', messages, siteUrl, allMessages })` liefert eine Seite mit `<html lang="de">`, einer `h1` und `h2` „Konto“, „Pakete und Abo“, „Zahlungswege“, „Haftung“.
- Abo-Abschnitt nennt Laufzeit, Upgrade, Downgrade, Kündigung; Zahlungsabschnitt PayPal und Google Play.
- Paketnamen und Preise (Monat/Jahr) kommen aus `getPlansCatalog()` (`plans.ts`), nicht als Literal.
- Build schreibt `dist/nutzungsbedingungen/index.html` (keine Sprachvarianten) und nimmt `/nutzungsbedingungen/` in die Sitemap auf.
- Footer jeder Seite in allen 10 Sprachen: `<a href="/nutzungsbedingungen/">` mit `footer.terms`; Datenschutz-Link bleibt.

## App (`frontend/`)

- Hilfe-Seite, Tab Impressum: zwei externe Links „Nutzungsbedingungen“, „Datenschutz“ auf `<origin>/nutzungsbedingungen/` bzw. `<origin>/datenschutz/`, `target="_blank"`, `rel="noopener noreferrer"`.
- 375 px: Links sichtbar, im Viewport, mindestens 24 px hoch (UX: 44 px angestrebt).

## Abdeckung

AK1–AK4: `website/src/render.test.ts` (`renderTerms (#1891)`); AK5: `HelpPage.test.tsx`; AK6: `website/e2e/landing.spec.ts`, `frontend/e2e/help.spec.ts`.
