## Erledigt
- Branch `feat/issue-1042-dashboard-start-button` von `main` angelegt (neuer Lauf, kein Draft-Fortsetzungs-Hinweis gesetzt; `remotes/origin/ai/state/issue-1042` ist der Memory-State-Branch, keine Feature-Branch).
- Spec `docs/spec/issue-1042.md` geschrieben (Ziel/Root-Cause/AK1-AK4 aus dem KI-ANALYSE-Block des Issues übernommen, Root-Cause bereits in der Analyse benannt).
- Rote Tests `frontend/e2e/issue-1042-dashboard-start-button.spec.ts` (3 Tests: AK1 mobil-Innenbreite, AK2 desktop-inhaltsbreit+linksbündig, AK3 Touch-Target).
- Lokal gegen echtes Backend verifiziert (`npx playwright install chromium` nötig, war im Sandbox nicht vorinstalliert): AK1 + AK3 GRÜN (Ist-Zustand, Schutz-AK), AK2 ROT (`Expected: < 711, Received: 1185` bei 1280px — Button füllt heute die volle Flex-Breite).
- Bestehender Regressionstest `frontend/e2e/settings-action-buttons.spec.ts` lokal gegengeprüft: bleibt grün (4/4 passed), dient als AK4-Nachweis ohne neuen Testfall.
- Commit `test: rote Spec-Tests für #1042` (2 Dateien), gepusht, Draft-PR **#1044** erstellt (`Closes #1042` bestätigt via `gh pr view --json closingIssuesReferences`).
- Git-Identity im Repo (nicht global) gesetzt: `my-github-action-bot[bot]` + `295279188+my-github-action-bot[bot]@users.noreply.github.com` — war in dieser Sandbox nicht vorkonfiguriert, `git commit` schlug sonst mit "empty ident name" fehl.

## Relevante Stellen
- `frontend/src/app.css:517-521` `.dashboard-next-task-content` — `display:flex; flex-direction:column`, Root Cause für `align-self: stretch` am Button.
- `frontend/src/components/Dashboard.tsx:184-189` — `KolButton _label="Jetzt starten"`, kein neues Klassen-Attribut nötig (Selektor `.dashboard-next-task-content kol-button` reicht, analog #1034).
- `frontend/src/app.css:1441-1452` `.settings-action-btn` — Umsetzungs-Vorbild für die `min-width: 768px`-Regel (#1017/#932).
- `frontend/e2e/dashboard-cards.spec.ts:8-45` — Vorbild für Task-Anlage per `POST /api/v1/tasks` + Cleanup per `afterEach`/`deleteAllTasks`, echtes Backend ohne Mocks.

## Annahmen
- `GET /next` liefert bei mindestens einer offenen Aufgabe zuverlässig eine `nextTask` → Button ist ohne weitere Fake-Mocks (anders als #1017 mit ServiceWorker/Geolocation-Fakes) sichtbar.
- Toleranz 2px (AK1/AK2) und 44px (AK3) folgen dem etablierten Repo-Muster aus `settings-action-buttons.spec.ts`.

## Verworfen
- Kein Komponenten-/Vitest-Test zusätzlich zum e2e — reines CSS-Layout, e2e mit Bounding-Box-Messung ist laut Skill (Schritt 3, „Reines Styling/Layout") ausreichend, analog #1017-e2e-Fokus.

## Offen
- Keine offenen Fragen im Issue-Body vermerkt ("❓ Offene Fragen: keine").

## Nächster Schritt
- Umsetzungs-Phase: CSS-Regel `.dashboard-next-task-content kol-button { align-self: flex-start }` ab `min-width: 768px` (Default `align-self: stretch`) in `frontend/src/app.css` ergänzen, analog `.settings-action-btn` (Zeile ~1441). Kein `Dashboard.tsx`-Change nötig.

## Fallstricke
- Playwright-Browser (`chromium_headless_shell`) war in der Sandbox nicht installiert — `npx playwright install chromium` vor dem ersten Testlauf nötig, sonst bricht die Verifikation mit "Executable doesn't exist" ab (kein Rot/Grün-Nachweis möglich).
- Lefthook-Pre-Commit-Hook läuft `format`/`knip`/`lint` über das GESAMTE Repo (nicht nur die Spec-Phase-Dateien) — kostet ~15s, aber unauffällig; `format` hat die Markdown-Tabelle in `docs/spec/issue-1042.md` automatisch neu ausgerichtet (kosmetisch, kein Inhaltsverlust).
