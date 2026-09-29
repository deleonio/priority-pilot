# Spec #1741 — Wortmarke „Balamentum" auf der Login-Seite

## Ziel

Die Login-Seite zeigt die Wortmarke (Marke + Schriftzug „Balamentum") als ein Asset statt der
bisherigen Kombination aus Icon (`icons/icon-192x192.png`) und Text-Span
(`login-page__brand-name`). Die Wortmarken-Assets in `frontend/public/logo/` tragen den
Schriftzug „Balamentum".

## Akzeptanzkriterien (aus Issue #1741)

- **AK1:** `logo-with-name.vertical.png` und `logo-with-name.horizontal.png` zeigen den
  Schriftzug „Balamentum"; die bestehenden Transparenz-/Format-Checks in
  `frontend/src/lib/logo-transparency.test.ts` bleiben grün.
- **AK2:** Die Wortmarke ist auf der Login-Seite im Light- und Dark-Mode mit Kontrast ≥ 4.5:1
  zum jeweiligen Hintergrund lesbar.
- **AK3:** Die Login-Seite rendert das Wortmarken-Asset anstelle von Icon + `__brand-name`-Span;
  der Span fällt weg.
- **AK4:** Android-Icons/Splash sind nach dem Rezept aus `docs/native-apps.md` erzeugt bzw.
  verifiziert und eingecheckt; in der App sichtbar identisch zur Marke.

## Tests / Verifikation

| AK  | Ebene              | Wo                                                                   | Inhalt                                                                                                                                               |
| --- | ------------------ | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| AK1 | Vitest (bestehend) | `frontend/src/lib/logo-transparency.test.ts:156-197`                 | Alpha-Ränder/Format laufen unverändert gegen die neuen PNGs — bereits abgedeckt, kein neuer Test (Dedup). Schriftzug-Inhalt: visuelle Verifikation.  |
| AK2 | visuell            | Screenshot Login-Seite, beide Themes                                 | Kontrast eines Bitmap/SVG-Schriftzugs nicht sinnvoll automatisierbar; visueller Nachweis in der Umsetzungsphase.                                     |
| AK3 | Vitest unit        | `frontend/src/components/LoginPage.test.tsx` (neu, Describe „#1741") | Wortmarken-`img` mit `src` auf `logo/logo-with-name.*` im Brand-Block vorhanden; kein `login-page__brand-name`-Span, keine `icon-192`-Referenz mehr. |
| AK4 | Rezept/visuell     | `docs/native-apps.md` „Icons erzeugen"                               | Binäre Assets aus unverändertem `logo.png` — kein automatisierbarer Test mit Biss; Verifikation per Rezept + Sichtvergleich.                         |

### AK3 im Detail (rot vor Umsetzung)

- `document.querySelector('.login-page__brand img')` existiert und sein `src` matcht
  `/logo\/logo-with-name/` (vertikal oder horizontal).
- `.login-page__brand-name` existiert nicht mehr.
- Kein `img[src*="icon-192"]` auf der Login-Seite.

## Abgrenzungen / Pflege

- Header-Logo (`App.tsx`, `.logo-btn img`) bleibt unverändert bei `logo.png`; die
  Negativ-Assertion in `frontend/e2e/header-logo.spec.ts:177` ist über
  `getByRole('banner').locator('.logo-btn img')` auf den Header begrenzt und wird durch die
  Login-Nutzung der Wortmarke nicht berührt — keine Anpassung nötig (TF4 geprüft).
- E2E-Robe für AK3 bewusst nicht ergänzt: Der unit-Test prüft denselben DOM-Vertrag; die
  e2e-Seite der Wortmarke ist Lieferverhalten (404/Seitenverhältnis) und bleibt über die
  bestehende Header-Spec für das Icon-Asset gesichert.
- Website-Übernahme des Assets ist laut Analyse optional und nicht Bestandteil dieses Tickets.
