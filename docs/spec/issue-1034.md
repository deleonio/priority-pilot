# PWA-Update-/Offline-Hinweis: mobile Bedienbarkeit + beschreibende Texte

**Stand:** 2026-08-26
**Issue:** #1034
**Ziel:** Die Aktionsbuttons der `.update-prompt`-Cards (Update, Offline) sind auf Mobile (375 px) eine volle-Breite-Fläche ≥ 44×44 px; Desktop bleibt unverändert. Die Card-Label, Fließtexte und Button-Beschriftungen sind menschlich-beschreibend statt Stichwort.

## Ziel

1. Bei Viewport 375 px ist der Aktionsbutton beider Cards (Update, Offline) ≥ 44×44 px und füllt ≥ 90 % der Card-Innenbreite (WCAG 2.5.8, Muster #996).
2. Bei 320 px läuft kein Kind-Element der `.update-prompt`-Card horizontal aus dem Viewport (Bounding-Box, nicht `scrollWidth` — App-Shell clippt mit `overflow-x: hidden`).
3. Ab 768 px bleibt `.update-prompt` unverändert `position: fixed; bottom: 0px` (keine Desktop-Regression).
4. Update-Card: Card-Label „Neue Version verfügbar", Fließtext „Priority Pilot wurde aktualisiert. Lade die App neu, um die neue Version zu nutzen.", Button-Label „Jetzt neu laden" (statt bisher Label „Update" + Stichwort-Text + Button „Neu laden").
5. Offline-Card: Card-Label „Offline einsatzbereit", Fließtext „Priority Pilot funktioniert ab jetzt auch ohne Internetverbindung.", Button-Label „Verstanden" (statt bisher Label „Offline" + Stichwort-Text + Button „Schließen").
6. Die bestehende Klick-Wirkung bleibt unverändert: Klick auf `pwa-update-reload` ruft `updateServiceWorker(true)`, Klick auf `pwa-offline-close` setzt `offlineReady` auf `false`.

## Vorbedingung

- `UpdatePrompt` rendert `needRefresh=true` bzw. `offlineReady=true` (via `useRegisterSW`-Mock in Vitest, via injiziertes Stellvertreter-Markup in Playwright — der reale Service-Worker-Zyklus ist in Playwright nicht deterministisch reproduzierbar, siehe `pwa-update-prompt.spec.ts:5-13`).

## Schritte

1. **Vitest, `needRefresh=true`:** Card zeigt Label „Neue Version verfügbar", Text „Priority Pilot wurde aktualisiert. Lade die App neu, um die neue Version zu nutzen." und Button „Jetzt neu laden".
2. **Vitest, `offlineReady=true`:** Card zeigt Label „Offline einsatzbereit", Text „Priority Pilot funktioniert ab jetzt auch ohne Internetverbindung." und Button „Verstanden".
3. **e2e bei 375×812:** Stellvertreter-Markup (`.update-prompt` > `kol-card` > Klick-Wrapper-`span[data-testid]` > `kol-button`) injizieren; Button-Host-Bounding-Box ≥ 44×44 px und ≥ 90 % der Card-Innenbreite, für beide Cards.
4. **e2e bei 320×812:** kein Kind-Element von `.update-prompt` überragt `x + width > 321`.
5. **e2e bei 1280×800:** `.update-prompt`-Stellvertreter bleibt `position: fixed; bottom: 0px`.

## Erwartetes Ergebnis

- **AK1** (Mobile Tap-Target): e2e bei 375 px misst Button-Host-`boundingBox()` je Card (Update, Offline) — Höhe/Breite ≥ 44 px, Breite ≥ 90 % der Card-Innenbreite. Rot im Status quo, weil `.update-prompt` keine Media-Query für Button-Breite/Höhe trägt (`app.css:1555-1572`).
- **AK2** (kein Overflow bei 320 px): e2e — alle Kind-Elemente des Stellvertreter-Markups bleiben innerhalb des Viewports (1 px Toleranz).
- **AK3** (Desktop-Regression-Schutz): e2e bei 1280 px — `.update-prompt` bleibt `position: fixed; bottom: 0px` (bestehendes Verhalten aus #373 bleibt erhalten).
- **AK4** (Update-Texte): Vitest — Card-Label, Fließtext und Button-Label wie oben; ersetzt die bisherigen Stichwort-Assertions (Label „Update", Text „Neue Version verfügbar", Button „Neu laden").
- **AK5** (Offline-Texte): Vitest — analog für die Offline-Card; ersetzt die bisherigen Stichwort-Assertions (Label „Offline", Text „App ist offline-bereit", Button „Schließen").
- **AK6** (Klick-Verhalten unverändert): bereits durch bestehende Tests (`UpdatePrompt.test.tsx`, Klick auf `pwa-update-reload`/`pwa-offline-close`) abgedeckt — kein neuer Test nötig (Dedup).

## Test-Pflege-Bedarf

Die folgenden bestehenden Tests in `UpdatePrompt.test.tsx` widersprechen AK4/AK5 (sie prüfen die alten Stichwort-Texte als Card-Inhalt) und wurden durch die neuen AK4/AK5-Tests ersetzt:

- „AK2: zeigt Update-Banner „Neue Version verfügbar" + „Neu laden"" (#353) — „Neue Version verfügbar" wird zum Card-Label (Attribut), nicht mehr Fließtext-Kind.
- „AK4a: zeigt „App ist offline-bereit"" und „AK4b: zeigt … NICHT" (#353) — Text wird durch den neuen Fließtext ersetzt.

## Abgrenzungen

- Keine Änderung an `useRegisterSW`, `updateServiceWorker`, `vite.config.ts` (PWA-Registrierung) — reine Text-/Layout-Änderung an `UpdatePrompt.tsx` + `.update-prompt`-CSS.
- Safe-Area-Insets (`env(safe-area-inset-bottom)`) sind bereits in `app.css:1561` vorhanden — keine neue Anforderung, nur Erhalt (durch AK3 implizit geschützt).
- Farbrollen (`--pp-*`) für die Cards sind nicht Teil der Akzeptanzkriterien (KI-UX-Block nennt sie als offene, nicht-blockierende Frage) — kein Test dafür.

## Referenzen

- Issue #1034 (KI-ANALYSE + KI-UX-Block).
- Verwandt: #373 (KoliBri-Card + Fixierung), #353 (PWA-Update-Fluss), #996 (Mobile-Tap-Target-Muster, `frontend/e2e/issue-996-pillar-row-mobile.spec.ts`).
