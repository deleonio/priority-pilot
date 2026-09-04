# Issue 1211 — Impl (Phase 4), Stand 2026-09-04 (4. Lauf, Fortsetzung)

**ERGEBNIS: Alle 5 groups-e2e GRÜN; Gate läuft.** Danach nur noch commit+push → `gh pr ready 1214`
→ PR-Body erweitern (Implementierungs-Summary + Test-Pflege 4/5/6 + Testergebnisse).

## Erledigt (4. Lauf)
- Frischer Runner: lokale Phasen-Notizen vorm Branch-Wechsel gelöscht (tracked auf Branch),
  `pnpm --filter server build:api` + `pnpm --filter client generate` (generierte Types waren
  stale/fehlten; Nachweis `grep -c '"/groups' server/src/api.d.ts client/src/schema.d.ts` = je 2).
- Test-Pflege 5 (`frontend/e2e/groups.spec.ts` createGroupViaUi, ehem. Zeile 33):
  `waitForStableView(page)` Default ('Dashboard') → `waitForStableView(page, 'Gruppen')` — auf
  /settings/gruppen rendert kein 'Dashboard'. Damit liefen die 3 create-Tests grün.
- **AK8-Layout-Bug BEHOBEN** (echter Fix, kein Test-Problem): Karte maß bei 375px 622px.
  Ursache (per Debug-Spec + shadow-DOM-Inspektion nachgewiesen): KolTabs-Shadow `div.kol-tabs`
  ist `display: grid`; die einzeilig gekappte Beschreibung (`.groups-description`,
  `white-space: nowrap`) bläht die min-content-Breite des Panel-Grid-Items auf → Panel läuft
  aus dem Viewport. Fix in `frontend/src/app.css`: neue Regel `.settings-groups { display: grid;
  grid-template-columns: minmax(0, 1fr); }` (klassischer Grid-Min-Content-Break) — Karte danach
  343px bei 375px-Viewport, Ellipsis greift.
- Test-Pflege 6a (groups.spec.ts AK6-Test, ehem. Zeile 50): `getByRole('tabpanel').
  getByRole('heading', …)` findet das Heading NIE (5s-Timeout, reproduzierbar warm) — KolTabs
  slotet Panel-Inhalt ins Shadow-DOM, slottedes Light-DOM ist im A11y-Baum geschachtelt, DOM-seitig
  aber kein Nachfahre des Tabpanel-Elements. Fix: `page.locator('.settings-groups').
  getByRole('heading', { name: 'Gruppen', exact: true })` (Muster issue-969: Panels über slot).
- Test-Pflege 6b (AK7-Test, ehem. Zeile 91): strict-mode — Karten-Trigger UND Dialog-Schritt-1-
  Button heißen „Löschen"; `showModal()`-Inertness entfernt den Hintergrund-Button NICHT aus der
  Playwright-Locator-Auflösung. Fix: `page.locator('kol-dialog').getByRole('button', { name:
  'Löschen', exact: true })` (Muster pillar-crud.spec.ts:57ff kol-dialog-Scoping).
- `npx playwright test e2e/groups.spec.ts`: **5/5 bestanden (15.8s)**.
- **Voller Gate GRÜN** (gate-runner-Rolle): `pnpm format` / `pnpm exec prettier --check .` /
  `pnpm lint` / `pnpm knip` / `pnpm test` alle exit 0; Server-Suite fail 0 (Session-Test diesmal
  nicht rot), knip nur bekannte Config-Hints. Format-Kollateral: docs/spec/issue-1211.md
  (Tabellen-Alignment) + groups-dataisolation.test.ts (Zeilenumbruch) — semantisch unverändert.
- Commit + Push auf ai/harness/1211, `gh pr ready 1214`, PR-Body erweitert (s. Erledigt 4b).

## Erledigt (3. Lauf — Zusammenfassung)
- Frontend AK6/AK7/AK8 implementiert (GroupsSection/GroupFormDialog/GroupDeleteDialog, SettingsPage
  Tab 4, App SETTINGS_PATH_SEGMENTS 'gruppen', app.css Gruppen-Regeln); Commit `a2a15918` gepusht.
- Test-Pflege 4: openGroupsTab `waitForStableView(page, 'Gruppen')` statt Default.

## Relevante Stellen
- `frontend/src/app.css` — `.settings-groups` (NEU: minmax(0,1fr)-Grid, AK8-Fix) + `.groups-*`-Regeln
  (~Zeile 1220-1290).
- `frontend/e2e/groups.spec.ts` — Vertrag AK6/AK7/AK8, jetzt grün.
- `frontend/src/components/GroupsSection.tsx` — Panel-Inhalt (Heading h2 immer gerendert, Zeile 66).
- `docs/ux-pattern-sequential-confirmation.md` — Schritt-1 „Ja/Nein"-Intent, Schritt-2 Scope.
- Draft-PR #1214 (OPEN, draft) auf Branch `ai/harness/1211`.

## Annahmen
- Test-Pflege 5/6a/6b sind Locator-Technik-Korrekturen (Vertrags-INTAKT: dieselben UI-Zustände
  werden asserted, nur das Auffinden korrigiert); Begründungen je als Kommentar im Spec + im PR-Body.
- AK8-Fix über `.settings-groups` statt Shadow-CSS: KolTabs-Shadow nicht stylbar, minmax(0,1fr)
  koppelt Breite vom Inhalt deterministisch.

## Verworfen
- „cold start"-Hypothese für AK6-Fehlschlag — wiederholtes Einzel-Laufen blieb rot (deterministisch,
  DOM-Slotting-Ursache stattdessen).
- `contain: inline-size` als AK8-Fix — Grid-minmax(0,1fr) ist das etabliertere, side-effect-freiere
  Muster.
- Debug-Spec `e2e/_debug.spec.ts` — Wegwerf-Artefakt, wieder gelöscht (nicht committet).

## Erledigt (4b — Finalisierung)
- Commit `fix(frontend): Gruppen-Panel 375px-tauglich + e2e-Lokatoren korrigiert (#1211)` mit
  app.css, groups.spec.ts, docs/spec/issue-1211.md, groups-dataisolation.test.ts (Format),
  .costs/1211.json + dieser Notiz; gepusht; PR #1214 ready gesetzt + Body erweitert
  (Implementierungs-Summary, Gate-/E2e-Ergebnisse, Test-Pflege 4/5/6a/6b).

## Offen
- -

## Nächster Schritt
- - (Phase abgeschlossen; Review-Phase übernimmt `ai:needs-review`.)

## Fallstricke
- session.test.ts ohne Redis rot (pre-existing, CI hat Redis-Service) — im PR-Body dokumentieren.
- Generierte api.d.ts/schema.d.ts sind gitignored + pro Runner stale — vor Frontend-Arbeit
  regenerieren.
- KolTabs-Panels: NIEMALS `getByRole('tabpanel')`-Chaining für Panel-Inhalt nutzen (Slotting);
  Panels über slot-Attribut oder Panel-Container-Klasse locaten.
- Zweimal „Löschen" (Karte + Dialog Schritt 1) → Dialog-Buttons immer auf `kol-dialog` scopen.
