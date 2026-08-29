# Issue 1098 — Implement (Lauf 6, Fortsetzung), Stand 2026-08-29

**ERGEBNIS: VERDICT not-ready — Soft-Deadline überschritten (vor Voll-Gate). Alle 3 offenen e2e-Fehler (Lauf 5) behoben und lokal GRÜN: 10/10 e2e (1098+1066), 16/16 Server-Geo-Tests, 39 betroffene Frontend-Unit-Tests. Offen: Voll-Gate (format/prettier/lint/knip/pnpm test) auf dem NEUEN Stand, ggf. volle e2e-Suite, `gh pr ready 1103` + PR-Body.** PR #1103 bleibt Draft.

## Erledigt
- **Lauf-6-Fix 1 (AK7 e2e rot): Server-Route hat im Dev-/Pass-Through-Modus 401 geliefert.**
  `server/src/express/routes/geoConfig.ts`: `resolveGeoUser(req)` — Session-Nutzer per `getUserId`, sonst bei `!isAuthActive()` (Issue-#207-Pass-Through, in E2E aktiv weil playwright.config SESSION_SECRET etc. leert) gemeinsamer Dev-Nutzer `dev@local` (findOne → create, Unique-catch). Unit-Tests bleiben grün, denn geo-config.test.ts setzt SESSION_SECRET/OAuth-Env → `isAuthActive()=true` → 401-Pfad unverändert. Bonus-Fix: alter `userId === null`-Check war tot (getUserId liefert `undefined`) — 401 kam bisher nur über `findByPk(undefined)→null`.
- **Lauf-6-Fix 2 (AK1/AK3 e2e rot): `_disabled`-Attribut fehlte im Browser.** Ursache: `@public-ui/react-v19`-Adapter (`attachProps`) setzt nur STRING-Props zusätzlich als Host-Attribut; Booleans nur als Property. jsdom-Unit-Tests sahen das Attribut, weil React dort (Element nicht upgegraded) den Attribut-Pfad nimmt — Browser nicht. Fix: `const geoDisabled = geoEnabled ? undefined : ('true' as unknown as boolean);` in SettingsPage (String 'true' ist truthy-deaktiviert; via key-Remount kein stale Attribut beim Einschalten). Typ ist streng `DisabledPropType = boolean` → Cast nötig, kommentiert.
- **Lauf-6-Fix 3 (1066 AK4 e2e rot): Denied-Case unmountete die Card.** Dashboard-Hook-Instanz kippte bei Browser-Verweigerung auf `enabled=false` → `{geoEnabled && <NearbyCard/>}` riss die Card weg, bevor sie `nearby-denied` zeigen konnte. Fix: `{(geoEnabled || geoDenied) && <NearbyCard />}` in `frontend/src/components/Dashboard.tsx` (Verweigerung ≠ Präferenz aus; Card zeigt ihren eigenen Ablehn-Hinweis).
- **SQLite-Warnungs-Regression vermieden:** `User.findOrCreate` (verwaltete Transaktion) produzierte „cannot commit/rollback — no transaction is active"-Warnings auf der einzigen `:memory:`-Verbindung (stash-Gegenprobe: 0 ohne, 17 mit Änderung). → findOne+create ohne Transaktion; danach 10/10 e2e mit 0 Warnungen.
- Verifikation des Lauf-6-Stands: `npx playwright test e2e/issue-1098-geo-settings.spec.ts e2e/issue-1066-nearby-card.spec.ts` → 10 passed; Server `NODE_ENV=test DATABASE_STORAGE=:memory: npx tsx --test src/express/geo-config.test.ts src/express/tasks-nearby.test.ts` → 16/16; `npx vitest run` SettingsPage/useGeolocation/Dashboard/App(+NearbyCard-Datei existiert nicht) → 39 passed, 4 skipped.
- Lauf-5-Gate (vor Lauf-6-Änderungen): format ✓, prettier --check ✓, lint ✓ (inkl. tsc), knip exit 0 (nur bekannte Configuration hints), pnpm test: server 741/742 (session.test.ts pre-existing rot ohne Redis, Memory 2026-08-27), frontend 456 passed/13 skipped.

## Relevante Stellen
- `server/src/express/routes/geoConfig.ts` — `resolveGeoUser` (Dev-Fallback `dev@local`, DEV_USER_EMAIL-Konstante); GET+PUT nutzen sie, 401 nur wenn `null`.
- `frontend/src/components/SettingsPage.tsx:186` (nach useGeolocation-Destruktur!) — `geoDisabled`; MUSS nach `geoEnabled`-Deklaration stehen (TDZ-Fehler sonst, Lauf 6 zwischenstand).
- `frontend/src/components/Dashboard.tsx:87,230` — `permissionDenied: geoDenied` + Rendern-Bedingung `(geoEnabled || geoDenied)`.
- `node_modules/@public-ui/react-v19/dist/index.mjs` (attachProps) — Referenz fürs String-Prop-Attribut-Verhalten; KoliBri beobachtet Host-Attribute NICHT (nur hydrated-Klassen-MutationObserver).

## Annahmen
- Dev-Fallback-Nutzer ist mit der #207-Pass-Through-Konvention vereinbar („kein Gate, keine Nutzer-Bindung"; analog leerer ownerScope). Dev-Mode nearby-Filter liest weiterhin `getUserId` → ignoriert Dev-Nutzer-Config (Default 5 km) — nur Dev/E2E relevant, im PR-Body dokumentieren.
- E2e-Verschmutzungsfreiheit: `workers: 1`, `fullyParallel: false`, Datei-Reihenfolge alphabetisch → 1066 läuft vor 1098; nur diese zwei Specs nutzen „nearby" → AK7s 26-km-Schreibstand kann nichts mehr infizieren.
- PUT feuert je onChange (Range-Slider ggf. mehrfach PUT) — bekanntes Muster aus Lauf 5, PR-Body.

## Verworfen
- `User.findOrCreate` — Transaction-Warnings (s. Erledigt).
- `_disabled` per ref/toggleAttribute — String-Pfad des Adapters ist derselbe Mechanismus, auf dem `_label`-Selektoren beruhen; kein Typ-Import nötig, KoliBri-tauglich.
- PUT-Validierung vor Auth-Check umordnen — 401-vor-400-Semantik des Originals erhalten.

## Offen
- Voll-Gate auf dem Lauf-6-Stand: `pnpm format`, `prettier --check .`, `pnpm lint`, `pnpm knip`, `pnpm test` (server session.test.ts erwartet rot ohne Redis — dokumentieren, nicht fixen), ggf. volle e2e-Suite (`cd frontend && npx playwright test`, ~10 min).
- Danach: `gh pr ready 1103` + PR-Body erweitern (Implementierungs-Zusammenfassung inkl. Lauf-6-Fixes, Testergebnisse, Test-Pflege-Bedarf aus Lauf 5: App.test.tsx-Mock + PillarList/LlmSettings-Defensiv-Fixes, Dev-Mode-Limitierung nearby-Filter).
- CSS für `.geo-range-field`/`.geo-range-value` ggf. ergänzen (noch ungestylt, funktional — Lauf 5).

## Nächster Schritt
- Voll-Gate laufen lassen (Reihenfolge s. Offen), dann `gh pr ready 1103` + PR-Body-Erweiterung; VERDICT needs-review.

## Fallstricke
- `geoDisabled` VOR der useGeolocation-Destruktur definieren → TDZ-ReferenceError (schon passiert, behoben — nicht wieder einbauen).
- Server-Geo-Tests STANDALONE brauchen `NODE_ENV=test DATABASE_STORAGE=:memory:` (package.json-Script setzt sie; ohne sie „no such table"-artige Errors, keine Code-Fehler).
- Pre-Commit-Hook läuft `tsc --noEmit` (Frontend-Workspace) — rote Typen blockieren den Commit (Memory 2026-08-23).
- Frischer Runner: `git config user.name/email` aus `git log -1 --format=%an/%ae` vor erstem Commit (Memory 2026-08-23).
- Ungetrackte Wegwerf-Artefakte in `.ai-memory/` NICHT committen — nur triage/ux/spec/implement sind Phasen-Notizen. Auf main liegen aktuell UNTRACKED Kopien der Notizen (Branch hat die committeten Identische; /tmp/ai1098-backup/ hält Sicherheiten).
