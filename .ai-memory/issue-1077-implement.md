# Issue 1077 — Implement (Phase 4)

## Erledigt
- Spec-PR #1078 (Branch `feat/issue-1077-desktop-notification`) ausgecheckt; `docs/spec/issue-1077.md` existiert nur auf dem BRANCH, nicht auf main (Git ls-files auf main leer).
- Grün-Implementierung: `frontend/src/app.css:1645-1650` — im bestehenden `@media (min-width: 768px)`-Block `.update-prompt { left: auto; max-width: 480px; align-items: flex-end; }` ergänzt (einzige Produktivänderung, +7 Zeilen).
- e2e: `npx playwright test e2e/pwa-update-prompt.spec.ts` → 9 passed, 1 failed — NUR AK1 (`expect(m.left).toBe('auto')`), AK2/AK3 + alle #373/#1034-Tests grün.
- Gate: `pnpm format` ok, `prettier --check .` ok, `pnpm lint` ok (server+frontend), `pnpm knip` ok (nur pre-existing Configuration-Hints), frontend vitest 421 passed/13 skipped, server test: fail 0 aber Exit 1 (t.skip-Anomalie session.test.ts AK-5 Redis, per `git stash` auf sauberem Baum VERIFIZIERT identisch → pre-existing/umgebungsbedingt).
- Verdict not-ready: AK1-Assertion ist per CSSOM unerfüllbar (s. Fallstricke) → Test-Pflege-Bedarf dokumentiert statt Test geändert.

## Relevante Stellen
- `frontend/src/app.css:1611-1624` — Basisregel `.update-prompt` (position:fixed, left/right:0): durch Desktop-Override `left:auto` + `max-width` + `align-items:flex-end` rechts unten auf 480px begrenzt.
- `frontend/src/app.css:1645` — `@media (min-width: 768px)`-Block, Anker der Änderung.
- `frontend/e2e/pwa-update-prompt.spec.ts:229-252` — AK1 (rot, Testdefekt) / AK2 (grün) / AK3 (grün).
- `frontend/e2e/pwa-update-prompt.spec.ts:60-67` — #373-Vertragsstest `position: fixed` (Default-Viewport 1280×720) — der Grund, warum `position: static` als Ausweg ausscheidet.

## Annahmen
- Playwright-Default-Viewport ist 1280×720 (deshalb pinnt der #373-Test `position:fixed` auch auf Desktop). Nicht in der Config gegengeprüft, aber `width < viewportWidth` bei 375px und die #1034-Tests sind grün, d.h. Mobil ist unberührt.
- Proxy-Div ist leer → shrink-to-fit 32px breit; im echten UI (Cards) greift `max-width: 480px`.

## Verworfen
- `position: static` im Desktop-Zweig (einziger Weg, computed `left: 'auto'` zu erreichen) — bricht `position:fixed` (#373 AK1) und das echte Verhalten (Hinweis wäre nicht mehr fixiert).
- `margin-left:auto` statt `left:auto` — bei fixierten Elementen überbestimmt (left/right/width gesetzt), Margins werden ignoriert.
- Testkorrektur an AK1 — Trennungsprinzip: Spec-Tests sind Vertrag; die Korrektur ist als Test-Pflege-Bedarf im PR-Body dokumentiert (file:line + Vorschlag).

## Offen
- AK1 `frontend/e2e/pwa-update-prompt.spec.ts:245` kann durch KEINE CSS-Änderung grün werden → PR bleibt Draft, Folge-Run muss den Test korrigieren.

## Nächster Schritt
- Test-Pflege-Bedarf umsetzen (Spezial-Run mit Testfreigabe): `expect(m.left).toBe('auto')` ersetzen durch rechtsbündig-Metrik, z.B. `expect(m.right).toBe('0px')` + `expect(rect.left).toBeGreaterThan(m.viewportWidth / 2)`; danach PR `gh pr ready 1078`.

## Fallstricke
- CSSOM Resolved-Value-Regel: für `top/right/bottom/left` liefert `getComputedStyle()` bei positionierten Elementen (`fixed`/`absolute`) den VERWENDETEN px-Wert, nur bei `position: static` den String `'auto'`. `left: auto` + `right: 0` ergibt also `1248px` (1280 − 32px shrink-to-fit), nie `'auto'` — eine `toBe('auto')`-Assertion auf einem fixed Element ist unerfüllbar.
- `pnpm test` (recursive) bricht beim Server ab, bevor die Frontend-Vitest laufen → Frontend-Unit-Tests separat per `pnpm --filter frontend test` laufen lassen, sonst fehlt die Abdeckung im Gate-Nachweis.
