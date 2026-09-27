# Spec #1751 — Login-Maske: Hierarchie, Card-Struktur, Website-Link

## Ziel

Die Wortmarke dominiert die Login-Seite optisch. „Anmelden" + Subline wandern als Card-Kopf in
`.login-page__card` (Token `--pp-font-size-lg` statt `2xl`, negative Margin auf der Subline
entfällt). Im Web-Kanal führt ein Link „Zurück zur Website" (`href="/"`) unter der Card zurück auf
die öffentliche Website; im Native-Kanal (`isNativeChannel()`) entfällt er. Der Google-Button
heißt „Mit Google anmelden". Das Magic-Link-`<form>` bekommt eine CSS-Klasse statt Inline-`style`.

## Akzeptanzkriterien (aus Issue #1751 / KI-ANALYSE)

- **AK1:** `.login-page__title` nutzt `--pp-font-size-lg` (nicht `2xl`); `h1` „Anmelden" und die
  Subline liegen im DOM innerhalb `.login-page__card`; die negative Margin auf `.login-page__sub`
  entfällt.
- **AK2:** Im Web-Kanal ist unter der Card ein Link mit `href="/"` sichtbar, dessen Name
  „Website" enthält.
- **AK3:** Im Native-Kanal (`isNativeChannel() === true`) wird dieser Link nicht gerendert.
- **AK4:** Der Google-Button heißt „Mit Google anmelden"; „Login with Google" kommt auf der Seite
  nicht mehr vor.
- **AK5:** Das Magic-Link-`<form>` trägt eine CSS-Klasse statt Inline-`style`.
- **AK6:** Bestehende Verträge bleiben grün: `login.spec.ts` AK1a, Heading-Vertrag, Theme-SVGs
  #1741, Magic-Link-Flow (Unit + E2E).
- **AK7 (Mobile-First):** Bei 375 px kein horizontales Scrollen; Buttons/Inputs bleiben ≥ 44 px
  hoch.

## Tests / Verifikation

| AK  | Ebene        | Wo                                                                                                                                                                 | Inhalt                                                                                                                                                                     |
| --- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AK1 | Vitest       | `frontend/src/components/LoginPage.test.tsx` — Describe „#1751", Test „AK1"                                                                                        | `h1`/Subline haben `closest('.login-page__card') === card`. Token-Wechsel `lg` ist reine CSS-Änderung, jsdom berechnet kein CSS — visuelle Prüfung in der Umsetzungsphase. |
| AK2 | Vitest       | dito, Test „AK2"                                                                                                                                                   | `getByRole('link', {name: /Website/i})` mit `href="/"` im Standard-Kanal (kein `__PP_CHANNEL__`-Stub = web).                                                               |
| AK3 | Vitest       | dito, Test „AK3"                                                                                                                                                   | `vi.stubGlobal('__PP_CHANNEL__', 'play')` (bestehendes Muster aus Describe „Google-Login je Kanal") → `queryByRole('link', {name: /Website/i})` ist `null`.                |
| AK4 | Vitest + E2E | dito, Test „AK4"; Test-Pflege in `LoginPage.test.tsx:37`, `Root.test.tsx:119`, `frontend/e2e/{login,auth,silent-login,userinfo,google-signup,bahn,logout}.spec.ts` | Alle `/Login with Google/i`-Assertions auf `/Mit Google anmelden/i` umgestellt (Dedup — kein neuer Duplikat-Test); neuer Negativ-Check „kommt nicht mehr vor".             |
| AK5 | Vitest       | dito, Test „AK5"                                                                                                                                                   | `form.getAttribute('style')` ist `null`, `form.className` ist nicht leer.                                                                                                  |
| AK6 | Vitest + E2E | bestehende Tests unverändert (nach AK4-Textumstellung)                                                                                                             | Kein neuer Test — Regressionsschutz über die bestehende Suite.                                                                                                             |
| AK7 | E2E          | `frontend/e2e/login.spec.ts` — Test „AK7 (#1751)"                                                                                                                  | Bounding-Box von `.login-page__inner` bleibt im 375px-Viewport, Button-Höhe ≥ 44px (Muster: bestehender AK5-Test „mobile Viewports").                                      |

## Test-Pflege-Bedarf

Die Umbenennung des Google-Buttons macht `/Login with Google/i` zu einem funktionslosen Matcher:
`toBeHidden()`-Assertionen mit diesem Regex blieben nach der Umsetzung grün, weil kein Element mehr
matcht (Element existiert, aber unter neuem Text) — false-negative-Risiko. Alle Vorkommen in
`frontend/src/Root.test.tsx`, `frontend/src/components/LoginPage.test.tsx` sowie
`frontend/e2e/{login,auth,silent-login,userinfo,google-signup,bahn,logout}.spec.ts` wurden auf
`/Mit Google anmelden/i` umgestellt (mechanischer Rename, keine Verhaltensänderung der Tests).

## Abgrenzungen / Pflege

- Font-Size-Token-Wechsel (`--pp-font-size-lg` statt `2xl`) ist reines CSS — jsdom berechnet keine
  Styles; Nachweis bleibt visuell in der Umsetzungsphase (wie #1741 AK2).
- `isNativeChannel()`-Kanalsteuerung wird in Tests über `vi.stubGlobal('__PP_CHANNEL__', …)`
  gesetzt (bestehendes Muster derselben Datei, Describe „Google-Login je Kanal", nicht per
  `vi.mock('../lib/platform')`) — Muster-Treue.
- Kein Split: eine Komponente + CSS + Test-Pflege, ein PR (Analyse-Entscheidung).
