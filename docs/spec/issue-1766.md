# Login-Maske: Hierarchie, Card-Struktur, Website-Link

**Stand:** 2026-09-27

## Ziel

Die Login-Maske (`LoginPage`) stellt die Wortmarke in den Vordergrund, fasst Titel und Subline in der
Card zusammen, benennt den Google-Button deutsch und bietet im Web-Kanal einen Rückweg zur öffentlichen
Website. Das Magic-Link-Formular verliert sein Inline-`style`.

## Ablauf / Soll-Zustand

1. **Card-Hierarchie (AK1):** `.login-page__title` (`h1`, Text „Anmelden") und `.login-page__sub` liegen
   im DOM innerhalb von `.login-page__card` (aktuell davor, mit negativer Margin auf `.login-page__sub`,
   die mit der Verschiebung entfällt). Die Schriftgröße des Titels wechselt von `--pp-font-size-2xl` auf
   `--pp-font-size-lg` (visuell verifiziert, in jsdom nicht auswertbar).
2. **Website-Link (AK2):** Im Web-Kanal (`isNativeChannel() === false`) erscheint unterhalb der Card ein
   Link mit zugänglichem Namen, der „Website" enthält, und `href="/"`. Im nativen Kanal
   (`isNativeChannel() === true`) wird er nicht gerendert.
3. **Google-Button-Name (AK3):** Der Button trägt den zugänglichen Namen „Mit Google anmelden" statt
   „Login with Google"; das Google-Logo-SVG bleibt unverändert.
4. **Magic-Link-Formular (AK4):** Das `<form>` trägt eine CSS-Klasse (z. B. `.login-page__form`) statt
   des Inline-`style` `{ display: 'flex', flexDirection: 'column', gap: 'var(--pp-gap-tight)' }` —
   optisch identisch.
5. **Bestandsverträge (AK5):** Alle bisherigen Login-/Auth-/Logout-/Silent-Login-/Bahn-/Userinfo-/
   Google-Signup-Suiten bleiben grün — mit auf den neuen Button-Namen gepflegten Locators. Das
   „Balamentum"-Heading-Level-1 bleibt ausschließlich der Haupt-App vorbehalten (unverändert).
6. **Mobile-First (AK6):** Bei 375 px Viewportbreite: kein horizontales Scrollen (`scrollWidth <= 375`),
   Card-Bounding-Box liegt im Viewport, Button/Link haben eine Tap-Höhe von mindestens 44 px.

## Erwartetes Ergebnis

- Card zeigt Kopf (Titel „Anmelden" + Subline) und Inhalt (Alerts, Google-Button, ggf. Magic-Link-
  Formular) als zusammenhängenden Block.
- Web-Nutzer:innen haben unterhalb der Card einen sichtbaren Rückweg zur öffentlichen Website (`/`);
  native Kanäle (Android/iOS-App) zeigen ihn nicht.
- Google-Button und alle abhängigen Tests sprechen deutsch („Mit Google anmelden"); kein Vorkommen von
  „Login with Google" mehr im gerenderten Markup.
- Magic-Link-Formular ist frei von Inline-`style`.

## Bausteine

Reine Frontend-Änderung in `LoginPage.tsx` + `app.css` (`.login-page-*`); nutzt das bestehende Muster
`isNativeChannel()` aus `frontend/src/lib/platform.ts` (bereits für den Google-Login-Kanal verwendet).
Kein KoliBri-Wechsel — die Seite bleibt bewusst bei rohen HTML-Elementen (Begründung `LoginPage.tsx:26`).
