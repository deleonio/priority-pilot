# Issue 1753 — Login-Maske: Hierarchie, Card-Struktur, Website-Link

## Ziel

Die Login-Maske folgt der Hierarchie „Wortmarke → Card mit Anmelden-Kopf“, ist konsequent
deutschsprachig, und im Web-Kanal führt ein dezenter Text-Link zurück zur öffentlichen Website.

## Voraussetzung

- Unauthentifizierter Aufruf der App (`/app/`) zeigt die Login-Seite (`frontend/src/components/LoginPage.tsx`).
- Styling liegt zentral unter `.login-page-*` in `frontend/src/app.css`; die bewusst rohen Elemente
  (h1, button, input statt KoliBri) bleiben (Begründung LoginPage.tsx:26).

## Schritte

1. `h1.login-page__title` („Anmelden“, `--pp-font-size-lg`) und `.login-page__sub` wandern als
   Card-Kopf in `.login-page__card` — vor Alert und Buttons; die negative Margin der Subline entfällt.
2. Unterhalb der Card rendert der Web-Kanal einen Text-Link „Zurück zur Website“ (`href="/"`);
   bei `isNativeChannel() === true` wird er nicht gerendert. ≥ 44 px tappbar, Fokus-Ring wie bisher.
3. Der Google-Button heißt „Mit Google anmelden“ — das Vierfarben-SVG (18×18, `aria-hidden`) bleibt
   unverändert; alle Button-Locators (Unit `LoginPage.test.tsx`, E2E `login.spec.ts` AK1a–AK5)
   stellen auf das deutsche Label um.
4. Das Magic-Link-Formular wird über die CSS-Klasse `.login-page__form` gestylt statt des
   Inline-`style`-Attributs (LoginPage.tsx:127); Optik unverändert.
5. Bestehende Verträge bleiben erhalten: Heading-Vertrag („Balamentum“ nur als Level 1 der
   Haupt-App), Theme-SVG-Paar #1741, Magic-Link-Flow (Unit + E2E), Auth-Gate AK1a/AK1b.

## Erwartetes Ergebnis

- Card-Kopf: Titel auf lg-Stufe (1.125 rem = 18 px), Subline innerhalb der Card, keine negative Margin.
- Back-Link nur im Web-Kanal, sichtbar, unter der Card, `href="/"`.
- Kein horizontales Scrollen bei 375 px Viewport; Buttons, Inputs und Back-Link ≥ 44 px hoch.
- Abgedeckt durch rote Tests in `frontend/src/components/LoginPage.test.tsx` (AK1–AK4) und
  `frontend/e2e/login.spec.ts` (AK1, AK2, AK3, AK4, AK6); AK5 ist Bestandsvertrag und läuft grün,
  sobald die Umsetzung Label und Locators umgestellt hat.
