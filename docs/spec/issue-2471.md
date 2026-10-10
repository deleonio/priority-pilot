# Spec #2471 — Demo-Hinweis als dismissible Card

Ziel: Nur das Play-Prüfkonto aus #2426 sieht auf dem Dashboard eine wegklickbare Hinweis-Card
(„Du bist mit dem Google-Play-Prüfkonto angemeldet …“). Normale Nutzer sehen nichts; der
LaunchBanner (#2229, bewusst nicht wegklickbar) bleibt unverändert. Ausblendung nur für die
Session (sessionStorage), nach erneutem Prüf-Login ist die Card wieder da.

## Server (AK1)

`GET /auth/me` ergänzt `demoHint: boolean` in **beiden** Response-Zweigen:

| Fall                                                                       | `demoHint` |
| -------------------------------------------------------------------------- | ---------- |
| Pass-Through-Modus (kein Auth-Kontext)                                     | `false`    |
| Session-E-Mail = Prüfkontakt-E-Mail **und** `DEMO_HINT_ENABLED === 'true'` | `true`     |
| sonst (Normalkonto, Schalter aus)                                          | `false`    |

- Prüfkontakt-E-Mail wie in `POST /auth/review-login`: `PLAY_REVIEW_EMAIL` oder Default
  `google-play-review@balamentum.invalid` — Auflösung als geteilter Helper, nicht dupliziert.
- Erkennung an der **E-Mail**, nicht an der User-Id (jedes Review-Login setzt das Konto zurück, #2442).
- Env-Schalter je Anfrage gelesen (Muster `launchBanner`, #2229).
- OpenAPI: `MeDto` um `demoHint` erweitern, Client-Schema regenerieren (`pnpm build:api`).

## Frontend (AK2, AK3, AK5)

Neue Komponente `DemoHint` (`frontend/src/components/DemoHint.tsx`), Props `{ enabled: boolean }`;
das Dashboard mountet sie oben im Seitenfluss (`enabled = user.demoHint === true`).

- Card oben im Dashboard, Test-Id `demo-hint`; `enabled=false` → keine Card (AK2).
- Titel „Play-Prüfkonto“ / „Google Play review account“, Text aus i18n (`demoHint.*`, de/en):
  de „Play-Prüfkonto: Du bist mit dem Google-Play-Prüfkonto angemeldet. Diese Umgebung dient der
  App-Prüfung.“ / en „Google Play review account: You are signed in with the Play review account.
  This environment is used for app review.“ (KI-UX, final).
- Schließen: eigener KolButton (X, `_hideLabel`), Test-Id `demo-hint-close`, zugänglicher Name aus
  `demoHint.close` = „Schließen“/„Close“ — bewusst **kein** `_hasCloser` (KoliBri-eigene Closer-i18n
  bliebe im EN-Modus deutsch und verletzte AK2).
- Klick auf X: Card sofort entfernt, `sessionStorage['pp_demo_hint_dismissed'] = '1'`; gesetzter
  Marker → Card bleibt bei Folgemounts weg (überlebt Reload) (AK3).
- Marker-Reset beim erfolgreichen Login (App-Login-Übergang) → nach Logout + erneutem Prüf-Login
  erscheint die Card wieder (AK4).
- Kein localStorage-Eintrag, kein Serverzustand für die Ausblendung (AK5).

## E2E (AK3–AK6)

`frontend/e2e/issue-2471-demo-hint.spec.ts` (375 px, Muster `issue-2426-review-login.spec.ts`):
Prüf-Login (7 Logo-Taps + `PLAY_REVIEW_PASSWORD`) → Card sichtbar → X → weg → Reload → weg →
Logout + erneuter Prüf-Login → Card wieder da (AK3, AK4); kein Demo-Key im localStorage (AK5);
Card-Bounding-Box vollständig im Viewport, X ≥ 44 px Touch-Target (AK6).

`/auth/me` wird bis zum erfolgreichen Prüf-Login als 401 gemockt (Pass-Through-Backend meldet sonst
jeden Besucher als angemeldet) und danach mit `demoHint: true` angereichert — die Umsetzung setzt
`DEMO_HINT_ENABLED=true` ins E2E-Backend (playwright.config.ts env, Phase 4); ab dann kann die
Anreicherung entfallen (Test-Pflege).

## Kein Test (ADR 0001)

Playwright-Config-Env `DEMO_HINT_ENABLED` (Config-Datei), i18n-JSON-Diff, OpenAPI-Schema-Diff.
