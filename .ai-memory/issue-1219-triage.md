# Issue 1219 — Triage (Phase 1), Stand 2026-09-05T02:15:42Z

**ERGEBNIS: VERDICT analyzed, Ampel 🟢.** Initial-Triage (kein Harness-Kommentar; einziger Kommentar = github-actions-Qualitätscheck 2026-09-04T17:21:40Z, keine Entscheidungen). Analyse-Block + Routing-Tabelle als neuer Harness-Kommentar erstellt (issuecomment-5548677658), Labels `ai:needs-analyse` entfernt, `ai:analysed` + `ai:needs-spec` gesetzt (Endstand verifiziert). Kein Ping, kein Titel-/Body-Edit („Anzeigenamen selbst festlegen" trifft zu), kein Split (Server+Frontend = ein zusammenhängender AK-Satz, Präzedenz #1083/#1098), kein Auto-Close (`server/src/express/routes/profile.ts` existiert nicht).

## Erledigt
- Issue geladen, Trigger geprüft, Code-Recherche: user-Modell, auth.ts, geoConfig.ts (Router+Validierung), express/index.ts-Mount-Reihenfolge, SettingsPage-Tabs, App.tsx-Kopfzeile, Root.tsx-User-State, api.ts-Client-Wrapping, users.ts.
- Harness-Kommentar mit Block + Routing (ux nein/-/-, spec ja/sonnet/medium, impl ja/sonnet/high, review ja/sonnet/high) erstellt.

## Relevante Stellen
- `server/src/models/user.ts:13,40` — `displayName`-Spalte existiert schon, fällt auf E-Mail zurück; keine Migration.
- `server/src/express/routes/auth.ts:55` — Registrierung setzt `displayName = normalizedEmail` (der gemeldete Bug-Kern).
- `server/src/express/routes/auth.ts:82,234` — `/auth/me` antwortet aus `req.session.user` → PUT /profile muss Session mitschreiben (AK2), sonst bleibt der alte Name.
- `server/src/express/routes/geoConfig.ts` — komplettes Vorbid: Router hinter `requireAuth` (`express/index.ts:200`), `validateGeoConfig`-Muster (Destructuring ignoriert unbekannte Felder), 400 mit deutscher Meldung, `User.update`, 401 via `sendError`, Dev-Pass-Through über `resolveGeoUser` (DEV_USER_EMAIL).
- `server/src/express/index.ts:210` — Mount-Stelle für neuen profileRouter.
- `frontend/src/api.ts:713-722` — `getGeoConfig`/`updateGeoConfig` als Vorlage für `getProfile`/`updateProfile`.
- `frontend/src/components/SettingsPage.tsx` — `SETTINGS_TABS` Index 0 = „Allgemein"; Geo-Block als UI-Vorlage.
- `frontend/src/Root.tsx:53,99` — User-State entsteht einmal aus `checkAuth` und geht als Prop an App; nach PUT braucht es eine Aktualisierungs-Kette (onSaved existiert als Prop an SettingsPage).
- `frontend/src/App.tsx:664` — `KolAvatar _label={user.displayName}` = Kopfzeilen-Anzeige (AK6-Ziel).
- `server/src/express/routes/users.ts` + `openapi.yml:1267ff` — #1212-Nutzersuche (DTO nur id+displayName) liest displayName bereits; dieses Issue ist deren Voraussetzung.

## Annahmen
- Dev-Pass-Through ohne Session: AK5-401 gilt bei aktivem Auth-Kontext; ohne Auth-Kontext (#207) darf /profile wie geoConfig den Entwicklungs-Nutzer bedienen — im Block als Randbedingung verankert.
- `client`-Paket wird aus `openapi.yml` generiert (workspace:*) — Profildto dort ergänzen, Frontend importiert daraus.
- ux=nein begründet im Block (ein Feld nach vorhandenem Muster, Mobile-first-AK schon konkret) — für Folgephasen bindend.

## Verworfen
- needs-human — keine Unklarheit; AKs waren bereits messbar formuliert.
- Split in Server-/Frontend-Issues — ein PR (Präzedenz #1083: zusammenhängender AK-Satz).
- MEMORY.md-Eintrag — kein neuer Fehler/Umweg; Kriterium nicht erfüllt.

## Offen
- `.ai-memory/issue-1219-block.md` ist Wegwerf-Artefakt (Body des gesendeten Kommentars) — NICHT committen; nur diese Datei hier ist die Phasen-Notiz.

## Nächster Schritt
- Spec-Phase (Label `ai:needs-spec` gesetzt): rote Tests für AK1–AK7 — neu `server/src/express/profile.test.ts`, Erweiterung `frontend/src/components/SettingsPage.test.tsx`, neu `frontend/e2e/profile-display-name.spec.ts`.

## Fallstricke
- Session-Pflege ist der zentrale Fallstrick: PUT /profile ohne `req.session.user.displayName = …` besteht AK2 nicht (auth.ts:234 liest Session, nicht DB).
- PUT-Body-Destructuring: unbekannte Felder fallen automatisch raus (AK4); email/passwordHash dürfen nie in `User.update`-Payload landen.
- 60-Zeichen-Grenze: Strings nach `trim()` prüfen, Leer-String (`""`) und 61 Zeichen je eigener 400-Testfall; deutsche Meldung.
- E2E gegen echtes Backend im Dev-Pass-Through: dort KEIN 401 erwarten — 401-Tests als API-Test mit aktivem Auth-Kontext bauen.
- OpenAPI + `client`-Typen mitändern, sonst scheitert der api.ts-Wrapper am Typ-Import.
