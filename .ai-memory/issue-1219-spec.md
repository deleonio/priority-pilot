# Issue 1219 — Spec (Phase 3), Stand 2026-09-05

## Erledigt
- Branch `ai/harness/1219` fortgeführt (Triage-Notiz war dort bereits getrackt; lokale Duplikat-Datei auf main gelöscht, dann gewechselt).
- Spec `docs/spec/issue-1219.md` erstellt (AK1–AK7, profileRouter-Vertrag, Settings-Feld, e2e).
- Rote Tests: `server/src/express/profile.test.ts` (AK1–AK5; lokal gelaufen — AK1–AK4 rot mit 404≠200/400, AK5 grün, weil der Auth-Gate unbekannte API-Pfade ohne Session schon mit 401 beantwortet), Erweiterung `frontend/src/components/SettingsPage.test.tsx` (AK6, 2 neue Tests in describe „SettingsPage – #1219: Anzeigename (Allgemein)" — beide rot, 20 bestehende grün), neu `frontend/e2e/profile-display-name.spec.ts` (AK7, Muster settings-tabs.spec.ts; NICHT lokal ausgeführt — Chromium-Install gespart, tsc über frontend inkl. Spec ohne Fehler).
- Verbindlich gepinnte UI-Labels: `kol-input-text[_label="Anzeigename"]`, `kol-button[_label="Anzeigename speichern"]`.

## Relevante Stellen
- `server/src/express/routes/profile.ts` (neu) — Vorbild `routes/geoConfig.ts` inkl. Dev-Pass-Through.
- `server/src/express/routes/auth.ts:234` — `/auth/me` liest Session → PUT muss `req.session.user.displayName` mitschreiben (AK2-Kern).
- `server/src/express/routes/auth.ts:249` — `/auth/test-login` nimmt displayName+avatarUrl; genutzt in AK1 via `server.login(email, {displayName, avatarUrl})`.
- `server/src/logics/auth.js` `verifyPassword` — AK4 prüft damit, dass passwordHash unangetastet bleibt.
- `frontend/src/api.ts:713-722` — getGeoConfig/updateGeoConfig als Wrapper-Vorlage für getProfile/updateProfile.
- `frontend/src/components/SettingsPage.test.tsx` — api-Proxy mit gecachten Mocks (`apiMocks.getProfile`/`updateProfile` stemmen).
- `frontend/src/App.tsx:664` — KolAvatar `_label={user.displayName}` = AK6-Kopfzeilen-Ziel; Refresh via bestehende onSaved-Kette (Root → checkAuth).

## Annahmen
- 60-Zeichen-Grenze nach `trim()`; „   " gilt als leer (Testfälle festgehalten).
- PUT-Antwort 200; Body-Form freigegeben (Tests asserten nur Status + Folgezustand).
- AK5 bleibt auch nach Implementierung grün — er ist Guard (401 bei aktivem Auth), kein Rot-Indikator.

## Verworfen
- e2e-Ausführung im Spec-Lauf (Chromium-Install pro Sandbox, Memory 2026-08-20) — Muster 1:1 von settings-tabs.spec.ts übernommen.
- AK6 über neue `user`-Prop an SettingsPage — stattdessen getProfile-Load (getGeoConfig-Muster), keine Props-Änderung nötig.

## Offen
- —

## Nächster Schritt
- Impl-Phase (sonnet/high): profileRouter nach geoConfig-Muster bauen, Session-Pflege nicht vergessen, openapi.yml + client-Typen, api-Wrapper, Settings-Feld + onSaved-Kette; alle AK-Tests grün.

## Fallstricke
- Session-Pflege (auth.ts:234): PUT ohne `req.session.user.displayName = …` besteht AK2 nicht.
- AK4: Destructuring `{displayName}` im PUT — email/passwordHash dürfen nie ins `User.update`.
- Feldschutz prüft die DB (`User.findOne` + `verifyPassword`), nicht nur die Antwort.
- E2E im Dev-Pass-Through: kein Login nötig; Kopfzeilen-Assert über `.app-header__user` toContainText (Playwright pierct offenes Shadow-DOM).
