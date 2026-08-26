## Erledigt
- Branch `feat/issue-1042-dashboard-start-button` ausgecheckt (Draft-PR #1044, `Closes #1042` bestätigt).
- CSS-Regel in `frontend/src/app.css:523-533` ergänzt: `.dashboard-next-task-content kol-button { align-self: stretch; }`, ab `@media (min-width: 768px)` `align-self: flex-start;` — analog `.settings-action-btn` (`frontend/src/app.css:1442-1450`, #1017). Keine Änderung an `Dashboard.tsx`.
- Rote Tests grün: `npx playwright test e2e/issue-1042-dashboard-start-button.spec.ts` → 3/3 passed (AK1/AK2/AK3).
- Regression geprüft: `npx playwright test e2e/settings-action-buttons.spec.ts` → 4/4 passed (AK4).
- GATE komplett grün: `pnpm format`, `pnpm exec prettier --check .`, `pnpm lint`, `pnpm knip` (nur bestehende Hints), `pnpm test` (Server 684/685 — der eine Fail ist der pre-existing Redis-Integrationstest `server/src/express/session.test.ts:249`, unabhängig von dieser Änderung; Frontend 414/414 grün, 13 skipped unverändert).
- Commit `eb8b30f9` ("fix(dashboard): ..."), gepusht auf `feat/issue-1042-dashboard-start-button`.
- PR-Body von #1044 aktualisiert (Umsetzung, AK-Status, GATE-Ergebnisse dokumentiert), PR mit `gh pr ready 1044` aus dem Draft-Status geholt.
- Git-Identity war in dieser Sandbox NICHT gesetzt (lokal, nicht global) → `git config user.name "my-github-action-bot[bot]"` + `user.email "295279188+my-github-action-bot[bot]@users.noreply.github.com"` gesetzt, sonst schlägt `git commit` mit "empty ident name" fehl (bereits aus Spec-Phase bekannt, hier bestätigt/wiederholt nötig — Identity ist NICHT persistent zwischen Läufen/Checkouts).

## Relevante Stellen
- `frontend/src/app.css:523-533` — neue Regel, Kern der Umsetzung.
- `frontend/e2e/issue-1042-dashboard-start-button.spec.ts` — Akzeptanztests (aus Spec-Phase, unverändert gelassen).
- `frontend/e2e/settings-action-buttons.spec.ts` — Regressionstest für #1017, unverändert gelassen.

## Annahmen
- (aus Spec-Phase übernommen, bestätigt) `GET /next` liefert bei mindestens einer offenen Aufgabe zuverlässig `nextTask`, Button ist ohne Fakes sichtbar — Tests liefen ohne Anpassung durch.

## Verworfen
- `pnpm --filter frontend test:e2e -- <spec-name>` als Filter-Syntax — greift NICHT (pnpm/playwright ignorieren das Argument nach `--`), führt stattdessen die GESAMTE e2e-Suite aus (~10 Min). Für gezielte Verifikation stattdessen `npx playwright test e2e/<datei>.spec.ts` direkt verwenden (im `frontend`-Verzeichnis).
- Von `pnpm format` mitgetriggerte Reformatierung dreier unbeteiligter `docs/kosten-*.md`-Dateien NICHT committet (`git checkout --` rückgängig gemacht) — Fokus strikt auf #1042, kein Nebenrefactoring.

## Offen
- keine

## Nächster Schritt
- keiner — Implementierung abgeschlossen, PR #1044 review-bereit.

## Fallstricke
- `pnpm --filter frontend test:e2e -- <grep-pattern>` filtert NICHT wie erwartet — läuft immer die volle Suite. Für einzelne Specs `npx playwright test e2e/<file>.spec.ts` nutzen (spart ~9 Minuten pro Verifikationslauf).
- Der volle `pnpm test`-Lauf hat einen bekannten, umgebungsbedingten Fail (`server/src/express/session.test.ts` — Redis-Integrationstest, braucht Redis-Service aus CI, in der Sandbox nicht verfügbar). Das ist KEIN Regressions-Anzeichen der eigenen Änderung, aber muss im PR-Body erklärt werden, sonst wirkt das GATE-Ergebnis rot.
