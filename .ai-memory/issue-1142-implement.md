# Issue 1142 — Implement (Phase 2), ABGESCHLOSSEN 2026-08-31 (Fortsetzungs-Lauf)

## Erledigt
- Direct Mode (kein Draft-PR zu 1142): Branch `ai/harness/1142` von `origin/ai/harness/1142` (Commit 8815a6a3 = main + Triage-Note). **Achtung:** erstes `git switch -c` hatte lokal von main neu aufgesetzt — per `git reset --hard origin/ai/harness/1142` korrigiert (lokal vorhandene Triage-Note war byte-identisch).
- `server/src/test/helpers.ts` erweitert: `applyTestAuthEnv(prefix)` (4 Env-Zeilen, Callback-URL fix), `TestLoginOptions {displayName?, avatarUrl?}`, `TestServer.register/login/json` (Instanz-gebunden, in `startTestServer` erzeugt), modul-level `registerResponse`/`testLoginResponse` (rohe Response) + `registerOn`/`testLoginOn` (assert 201/200 + Cookie via neuem `cookieOf`-Guard statt `!`), `expectError` hierher migriert.
- `server/src/express/test-helpers.ts` GELÖSCHT; Importe in `error-contract.test.ts` + `push.test.ts` auf `../test/helpers.js` umgestellt (AK4).
- 17 Testdateien umgestellt (grep-Beleg AC1/AC2 siehe unten): lokale `login`/`register`/`testLogin`-Helfer gelöscht, Call-Sites auf `server.login(...)`/`server.register(...)`; Env-Blöcke → `applyTestAuthEnv('<prefix>')` (Prefix = alter Secret-Wert ohne `-secret`-Suffix → Env-Werte bleiben identisch).
- Sonderfälle bewusst so gelöst: `pillar-per-user-seed.test.ts` nutzt `registerResponse(server, email, 'password123')` (braucht 201 **und** 409-Assertions, deshalb kein `server.register`); `session-persistence.test.ts` AK1a nutzt `testLoginResponse` (braucht Set-Cookie-Attribute); `auth-avatar.test.ts` nutzt `testLoginResponse` (avatarUrl im Body); `routes/llmProviders.test.ts` nutzt importiertes `registerOn` (2 Server → instanzgebundenes `server.register` reicht nicht); dessen echte `/auth/login`-Helfer bleiben absichtlich (nicht AC1-relevant).

## Relevante Stellen
- `server/src/test/helpers.ts` — zentrale Ablage aller Auth-/Request-Helfer (AK1/AK2/AK3).
- `server/src/express/geo-config.test.ts:40-46` — `getConfig`/`putConfig` als einzige Datei auf `server.json` umgestellt (damit `json` nicht knip-verdächtig ist).
- Verifiziert per grep: `auth/test-login|auth/register` nur noch in `auth.test.ts`/`session.test.ts` (erlaubte Ausnahmen) + `helpers.ts`; `const login = async`/`const register = async` in server/src = 0 Treffer.

## Annahmen
- `login(email, options?)` statt Issue-Signatur `login(email, password?)` — Passwort-Parameter ist für /auth/test-login sinnlos (Triage-Randbedingung); `displayName`-Default = lokaler Teil der E-Mail, push-*-Dateien übergeben explizit `{ displayName: <email> }` (Request-Bodies exakt wie vorher).
- Vollständige fetch-Wrapper-Migration (~34 Wrapper) bewusst NICHT gemacht: kein AK-Messgröße, hohes Verhältnis von Diff zu Nutzwert (FOCUS: keine Nebensachen). `json` ist Teil der API (Soll 1) und wird in geo-config genutzt.
- Coverage-Schwellen (90/85/85) unberührt — kein Produktivcode-Touch.

## Verworfen
- `applyTestAuthEnv` in `auth.test.ts`/`session.test.ts`/`csrf.test.ts`/`auth-passthrough.test.ts` — deren Env-Blöcke sind bewusst Teil des Auth-Vertrags-Setups (eigene Reihenfolge, GOOGLE_ALLOWED_EMAIL); nur AC1/AK4 gefordert.
- Umbau der Set-Cookie-Assertions in session-persistence auf Cookie-Strings — unmöglich, der Test prüft Max-Age/Expires der Response.

## Offen
- -

## Nächster Schritt
- Review-Phase (Kreuzverhör) des PR; knip-Finding `fetchProviderModelsFromUpstream` bleibt main-Aufgabe, nicht Teil dieses PR.

## Fallstricke (Zusatzerkenntnis aus Fortsetzungs-Lauf)
- `server.register(email)` OHNE Passwort: alte lokale Helfer hatten Default `'password123'`; ohne Default lief der Body als `{email}` → 400. Zentral behoben via Default-Parameter in `registerResponse` (`helpers.ts`), Signatur `password?` durchgereicht — Call-Sites blieben unangetastet.

---

## Fortsetzungs-Lauf 2026-08-31 (Erledigt)
- Suite verifiziert: zuerst 2 rot gebliebene Tests (geo-config:88,149 — `register` ohne Passwort → 400); Fix: Default-Passwort `password123` zentral in `helpers.ts` (`registerResponse` + `password?` in `registerOn`/`TestServer.register`).
- Voll-Suite `pnpm --filter server test`: **774 pass / 0 fail / 1 skip**, exit 0 (auch session.test.ts grün in dieser Sandbox).
- Gate komplett (via gate-runner): format ✅ (helpers.ts umformatiert), prettier --check ✅, lint ✅, knip ⚠️ exit 1 **pre-existing** (`llmProviders.ts:223` unused export, Branch-unberührte Datei), root `pnpm test` ✅ exit 0.
- AC-grep-Belege erhoben (0 lokale Helfer; test-login nur auth/session; `/auth/register` nur helpers.ts; 16× applyTestAuthEnv) → PR-Body.
- PR (non-draft, `Closes #1142`) erstellt via `gh pr create --body-file .ai-memory/issue-1142-pr-body.md`.
