# Review PR #1079 — Fixup-Runde 1 (ABBRUCH: Soft-Deadline überschritten, kein Code geändert)

## Erledigt
- MODE=Fixup-Nachweis bestätigt: Sammelkommentar 5447464222 + 2 Inline-Findings (F1=3877339659 @ frontend/src/api.ts:54, F2=3877339664 @ frontend/src/api.test.ts:19), updatedAt 2026-08-28T02:02Z. Keine neueren Kommentare → Delta ist leer, beide Findings offen.
- CI gelesen (Run 33134209076): e2e (2) UND e2e (3) rot. Kein `<!-- ai-review -->`-Kommentar seitdem.
- **F1 reproduziert (lokal, deterministisch in bestimmten Läufen):**
  - `npx playwright test e2e/logout.spec.ts e2e/keyboard-shortcuts.spec.ts` (1. Lauf) → BEIDE Failures exakt wie in CI.
  - `npx playwright test e2e/keyboard-shortcuts.spec.ts:261` allein → **PASS** (5.0s).
  - `npx playwright test --shard=2/4` → AK8 fail identisch zu CI (117 passed, 1 failed).
  - `npx playwright test --shard=2/4 --trace retain-on-failure` → **anderer Test** fail (issue-1051-header-toolbar-mic-align.spec.ts:136 F1), AK8 PASS → Shard 2 ist generell flaky, nicht nur AK8.
  - 2. Lauf beider Specs → **22 passed, 0 failed**.
  - ⇒ Schlussfolgerung: AK8 und logout AK-2 sind **laufzeitabhängige Flakes unter Last** (Order/Shared-State), NICHT bewiesene CSRF-Regression. Der erste kombinierte Lauf reproduzierte sie, die Folgeläufe nicht.
- **Server-Sache verifiziert:** Backend mit E2E-Umgebung gestartet (`PORT=3999 DB_RESET=true DB_SEED=false DATABASE_STORAGE=:memory:`) → `curl /auth/csrf` = **HTTP 200** mit Set-Cookie `csrf=…` und JSON `{"csrfToken":"…"}`. Token-Endpunkt funktioniert, auch ohne Session (Route liegt VOR requireAuth, index.ts:122 vs authRouter-Mount index.ts:185).
- Server-Code verifiziert: Rate-Limiter (`routes/auth.ts:26` max 30, `routes/pillars.ts:154` max 120) und CSRF-Schutz (`index.ts:125-129`) sind via `skip: () => process.env.NODE_ENV !== 'production'` bzw. `if (NODE_ENV === 'production')` in E2E **komplett inaktiv**. Sie können die e2e-Failures also prinzipiell nicht verursachen.
- Frontend-Diff verifiziert (api.ts +38/−1): `ensureCsrfToken()` (fetch `${baseUrl}/auth/csrf`), `client.use({onRequest setzt x-csrf-token bei non-GET/HEAD/OPTIONS, onResponse 403→csrfToken=null})`, `logout()`/`lektorat()` senden Header manuell, logout invalidiert Cache.
- Kein Code geändert. Working tree clean (HEAD 141948a1). Kein Commit nötig → deshalb auch kein Push.

## Relevante Stellen
- `frontend/src/api.ts:45-70` — CSRF-Middleware (F2-Testobjekt); `logout()` ~Z.384, `lektorat()` ~Z.316.
- `frontend/src/api.test.ts:16-19` — Mock hat nur `use: mockUse`, null Assertions (F2-Befund korrekt).
- `frontend/e2e/logout.spec.ts:329-347` — AK-2: `logoutMethod` wird erst IM route-Handler gesetzt, Assertion kommt direkt nach `waitForRequest` → **bekanntes Playwright-Race**: der Request kann beobachtet sein, bevor der Handler lief (empfangen: `Expected "POST" Received null`).
- `frontend/e2e/keyboard-shortcuts.spec.ts:261-291` — AK8: `expect(created).toBeDefined()` an Z.290; Modal schließt auch bei fehlgeschlagenem POST → nicht-differenzierend.
- `frontend/playwright.config.ts` — workers:1, gemeinsame In-Memory-DB über alle Specs eines Shards, `retries: 0`, Backend auf Port 3000, Vite auf 4173.
- `frontend/vite.config.ts:11-38` — Proxy `/api/v1`→streift Präfix, `/auth`→unverändert; erklärt Erreichbarkeit von `/api/v1/auth/csrf`.

