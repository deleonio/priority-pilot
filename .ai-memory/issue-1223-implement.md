# Issue 1223 — Impl-Phase (Phase 4), Stand 2026-09-05 (Soft-Deadline-Abbruch)

**ERGEBNIS: nicht fertig — VERDICT not-ready (PR #1239 bleibt Draft).** Implementierung ist
funktional komplett und verifiziert (API-Tests 3/3 grün, e2e mit fehlerbereinigten Locators
3/3 grün — Beweislauf mit Wegwerf-Kopie), aber der lokale Gate (lint/knit/ganze Testsuite) und
`gh pr ready` fehlen noch. Soft-Deadline (1788625206) war beim Gate-Antritt überschritten →
Commit+Push dieses Standes, Ende des Laufs.

## Erledigt
- Spec-Modus: Draft-PR #1239 (`ai/harness/1223`) ausgecheckt; untracked lokale Memory-Kopien
  waren byte-identisch mit den Branch-Versionen → verworfen, dann `git switch`.
- `server/src/express/routes/groups.ts:529-597` — neuer `GET /groups/:id/tasks` (`GroupTaskDto`,
  `resolveGeoUser`→401, `findMembership`→404, `Op.in` memberIds + `status != Done`, JS-Filter
  `createdById != null && != userId && in memberIds`, DTO exakt Spec-Feldsatz, Sort: recipientName
  `localeCompare(sensitivity:'accent')` → deadline asc (null zuletzt) → id).
- `openapi.yml` — Pfad `/groups/{id}/tasks` (operationId `listGroupTasks`, Tag groups, 200/404)
  + Schema `GroupTask` (required id/title/deadline/status/recipientName/creatorName; deadline
  `date-time nullable`, status `$ref TaskStatus`) hinter `/groups/{id}/members/{userId}`-Block.
- Client generiert: `pnpm --filter client generate` (`client/src/schema.d.ts`, gitignored) +
  `openapi-typescript ../openapi.yml -o src/api.d.ts` im server-Dir (gitignored). Beide NICHT
  committet (ignoriert), Quelle ist openapi.yml.
- `client/src/index.ts:33` — `export type GroupTask = Schemas['GroupTask'];`
- `frontend/src/api.ts` — `getGroupTasks({ id })` analog `getGroupMembers` (Import `GroupTask`).
- `frontend/src/components/GroupDetail.tsx` — State `tasks`, dritter `Promise.all`-Zweig
  (`api.getGroupTasks`), Abschnitt „Füreinander angelegt“ (KolHeading level 4) nach den offenen
  Einladungen: Liste `.group-tasks` mit je div-Zeilen recipient/title/`von {creator}` (Blöcke,
  damit lange Namen umbrechen), Leerzustand `<p class="hint">Noch hat niemand eine Aufgabe für
  ein anderes Mitglied angelegt.</p>`.
- `frontend/src/components/GroupsSection.tsx:33-34,159-179,208` — `detailRefreshTick`-State;
  Klick-Guard von #1212 gesplittet: Bedienelemente unverändert no-op, blanker Klick IM offenen
  Detail (`closest('.group-detail')`) zählt den Ticker hoch statt nichts zu tun, Karte draußen
  togglet wie bisher. `GroupDetail` bekommt `refreshKey={detailRefreshTick}`.
- `frontend/src/components/GroupDetail.tsx` Props um `refreshKey?: number` erweitert; `load`-
  useCallback dep `[groupId, ownRole, refreshKey]`.
- `frontend/src/components/GroupDetail.test.tsx:36-38` — Mock um `getGroupTasks: vi.fn()` ergänzt
  (Test-Pflege: ohne es wirft `api.getGroupTasks` TypeError im try und die #1212-Tests rotten);
  resolves undefined → Array-Verteidigung im Produktionscode → leere Liste. KEINE Assertions
  geändert.
- Verifikation: API-Tests `NODE_ENV=test DATABASE_STORAGE=:memory: pnpm exec tsx --test
  src/express/groups-tasks.api.test.ts` → 3/3 grün (beide Server-tsc + Frontend-tsc grün).
  e2e `npx playwright test e2e/groups-for-each-other.spec.ts` → 1/3 (Details s. Fallstricke);
  mit Wegwerf-Kopie (scoped Locators + expect.poll) 3/3 grün → Produktionsverhalten korrekt.
  Kopie (`e2e/zz-tmp-verify-1223.spec.ts`) wieder gelöscht, NICHT committet.
- `pnpm format` + `pnpm exec prettier --check .` grün (vor diesem Commit).

## Relevante Stellen
- `server/src/express/routes/groups.ts:529` — neuer Endpunkt (Ende der Datei, nach members-Routen).
- `frontend/src/components/GroupsSection.tsx:169` — neuer Click-Guard (Refresh statt no-op).
- `frontend/src/components/GroupDetail.tsx:108-119` — Abschnitt „Füreinander angelegt“.
- `frontend/e2e/groups-for-each-other.spec.ts:129,182-186` — die beiden defekten Locators (s.u.).

## Annahmen
- „Klick auf offene Gruppenkarte frischt Daten auf“ ist die Produktentscheidung, die AK7 e2e
  ohne Test-Änderung erreichbar macht (Test klickt die bereits aufgeklappte Karte und erwartet
  AKTUELLE Daten; Vorher-Verhalten = No-op mit stale Daten). Repo-Präzedenz für „frische Daten“:
  groups-invitations.spec.ts:100 nutzt `page.reload()`.
- AK5-Test war laut Spec-Notiz bereits grün (Fallthrough-404/requireAuth-401) — bestätigt.

## Verworfen
- Polling-Interval in GroupDetail als Frische-Quelle — nicht deterministisch für den e2e-
  Einmal-`count()`, dauerhafte Extra-Requests.
- Remount des Details per key statt `refreshKey`-Prop — würde Suchfeld-Zustand verlieren.
- e2e-Tests selbst umbiegen — verboten (Trennung der Zuständigkeiten); Defekte als Test-Pflegebedarf
  dokumentiert statt geändert.

## Offen
- **Gate nicht gefahren**: `pnpm lint`, `pnpm knip`, `pnpm test` (frontend+server) laufen nach
  diesem Commit; nur format/prettier/tsc/API-Test/e2e sind verifiziert.
- **2 der 3 committeten e2e-Tests bleiben rot (Test-Pflege-Bedarf, nicht Produktfehler):**
  - `frontend/e2e/groups-for-each-other.spec.ts:129` — `getByText(/von /)` ist seitensweit und
    kollidiert mit inaktiven KolTabs-Panels (bleiben gemountet, Memory 2026-08-29): „Säulen“-
    Hints (`pillar-list-description`, „Gib je Säule einen Wert von 0,0 …“) und kol-form-field-
    Hints enthalten „von “ → Strict-Mode-Violation (5 Elemente). Fix: auf
    `.group-tasks` scopen (`page.locator('.group-tasks').getByText(/von /)`).
  - `frontend/e2e/groups-for-each-other.spec.ts:182-186` — derselbe Seitenscope im `.or()`:
    hidden Treffer aus inaktiven Panels haben keine Bounding-Box → „Element 0 muss eine
    Bounding-Box haben“. Zusätzlich Einmal-`count()` (Zeile 185) raced gegen das Neu-Laden des
    Details nach dem Klick (UL_COUNT 0 im Moment der Zählung, Sekunden später Liste da —
    empirisch verifiziert). Fix: Scope + `expect.poll` statt `count()`; damit 3/3 grün
    (Beweislauf mit Wegwerf-Kopie, nicht committet).
- **PR-Body erweitern** (Implementierungssummary, Gate-Ergebnisse, Test-Pflege-Bedarf oben,
  Verhalten-Änderung „Klick auf offene Karte aktualisiert“, Mock-Ergänzung GroupDetail.test.tsx)
  und `gh pr ready 1239` — erst dann VERDICT needs-review.

## Nächster Schritt
- Gate laufen lassen (`pnpm lint && pnpm knip && pnpm test`; server: session.test.ts braucht Redis
  → lokal bekannt rot, Memory 2026-08-29, im PR dokumentieren), PR-Body erweitern + `gh pr ready`.

## Fallstricke
- Server-Tests brauchen `NODE_ENV=test DATABASE_STORAGE=:memory:` — ohne NODE_ENV=test ist
  `/auth/test-login` nicht registriert (auth.ts:258) und jeder Test-Login liefert 401
  (`applyTestAuthEnv` allein reicht NICHT).
- `pnpm --filter frontend test:e2e -- <pattern>` filtert nicht (Memory 2026-08-26) — direkt
  `npx playwright test e2e/<datei>` im frontend-Dir.
- JSX rendert benachbarte `<span>`-Zeilen OHNE Leerzeichen (Snapshot: Empfängername+Titel
  konkateniert) — je eigene Block-Elemente verwenden, nicht Inline-Spans untereinander.
- Knip immer über Root-Skript `pnpm knip` (Memory 2026-09-02); pre-commit lefthook läuft
  automatisch beim Commit.
