## Umfang

Red spec tests + Spec (docs/spec/issue-1077.md) für #1077, dazu die grün-Implementierung.

## Implementierung

- `frontend/src/app.css` (einzige Produktivänderung, +7 Zeilen): im bestehenden `@media (min-width: 768px)`-Block (Zeile 1645) ergänzt:
  `.update-prompt { left: auto; max-width: 480px; align-items: flex-end; }`
  → Desktop (≥ 768px): Hinweis sitzt unten rechts, Container auf 480px begrenzt, Cards schrumpfen auf Inhaltsbreite.
- Mobil (< 768px) unverändert: volle Breite (AK3) und vollflächige Tap-Fläche ≥ 44px (#1034) bleiben grün.
- `UpdatePrompt.tsx` unangetastet — reine CSS-Änderung.

## Abgedeckte Akzeptanzkriterien

- **AK1** — Desktop (1280px): rechtsbündig (`left: auto`) und nicht mehr vollbreit → Test „AK1: .update-prompt ist bei 1280px rechtsbündig …". Die Breiten-Teilbehauptung ist grün (Elementbreite < Viewportbreite); die `left`-Assertion ist ein Test-Defekt, siehe **Test-Pflege-Bedarf**.
- **AK2** — Desktop (1280px): `max-width` gesetzt und ≤ 480px → Test „AK2: … max-width ≤ 480px" ✅ grün.
- **AK3** — Mobil (375px): volle Breite (`left: 0px`, `right: 0px`) ✅ grün.
- **AK4** — Mobile-Bedienbarkeit (Tap-Target ≥ 44px, vollbreit) durch die bestehenden #1034-Testfälle derselben Datei (Dedup) ✅ grün.

Testmuster: CSS-Kontrakt per injiziertem Stellvertreter-Element (wie #373/#1034 in derselben Datei) — der reale SW-Update-Zustand ist in Playwright nicht deterministisch (#353).

e2e-Ergebnis: `npx playwright test e2e/pwa-update-prompt.spec.ts` → **9 passed, 1 failed** (nur der AK1-Testdefekt, s. u.). Alle #373- und #1034-Tests der Datei bleiben grün.

## Test-Pflege-Bedarf

- `frontend/e2e/pwa-update-prompt.spec.ts:245` — `expect(m.left).toBe('auto')` ist per CSSOM **unerfüllbar**, sobald das Element positioniert ist: Für `top/right/bottom/left` liefert `getComputedStyle()` bei positionierten Elementen (hier `position: fixed`) den **verwendeten px-Wert**, nicht den String `'auto'` (nur `position: static` ergäbe `'auto'`). Empirisch: mit der Implementierung ist `left` = `1248px` (1280 − 32px shrink-to-fit des leeren Stellvertreter-Divs) — rechtsbündig ist erfüllt, die Assertion kann es aber nie sein.
- Ausweg `position: static` im Desktop-Zweig scheidet aus: er würde den #373-Vertragsstest `AK1: .update-prompt-Klasse hat position:fixed` (Zeile 60, Default-Viewport 1280×720) brechen und das reale Verhalten (fixierter Hinweis) zerstören.
- **Vorschlag für die Testpflege** (Spezial-Run mit Testfreigabe): die Metrik auf rechtsbündig umstellen, z. B. `expect(m.right).toBe('0px')` plus `expect(m.viewportWidth - (m.left && parseFloat(m.left))).toBeLessThanOrEqual(1)` — oder direkt `rect` verwenden: `expect(rect.left).toBeGreaterThan(m.viewportWidth / 2)` und `expect(rect.right).toBeCloseTo(m.viewportWidth)`.
- Solange der Test nicht korrigiert ist, bleibt der PR **Draft** (AK1 kann durch keine CSS-Änderung grün werden); AK2/AK3/AK4 und die gesamte restliche Datei sind grün.

## Gate-Ergebnisse

- `pnpm format` ✅ · `pnpm exec prettier --check .` ✅ · `pnpm lint` ✅ (server + frontend) · `pnpm knip` ✅ (nur pre-existing Configuration-Hints)
- `pnpm test`: Frontend-Vitest **421 passed / 13 skipped** ✅; Server-Suite `fail 0`, bricht aber mit Exit 1 an `server/src/express/session.test.ts` („AK-5 — Redis-Store") ab — per `git stash` auf sauberem Baum verifiziert **identisch** → pre-existing/umgebungsbedingt (Redis nur als CI-Service), nicht von dieser Änderung verursacht und nicht Fix-Ziel dieses Tickets. Die Frontend-Vitest wurden separat nachgezogen, da der recursive Run am Server abbricht.
- e2e: oben genannter Lauf der betroffenen Spec (`pwa-update-prompt.spec.ts`); keine weitere e2e-Suite vom CSS-Change betroffen.
- KI-UX: KoliBri-Komponenten unverändert (`kol-card`/`kol-button`-Konsum bleibt wie bisher); Layout-Gegenprüfung 375px/1280px erfolgt deterministisch über die CSS-Kontrakt-e2e (beide Viewports messen `left`/`right`/`max-width`/`width`), ein Playwright-MCP-Browser steht in diesem Run nicht zur Verfügung.

## Offene Fragen

- keine — konkreter `max-width`-Wert (480px) als Empfehlung im Issue hinterlegt, Grenze ≤ 480px ist im Test verankert.

Closes #1077
