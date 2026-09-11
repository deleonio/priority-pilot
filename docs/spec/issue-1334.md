# Issue #1334 — Home-Schalter zum Dashboard

## Ziel

Aus jeder Ansicht (Aufgaben, Serien, Wald, Einstellungen) führt ein eindeutig als
„Home/Dashboard" erkennbares Bedienelement mit einem Klick/Tap zurück zum Dashboard (`/`).

## Kontrakt

- Der bestehende Logo-Button bleibt der Home-Schalter (`.logo-btn`, `App.tsx:723`,
  Handler `handleLogoDashboard` → `navigate('/')` + `reload()`). Er wird **nicht** ersetzt,
  sondern um ein Home-Icon ergänzt, damit er nicht mehr als reines Markenlogo zählt
  (AK2). Das bestehende Logo-Bild (`/logo/logo.png`) bleibt erhalten — `header-logo.spec.ts`
  (#395/#406/#485) bleibt dadurch unverändert grün (AK4, „bestehender Weg bleibt
  funktionsfähig").
- Home-Icon: Font-Awesome `fa-solid fa-house`, als eigenständiges, dekoratives
  (`aria-hidden="true"`) Element innerhalb des Buttons, konsistent zur Icon-Konvention der
  Kopf-Aktionen (`SEARCH_ICON`/`SETTINGS_ICON` etc., `App.tsx:90-94`). Test-Hook: eine
  CSS-Klasse, die `fa-house` enthält (z. B. `<i class="fa-solid fa-house" aria-hidden="true">`).
- Accessible Name: der Button erhält seinen Namen künftig aus dem i18n-Namespace
  `navigation`, Schlüssel `menu.home` (neu, alle 10 Sprachdateien unter
  `frontend/src/i18n/locales/*/navigation.json`), deutscher Wert unverändert `"Zum Dashboard"`
  (AK5 — der bisherige hartkodierte String `aria-label="Zum Dashboard"` in `App.tsx:723` ist
  **kein** i18n-Wert und verletzt AK5 schon heute).
- Navigation bleibt Router-basiert (`navigate('/')`); nach dem Klick ist der Dashboard-Tab
  (`role="tab"`, Name „Dashboard") `aria-selected="true"` — das gilt auch von `/settings/...`
  aus, wo der Tab-Leiste vor dem Klick nicht im DOM ist (Settings-Ansicht rendert keine
  `KolTabs`, `App.tsx:760`).
- 375px-Viewport: der Home-Schalter bleibt >= 44×44 CSS-Pixel groß, die Kopfzeile bleibt
  einzeilig (Budget bereits ausgereizt, `app.css:287-289`), kein horizontaler Overflow.

## Testfälle

- TF1 (AK1, e2e): von `/aufgaben`, `/serien`, `/wald`, `/settings/allgemein` je einmal auf
  den Home-Schalter klicken → URL `/`, Dashboard-Tab `aria-selected="true"`.
- TF2 (AK2, e2e): Home-Schalter im Banner sichtbar, Accessible Name enthält „Dashboard",
  enthält ein Home-Icon-Element (`fa-house`).
- TF3 (AK3, e2e, 375×812): Trefferbereich >= 44×44 CSS-Pixel, Header-Höhe <= 64px
  (Budget-Grenze aus `mobile-shell.spec.ts`), kein horizontaler Overflow.
- TF4 (AK4): Regression — `header-logo.spec.ts` bleibt unverändert grün (kein neuer Test,
  Gate-Lauf im PR belegt das).
- TF5 (AK5, Vitest): der Schlüssel `menu.home` existiert und ist nicht-leer in jeder
  Sprachdatei unter `frontend/src/i18n/locales/*/navigation.json`.
