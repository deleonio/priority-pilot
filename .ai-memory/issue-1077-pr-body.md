## Umfang

Red spec tests + Spec (docs/spec/issue-1077.md) für #1077. Die Umsetzung folgt.

## Abgedeckte Akzeptanzkriterien

- **AK1** — Desktop (1280px): `.update-prompt` rechtsbündig (`left: auto`) und nicht mehr vollbreit (`getBoundingClientRect().width` < Viewportbreite) → `frontend/e2e/pwa-update-prompt.spec.ts` „AK1: .update-prompt ist bei 1280px rechtsbündig …" (rot, `frontend/src/app.css` hat im `@media (min-width: 768px)`-Block noch kein `left: auto`).
- **AK2** — Desktop (1280px): `max-width` gesetzt und ≤ 480px → Test „AK2: .update-prompt hat bei 1280px ein max-width ≤ 480px" (rot, computed `max-width` ist aktuell `none`).
- **AK3** — Mobil (375px): volle Breite bleibt erhalten (`left: 0px`, `right: 0px`) → Test „AK3: .update-prompt bleibt bei 375px vollbreit …" (Kontrakt-/Regressionstest, aktuell grün; verhindert, dass die Desktop-Änderung die Basisregel beschädigt).
- **AK4** — Mobile-Bedienbarkeit (Tap-Target ≥ 44px, vollbreit) wird durch die bestehenden #1034-Testfälle in derselben Datei abgedeckt (Dedup — kein neuer Test; alle 8 Bestandstests der Datei laufen grün).

Testmuster: CSS-Kontrakt per injiziertem Stellvertreter-Element (wie #373/#1034 in derselben Datei) — der reale SW-Update-Zustand ist in Playwright nicht deterministisch (#353).

Red-Signatur verifiziert: `npx playwright test e2e/pwa-update-prompt.spec.ts` → 2 failed (AK1/AK2), 8 passed.

## Test-Pflege-Bedarf

- keiner — AK3 ist ein neuer Kontrakttest, kein bestehender Test widerspricht den AKs.

## Offene Fragen

- keine — konkreter `max-width`-Wert (480px) als Empfehlung im Issue hinterlegt, Grenze ≤ 480px ist im Test verankert.

Closes #1077
