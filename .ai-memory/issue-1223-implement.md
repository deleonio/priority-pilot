# Issue 1223 — Impl-Phase (Phase 4), Stand 2026-09-05 (Fortsetzungs-Lauf: fertig)

**ERGEBNIS: VERDICT needs-review.** Implementierung komplett, Gate vollständig grün,
PR #1239 aus dem Draft genommen und Body um Implementierungs-Summary erweitert.

## Erledigt
- Implementierung (Vorlauf, Commit c915015c): `server/src/express/routes/groups.ts:529-597`
  neuer `GET /groups/:id/tasks`; `openapi.yml` Pfad+Schema `GroupTask`; `client/src/index.ts:33`
  Typ-Export; `frontend/src/api.ts` `getGroupTasks`; `GroupDetail.tsx` Abschnitt
  „Füreinander angelegt" + `refreshKey`-Prop; `GroupsSection.tsx` Klick auf offene Karte
  zählt `detailRefreshTick` hoch (Refresh statt No-op); `GroupDetail.test.tsx:36-38` Mock
  `getGroupTasks: vi.fn()` ergänzt (resolves undefined → Array-Verteidigung → leere Liste).
- Fortsetzungs-Lauf (dieser): Branch `ai/harness/1223` ausgecheckt (lokale untracked
  Memory-Kopien waren byte-identisch mit Branch → verworfen); ESLint-Fix
  `GroupDetail.tsx`: `refreshKey` aus `load`-Deps (`[groupId, ownRole]`) in den Reload-Effekt
  (`[load, refreshKey]`) verschoben.
- Gate VOLLSTÄNDIG grün: `pnpm format` ✅, `prettier --check .` ✅, `pnpm lint` ✅ (Warning weg),
  `pnpm knip` ✅ (nur Configuration hints = bekannter Zustand main), `pnpm test` ✅
  (frontend 57 Testdateien/579 Tests passed, server 274 passed/0 fail, test:scripts inklusive).
- Generierte Dateien in dieser Sandbox neu erzeugt (gitignored, NICHT committet):
  `pnpm --filter client generate` + server `openapi-typescript ../openapi.yml -o src/api.d.ts`
  — ohne Regeneration rotet frontend-tsc an `client/src/index.ts(34)` (`GroupTask` fehlt).
  Wichtig für Folge-Läufe in frischen Sandboxes: erst regenerieren, dann lint/test.
- PR #1239: Body um Implementierungs-Summary + Gate-Ergebnisse + Test-Pflege-Bedarf erweitert
  (`gh pr edit --body-file`), dann `gh pr ready 1239`. Phase-Notiz im Impl-Commit mitgecommittet.

## Relevante Stellen
- `server/src/express/routes/groups.ts:529` — Endpunkt (Sort: recipientName localeCompare
  sensitivity:'accent' → deadline asc, null zuletzt → id).
- `frontend/src/components/GroupsSection.tsx:169` — Click-Guard (Refresh statt No-op).
- `frontend/src/components/GroupDetail.tsx` — `load`-Deps `[groupId, ownRole]`, Effekt
  `[load, refreshKey]`; Abschnitt „Füreinander angelegt" mit Block-Zeilen (keine Inline-Spans).
- `frontend/e2e/groups-for-each-other.spec.ts:129,182-186` — defekte Locators (s. Offen).

## Annahmen
- „Klick auf offene Gruppenkarte frischt Daten auf" ist die Produktentscheidung, die AK7 e2e
  ohne Test-Änderung erreichbar macht. Repo-Präzedenz für „frische Daten":
  groups-invitations.spec.ts:100 nutzt `page.reload()`.
- e2e-Verifikation aus dem Vorlauf gilt weiter (Beweislauf mit Wegwerf-Kopie 3/3 grün,
  `zz-tmp-verify-1223.spec.ts` gelöscht); im Fortsetzungs-Lauf nicht erneut gefahren —
  bekanntes Ergebnis wäre 1/3 (2 Test-Defekte, kein Produktfehler).

## Verworfen
- e2e-Tests selbst umbiegen — verboten (Trennung der Zuständigkeiten); Defekte als
  Test-Pflege-Bedarf im PR-Body dokumentiert.
- Remount per key statt `refreshKey`-Prop — würde Suchfeld-Zustand verlieren.
- Subagent-Delegation (gate-runner/recherche) — Rollen fallen in dieser Umgebung mit
  `API Error 400 modelCode does not exist` (glm-5.3-flash) aus; Gate direkt gelaufen.

## Offen
- `.ai-memory/issue-1223-pr-body.md` = Wegwerf-Artefakt (PR-Body-Zusammensetzung), NICHT
  committen. Diese Datei hier ist die echte Phasen-Notiz.
- 2 der 3 e2e-Tests rot wegen TEST-Defekten (im PR-Body als Test-Pflege-Bedarf dokumentiert,
  Fix-Vorschlag jeweils dabei): `groups-for-each-other.spec.ts:129` `getByText(/von /)`
  seitensweit (KolTabs-Panels bleiben gemountet) → auf `.group-tasks` scopen;
  `:182-186` `.or()`-Treffer ohne Bounding-Box aus inaktiven Panels + Einmal-`count()` raced
  gegen Neu-Laden → Scope + `expect.poll`.

## Nächster Schritt
- Review-Phase (Kreuzverhoer) über `ai:needs-review`; auf Findings mit Fixup-Läufen reagieren.

## Fallstricke
- Server-Tests brauchen `NODE_ENV=test DATABASE_STORAGE=:memory:` — ohne NODE_ENV=test ist
  `/auth/test-login` nicht registriert (auth.ts:258). (Voller `pnpm test` lief diesmal auch
  mit session.test.ts grün durch — Redis-Falle aus MEMORY 2026-08-29 griff nicht.)
- `pnpm --filter frontend test:e2e -- <pattern>` filtert nicht (Memory 2026-08-26) — direkt
  `npx playwright test e2e/<datei>` im frontend-Dir.
- In frischer Sandbox vor lint/test die generierten Schema-Dateien regenerieren (s. Erledigt).