## Annahmen
- Flakiness-Ursache ist Last/Shared-State im Shard (Vite-Dev-Server + eine In-Memory-DB + `retries: 0`), nicht die CSRF-Middleware. Beweis dafür steht noch aus — nur die Gegenrichtung (CSRF-Limiter/CSRF-Gate in E2E inaktiv, Token-Endpunkt funktionsfähig) ist belegt.

## Verworfen
- „Rate-Limiter drosselt E2E": widerlegt — `skip: () => NODE_ENV !== 'production'` (auth.ts:27, pillars.ts:155), in E2E nie aktiv.
- „CSRF-Gate blockiert Writes in E2E": widerlegt — `doubleCsrfProtection` nur hinter `if (NODE_ENV === 'production')` (index.ts:125-129).
- „`/auth/csrf` nicht erreichbar / 401/500": widerlegt — curl gegen E2E-artigen Server liefert 200 + Token + Cookie.
- „Flake-vs-Regression durch einzelnen Re-Run entscheiden": verworfen — Re-Runs liefern widersprüchliche Ergebnisse (AK8 fail → pass → pass; dafür issue-1051 fail). Braucht einen systematischen Vergleich Basis-Commit vs HEAD über mehrere Läufe.

## Offen
- F1 ungeklärt: fehlt der direkte Vergleich `git worktree add /tmp/base 345b0aee` + dort `--shard=2/4`/`--shard=3/4` mehrfach laufen lassen. Failt die Basis ebenso → Flakes (Dokumentation im PR-Body + ggf. CI-retry), failt nur HEAD → echte Regression in der Middleware suchen.
- F2 offen: Test-Substanz in `frontend/src/api.test.ts` fehlt vollständig. Vorschlag aus dem Review-Thread: Handler aus `mockUse.mock.calls[0][0]` extrahieren und direkt treiben — (a) `onRequest` mit POST-Request setzt `x-csrf-token`, (b) `onResponse` mit `status: 403` wirft Cache weg → nächster `ensureCsrfToken`-Aufruf fetcht erneut (global fetch stubben), (c) `logout()` invalidiert Cache. Achtung: `csrfToken` ist modul-lokal — `vi.resetModules()` + dynamischer Import nötig, um den Zustand pro Test zurückzusetzen.

## Nächster Schritt
1. F2 zuerst umsetzen (unkontrovers, lokal testbar): Tests in `frontend/src/api.test.ts` für (a) Header, (b) 403-Refetch, (c) Logout-Invalidierung — mit `vi.resetModules()` + dynamischem `await import('./api.js')`, `global.fetch` per `vi.stubGlobal`. Danach GATE (`pnpm format && pnpm exec prettier --check . && pnpm lint && pnpm knip && pnpm test`), commit + push, Thread 3877339664 beantworten + resolve.
2. F1 danach: `git worktree add /tmp/pp-base 345b0aee && cd /tmp/pp-base && pnpm install && npx playwright test --shard=2/4 --shard=3/4` (2-3×). Ergebnis determines: Flake → im PR-Body dokumentieren + `gh run rerun 33134209076 --failed`; Regression → Ursache in api.ts-Middleware suchen. Erst dann Thread 3877339659 schließen.
3. Eigene ai-fixup-decisions-Sammelkommentar NICHT vergessen (Existiert noch nicht; es gibt nur den Kreuzverhör-Sammelkommentar 5447464222 von Runde 1).

## Fallstricke
- `git show <sha> -- frontend/src/api.ts` aus dem `frontend/`-CWD liefert LEEREN Diff (Pfad doppelt präfixt) — immer aus Repo-Root arbeiten.
- `git diff origin/main...HEAD` failt hier mit „no merge base"; den PR-Delta über `git show 141948a1` (einziger Branch-Commit) beziehen.
- Die Failures sind NICHT stabil reproduzierbar: Einzeltest-Run und Wiederholungsläufe sind grün. Nie aus EINEM grünen Lauf schließen, dass es kein Flake ist — und nie aus EINEM roten, dass es eine Regression ist.
- `logout.spec.ts` AK-2 hat ein inhärentes Playwright-Race (Variable wird im route-Handler gesetzt, direkt danach assertiert) — selbst wenn die Middleware unschuldig ist, kann dieser Test so flakieren. Ein Fix wäre, auf die Route-Antwort statt auf `waitForRequest` zu warten; das wäre aber ein Spec-Contract-Change → nur mit Begründung im Thread.
- E2E-Suite: `retries: 0`, workers:1, eine gemeinsame In-Memory-DB → Cross-Spec-Kopplung ist real und erklärt Shard-übergreifende verschiedene Failures (issue-1051 in einem Lauf, AK8 in anderen).
- Bei Fixup: nur gemeldete Findings fixen, keine ungefragten Spec-Umbauten.
