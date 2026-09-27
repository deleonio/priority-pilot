# Spec: Issue 1769 — Login-Maske: Hierarchie, Card-Struktur, Website-Link

## Ziel

Die Login-Maske stellt die gewünschte Hierarchie her: die Wortmarke dominiert, „Anmelden" und
Subline werden als Card-Kopf **in** die Card verlagert (Titel auf `--pp-font-size-lg` statt
`2xl`), der Google-Button ist deutsch beschriftet, und im Web-Kanal führt unterhalb der Card ein
dezent Link zurück auf die öffentliche Website. Das Magic-Link-Formular styelt über eine
CSS-Klasse statt Inline-Styles.

## Voraussetzungen

- Roh-Elemente statt KoliBri bleiben (dokumentierte Ausnahme, `LoginPage.tsx:28-36`).
- Heading-Vertrag unberührt: „Balamentum" ist Bild-alt, kein Heading; „Dashboard"-h1 bleibt
  unauthentifiziert versteckt; „Anmelden" bleibt h1.
- Kanal-Gating per `isNativeChannel()` / `__PP_CHANNEL__` (Muster `lib/platform.ts`).
- Wortmarken-SVGs (#1741), `--pp-on-brand`-Kontrast und die Magic-Link-Verträge (Unit liest
  Alert-textContent, E2E `getByLabelText`) bleiben unangetastet.
- UX-Übernahmen: zugänglicher Name des Website-Links darf präziser sein als der sichtbare Text
  (z. B. aria-label „Zurück zur Balamentum-Website") — Tests matchen `/Zurück zur/`; der Link
  ist Touch-Target und fällt unter die 44-px-Regel.

## Schritte / Erwartete Ergebnisse

### AK1 — Card-Kopf: Titel + Subline in der Card, lg-Skala

- `h1.login-page__title` und `p.login-page__sub` liegen im DOM **innerhalb** `.login-page__card`
  (vor Alert/Buttons).
- `.login-page__title` nutzt `--pp-font-size-lg` (statt `2xl`, app.css:4837); die computed
  `fontSize` entspricht dem `lg`-Token-Wert (der am Breakpoint überschrieben wird — Vergleich
  gegen Probe-Element, nicht gegen einen hartcodierten Pixelwert).
- Die negative Margin auf `.login-page__sub` (app.css:4844) entfällt (computed
  `marginTop ≥ 0`).

### AK2 — „Zurück zur Website" je Kanal

- Web-Kanal: unterhalb der Card ein Link, Name matcht `/Zurück zur/`, `href` ist `/`.
- Nativer Kanal (`isNativeChannel()`, `__PP_CHANNEL__ = 'play'`): der Link wird nicht gerendert.

### AK3 — Deutsche Google-Beschriftung

- Der Google-Button trägt den Text „Mit Google anmelden" (accessible name).
- Keine englische Textfläche „Login with Google" verbleibt auf der Seite.
- Das Vierfarben-G-SVG bleibt unverändert.

### AK4 — Bestandsverträge nach Locator-Pflege

- E2E `login.spec.ts` und Unit `LoginPage.test.tsx` werden auf den deutschen Buttonnamen
  gepflegt; danach bleiben alle Bestandssuiten grün (Heading-Vertrag, Theme-SVGs #1741,
  Magic-Link-Flow Unit + E2E). Kein eigener Zusatztest — Gate-Bedingung.

### AK5 — CSS-Klasse fürs Magic-Link-Formular

- Das Formular trägt `.login-page__form` und kein `style`-Attribut; Layout (Flex-Spalte, Gap
  `--pp-gap-tight`) bleibt gleich (Klasse übernimmt die Deklaration).

### AK6 — 375 px: kein Overflow, Touch-Targets ≥ 44 px

- Bei 375×667: Bounding-Box (`x + width ≤ 375`) für Card, Google-Button, E-Mail-Input,
  Sende-Button und Website-Link; Höhe ≥ 44 px für Google-Button, E-Mail-Input, Sende-Button und
  Website-Link. (Bounding-Box statt scrollWidth — App-Shell clippt overflow-x.)
- E2E-Hinweis: das E2E-Backend hat kein SMTP, daher ist das Magic-Link-Formular dort erst nach
  Mock von `**/auth/providers` (`magicLink: true`) im DOM.

## Testabdeckung

| AK  | Ebene                                     | Datei                                                                      |
| --- | ----------------------------------------- | -------------------------------------------------------------------------- |
| AK1 | E2E                                       | `frontend/e2e/login.spec.ts`                                               |
| AK2 | Unit + E2E                                | `frontend/src/components/LoginPage.test.tsx`, `frontend/e2e/login.spec.ts` |
| AK3 | E2E (+ Unit über gepflegten Buttonnamen)  | `frontend/e2e/login.spec.ts`                                               |
| AK4 | Gate (Bestandssuiten nach Locator-Pflege) | —                                                                          |
| AK5 | Unit                                      | `frontend/src/components/LoginPage.test.tsx`                               |
| AK6 | E2E                                       | `frontend/e2e/login.spec.ts`                                               |
