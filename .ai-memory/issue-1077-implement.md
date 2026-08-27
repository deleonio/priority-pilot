# Issue 1077 — Implement (Phase 4) — RESUME-Lauf 2026-08-27

## Erledigt
- Resume: Branch `feat/issue-1077-desktop-notification` ausgecheckt, PR #1078 weiterhin DRAFT (verifiziert via `gh pr view`: OPEN draft=true). Implementierung unverändert auf dem Branch: Commit `4af6bcb2 fix(frontend): Update-Prompt am Desktop unten rechts mit max-width (#1077)`, `frontend/src/app.css` `@media (min-width: 768px)` → `.update-prompt { left: auto; max-width: 480px; align-items: flex-end; }`.
- AK1-Blocker NICHT blind übernommen, sondern frisch verifiziert: e2e-Lauf `npx playwright test e2e/pwa-update-prompt.spec.ts` (frontend/) → **9 passed, 1 failed**; einziger Fail `frontend/e2e/pwa-update-prompt.spec.ts:245` `expect(m.left).toBe('auto')` (empirisch `left` = px-Wert, nicht `'auto'`). AK2 (`max-width ≤ 480px`) und AK3 (375px vollbreit) grün, #373- und #1034-Tests der Datei grün.
- Gegenprüfung des Auswegs: `frontend/e2e/pwa-update-prompt.spec.ts:59-70` (#373) asserted `getComputedStyle(el).position === 'fixed'` am DEFAULT-Viewport 1280×720, d. h. der Desktop-Zweig des Media-Query ist genau der gemessene Kontext → `position: static` im Desktop-Zweig würde diesen Vertragstest brechen UND die Fixierung real zerstören. AK1-`toBe('auto')` und Fixier-Anforderung sind per CSSOM unvereinbar (Resolved-Value-Regel für `top/right/bottom/left` liefert bei positionierten Elementen den verwendeten px-Wert).
- Test NICHT geändert (Trennungsprinzip, binding in der Run-Anweisung); Test-Pflege-Bedarf steht bereits im PR-Body #1078 (Abschnitt „Test-Pflege-Bedarf", file:line + Vorschlag). Kein neuer Commit nötig — Arbeitsbaum clean, Stand ist der gepushte HEAD.
- Verdict: not-ready — AK1 ohne Testfreigabe unerfüllbar, PR bleibt Draft.

## Relevante Stellen
- `frontend/src/app.css` — `@media (min-width: 768px)`-Block: Desktop-Override `left: auto; max-width: 480px; align-items: flex-end;` (Implementierung fertig, unverändert lassen).
- `frontend/e2e/pwa-update-prompt.spec.ts:238-247` — AK1-Test (rot, Testdefekt); `:249-258` AK2 (grün); `:214` describe-Block #1077.
- `frontend/e2e/pwa-update-prompt.spec.ts:59-70` — #373-Vertragstest `position: fixed` (Default-Viewport 1280×720), der Grund, warum `position: static` keine Lösung ist.
- PR #1078 — Body enthält bereits vollständige Implementierungs-, Gate- und Test-Pflege-Bedarf-Doku; nur noch `gh pr ready 1078` nötig, sobald AK1 korrigiert ist.

## Annahmen
- Playwright-Default-Viewport 1280×720 (deshalb gilt der #373-Fixed-Test auch auf Desktop); aus Testcode abgeleitet, nicht aus playwright.config gelesen.

## Verworfen
- `position: static` / keine Fixierung im Desktop-Zweig — bricht #373-Vertragstest (Zeile 59-70) und das reale Verhalten (Hinweis würde wegscrollen).
- `margin-left: auto` statt `left: auto` — bei fixed Elementen mit `right: 0` überbestimmt, Margins werden zu 0 aufgelöst.
- Testkorrektur an AK1 in DIESEM Lauf — Trennungsprinzip (Run-Anweisung: Spec-Tests sind Vertrag); bedarf eines Spezial-Runs mit Testfreigabe.

## Offen
- AK1 `frontend/e2e/pwa-update-prompt.spec.ts:245` ist durch KEINE CSS-Änderung erfüllbar → PR #1078 muss Draft bleiben, bis der Test korrigiert ist.

## Nächster Schritt
- Spezial-Run mit Testfreigabe: `expect(m.left).toBe('auto')` (Zeile 245) ersetzen durch rechtsbündig-Metrik, z. B. `expect(m.right).toBe('0px')` + `expect(Number.parseFloat(m.left)).toBeGreaterThan(m.viewportWidth / 2)`; danach Gate (`pnpm format && pnpm exec prettier --check . && pnpm lint && pnpm knip && pnpm test`), Commit, Push, `gh pr ready 1078`.

## Fallstricke
- CSSOM Resolved-Value-Regel: `getComputedStyle().left` liefert bei `position: fixed/absolute` den VERWENDETEN px-Wert, nie den String `'auto'` — `toBe('auto')` auf einem fixierten Element ist unerfüllbar; empirisch `left` = `1248px` (1280 − 32px shrink-to-fit des leeren Proxy-Divs).
- `pnpm test` (recursive) bricht am Server (`session.test.ts`, t.skip-Anomalie, Redis nur als CI-Service) ab, bevor Frontend-Vitest laufen — pre-existing/umgebungsbedingt, per `git stash` verifiziert; Frontend-Vitest separat `pnpm --filter frontend test` nachziehen.
- Gezielte Spec-Verifikation direkt `npx playwright test e2e/<datei>.spec.ts` im `frontend/` — `pnpm --filter frontend test:e2e -- <pattern>` filtert nicht.
