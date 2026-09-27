# Spec: Login-Card-Struktur, deutsche Button-Texte und Mobile-Tauglichkeit (#1767)

## Ziel

Die Login-Seite erhält eine klare Card-Hierarchie (Card-Kopf innerhalb der Card), deutsche
Bedientexte, einen kanalabhängigen Rücklink zur Website und verzichtet auf Inline-Styles.
Wortmarke bleibt dominant, KoliBri-Verzicht bleibt bestehen (Ausnahme dokumentiert in
`LoginPage.tsx`).

## AK1 — Card-Kopf innerhalb der Card

- Vorbedingung: LoginPage gerendert (Magic Link aus, nur Google-Button).
- Schritt: DOM prüfen.
- Ergebnis: `.login-page__title` (h1 „Anmelden") und `.login-page__sub` liegen im DOM
  innerhalb `.login-page__card`. In `app.css` nutzt `.login-page__title`
  `--pp-font-size-lg` (nicht mehr `--pp-font-size-2xl`); `.login-page__sub` hat keine
  negative Margin mehr.

## AK2 — Rücklink zur Website nur im Web-Kanal

- Schritt: Web-Kanal rendern.
- Ergebnis: Unterhalb der Card existiert ein Link mit `href="/"`, dessen Label „Website"
  enthält („Zurück zur Website"). Bei `isNativeChannel() === true` (Kanal `play`) wird der
  Link nicht gerendert.

## AK3 — Google-Button deutsch

- Ergebnis: Der Google-Button heißt „Mit Google anmelden" (Vierfarben-G unverändert,
  `aria-hidden`). Der String „Login with Google" kommt in `frontend/src` und
  `frontend/e2e` nicht mehr vor (auch nicht in Test-Regexes — Test-Pflege).

## AK4 — Magic-Link-Formular ohne Inline-Style

- Ergebnis: Das Formular (bei aktiviertem Magic Link) trägt die CSS-Klasse
  `.login-page__magic` aus app.css (Layout über `--pp-gap-tight`) und kein `style`-Attribut.

## AK5 — Mobile (375 px)

- Ergebnis (E2E, 375-px-Viewport): kein horizontaler Überlauf (Bounding-Box-Prüfung, die
  App-Shell clippt `overflow-x`), Google-Button und E-Mail-Input mindestens 44 px hoch.

## AK6 — Bestehende Verträge

- Ergebnis: login.spec AK1a (unauthentifiziert → Login-Seite), Header-Logo-/Heading-Vertrag
  (`header-logo.spec.ts`), Magic-Link-Flow (Unit + E2E) bleiben inhaltlich unverändert grün;
  nur die Button-Regexes werden als Test-Pflege auf den neuen deutschen Text umgestellt.
