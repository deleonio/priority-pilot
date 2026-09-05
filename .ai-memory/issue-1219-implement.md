# Issue 1219 — Implement (Phase 4), Stand 2026-09-05

## Erledigt
- Spec mode: Draft-PR **#1233** (`ai/harness/1219`) aufgegriffen; Branch ausgecheckt (lokale Duplikate der getrackten Triage-/Spec-Notizen auf main waren byte-identisch → `rm`, dann switch).
- Server: `server/src/express/routes/profile.ts` (neu, GET/PUT `/profile`) nach geoConfig-Muster (`resolveGeoUser`-Dev-Pass-Through, sendError, Validierung), Mount `server/src/express/index.ts` neben geoConfigRouter.
- `openapi.yml`: `/profile` (get/put) + `Profile`-Schema; `pnpm --filter client generate` + `pnpm --filter server build:api` (beide Dateien gitignored, nicht versioniert); `client/src/index.ts`: `export type Profile`.
- Frontend: `api.ts` `getProfile`/`updateProfile` (Muster getGeoConfig); neu `frontend/src/lib/profileChanged.ts` (PROFILE_CHANGED_EVENT + notifyProfileChanged, Muster tasksChanged.ts); `Root.tsx` Listener setzt User-State aus dem Event (OHNE checkAuth — s. Fallstricke); `SettingsPage.tsx` tab-0: `KolInputText _label="Anzeigename"` (getProfile-Nachladen, `_maxLength={60}`) + `KolButton _label="Anzeigename speichern"` (`.settings-action-btn`).
- Server-Suite: 825 pass / 0 fail (inkl. #1219-Block AK1–AK5 grün). `SettingsPage.test.tsx`: 22/22 grün (beide #1219-Tests grün).
- E2E AK7 läuft (Chromium-Install + `npx playwright test e2e/profile-display-name.spec.ts`), Ergebnis → Log /tmp/e2e-1219.log.

## Relevante Stellen
- `server/src/express/routes/profile.ts:31-38` — `toProfileDto(user, sessionAvatarUrl)`: avatarUrl nimmt den SESSION-Wert vor (`sessionAvatarUrl ?? user.avatarUrl ?? null`), weil `/auth/test-login` (auth.ts:287) den Avatar NUR in die Session schreibt, nicht in die DB — ohne das ist AK1 (deepEqual mit avatarUrl) unerreichbar.
- `server/src/express/routes/profile.ts:78-80` — Session-Pflege `req.session.user.displayName = displayName` (AK2); Destructuring nur `displayName` (AK4).
- `frontend/src/components/SettingsPage.tsx` (tab-0 top, vor `<AppearanceSetting />`) — Feld + Button OHNE `.settings-switch-row` (deren e2e-Guard zählt genau 3 Zeilen, #971); `.settings-action-btn` für Mobil-Vollbreite.
- `frontend/src/Root.tsx` (AuthenticatedApp) — Event-Listener `PROFILE_CHANGED_EVENT` → `setUser(... displayName)`.
- `frontend/src/lib/profileChanged.ts` — Fenster-Event statt Props-Kanal (Präzedenz TASKS_CHANGED_EVENT).

## Annahmen
- onSaved-Kette (App.tsx:427 `afterSettingsSaved` → closeSettings + pillar-reload) lädt den User NICHT neu — das Kopfzeilen-Update läuft deshalb über das Profil-Event mit dem Namen aus der PUT-Antwort. Im e2e ist `/auth/me` zudem von der Fixture gemockt („Test User"), ein checkAuth-Refresh würde den alten Namen zurückschreiben.
- `pnpm --filter server test` lief 1× skipped (schon vorher vorhanden, kein #1219-Test).

## Verworfen
- checkAuth-Refresh nach dem Speichern (Spec-Annahme „onSaved-Kette lädt Root neu") — Kette existiert nicht so; und das gemockte /auth/me im e2e würde den neuen Namen überschreiben → Event mit PUT-Echo stattdessen.
- Eigene CSS-Klasse für die Zeile — `.settings-general` ist flex-column mit gap; Feld + Button als direkte Kinder genügen (mobil gestapelt, kein Overflow).

## Offen
- E2E-Ergebnis steht noch aus (läuft im Hintergrund); PR-Body + `gh pr ready` danach.

## Nächster Schritt
- Gate (format/prettier/lint/knip/test) via gate-runner, Commit+Push inkl. Phasen-Notiz, PR #1233 review-ready + Body erweitern.

## Fallstricke
- AK1-Avatar: session-first (siehe oben) — wer nur die DB liest, bleibt mit deepEqual rot.
- api-Mock in SettingsPage.test.tsx: `updateProfile` wird per Proxy erst beim ERSTEN Zugriff erzeugt (apiDefaults hat keinen Eintrag) → resolves `undefined` → `.then((profile) => profile.displayName)` crasht und onSaved bleibt aus. Defensiv: `typeof profile?.displayName === 'string' ? profile.displayName : trimmed`.
- `getProfile`-Mock-Stem im describe-beforeEach greift nur, weil frühere Renders denselben Proxy-Cache bereits befüllt haben — Komponente muss `api.getProfile()` UNBEDINGT beim Mount aufrufen (Muster getGeoConfig), sonst ist der Mock beim ersten #1219-Test ungestemmt.
- KoliBri-Prop heißt `_maxLength` (nicht `_max_length`).
- e2e: Backend im Pass-Through (Auth aus) → PUT bedient dev@local; die Kopfzeilen-Assertion funktioniert nur über das PUT-Echo (Event), nicht über /auth/me.
