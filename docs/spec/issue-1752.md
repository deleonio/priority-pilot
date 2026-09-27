# Spec: Login-Maske — Hierarchie, Card-Struktur, Website-Link (#1752)

Status: rote Tests (Spec-Phase). Umsetzung folgt in der Impl-Phase.

## Ziel

Die Login-Seite bekommt eine klare visuelle Hierarchie (Wortmarke dominant, Überschrift kleiner),
Struktur (Titel + Subline als Card-Kopf **innerhalb** der Card), einen deutschen Google-Button und
im Web-Kanal einen Link zurück zur Website.

## Voraussetzungen

- `frontend/src/components/LoginPage.tsx` rendert Wortmarke außerhalb, Titel/Subline außerhalb der Card.
- Styling zentral in `frontend/src/app.css` (Block `.login-page-*` ab ~Z. 4789).
- Rohe Elemente statt KoliBri bleiben begründeter Ausnahmezustand (Kommentar LoginPage.tsx:26-34).

## Akzeptanzkriterien und erwartetes Verhalten

### AK1 — Card-Kopf und Titelgröße

- `.login-page__title` nutzt `--pp-font-size-lg` (statt `--pp-font-size-2xl`).
- `h1.login-page__title` und `p.login-page__sub` liegen im DOM **innerhalb** `.login-page__card`.
- Das negative Margin auf `.login-page__sub` entfällt (Margin-Top ≥ 0).

### AK2 — Website-Link nur im Web-Kanal

- Unter der Card existiert ein sichtbarer Link mit `href="/"`, dessen Label „Website" enthält.
- Bei `isNativeChannel() === true` (Kanal `play`/`appstore`) wird der Link nicht gerendert.

### AK3 — Deutscher Google-Button

- Der Google-Button trägt den Text „Mit Google anmelden"; das Vierfarben-SVG bleibt unverändert.
- Keine englische Textfläche mehr auf der Seite (insbesondere kein „Login with Google").

### AK4 — Locator-Pflege (Impl-Phase)

Alle 24 „Login with Google"-Locators (8 Dateien: e2e auth 4, bahn 2, google-signup 1, login 6,
logout 5, silent-login 4, userinfo 1; Unit LoginPage.test.tsx 1; außerdem `Root.test.tsx` und
`login.spec.ts`-Bestandstests) werden im selben PR wie der Rename gepflegt; alle Bestands-Verträge
bleiben grün. Die Spec-Phase legt mit den neuen AK3-Assertions den Zieltext fest; die Pflege der
bestehenden Locators ist mechanische Impl-Arbeit.

### AK5 — Magic-Link-Formular ohne Inline-Style

Das Formular nutzt eine CSS-Klasse (`login-page__form`) statt des Inline-`style`
(LoginPage.tsx:127); das Flex-Layout bleibt optisch unverändert.

### AK6 — Mobile Integrität (375 px)

- Kein horizontaler Overflow: Bounding-Box-Messung (die App-Shell clippt `overflow-x`, `scrollWidth`
  ist ungeeignet) — kein Element ragt aus dem Viewport.
- Buttons und E-Mail-Input bleiben mindestens 44 px hoch.

## Tests (rote Spec-Tests)

| AK  | Ebene                                                                                      | Datei                                                                      |
| --- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| AK1 | Unit (DOM-Struktur) + E2E (`getComputedStyle` gegen `--pp-font-size-lg`-Probe, Sub-Margin) | `frontend/src/components/LoginPage.test.tsx`, `frontend/e2e/login.spec.ts` |
| AK2 | Unit (`__PP_CHANNEL__`-Stub web/play) + E2E (sichtbar, `href="/"`)                         | dito                                                                       |
| AK3 | Unit + E2E (`getByRole('button', { name: /Mit Google anmelden/i })`, Alt-Text abwesend)    | dito                                                                       |
| AK5 | Unit (Klasse present, `style`-Attribut abwesend)                                           | `LoginPage.test.tsx`                                                       |
| AK6 | E2E 375 px (Bounding-Box-Overflow, 44-Px-Höhen)                                            | `frontend/e2e/login.spec.ts`                                               |

UX-Hinweise (advisory, nicht testverankert): Unterstreichung + ≥ 44 px Tapp-Ziel für den
Website-Link, `display:none` für die inaktive Wortmarke-Variante, Space-/Token-Pflicht für neues CSS.
