# Issue 1142 — Triage (Phase 1), Stand 2026-08-31T04:30:40Z

**ERGEBNIS: VERDICT analyzed, Ampel 🟢.** Initial-Triage (kein Harness-Kommentar, 0 Kommentare insgesamt; Nightly-Bot-Issue app/github-actions mit fertiger Problem/Soll/Messgrößen-Struktur). Analyse-Block + Routing-Tabelle als Harness-Marker-Kommentar erstellt (issuecomment-5473741834), Labels `ai:needs-analyse` entfernt, `ai:analysed` + `ai:needs-impl` gesetzt (Endstand verifiziert). Kein Ping, kein Titel-/Body-Edit, kein Split, kein Auto-Close (Anforderungen offensichtlich nicht erfüllt — die Duplikate existieren noch, per grep belegt).

## Erledigt
- Trigger geprüft: `gh issue view 1142 --json comments` = [] → Initial-Triage.
- Issue-Behauptungen am Code verifiziert: `const login`-Helfer in 8 Dateien, `const register`-Helfer in 5 Dateien, `auth/test-login` in 14 Dateien, SESSION_SECRET/GOOGLE_*-Env-Block in 22 Dateien (je 4 Zeilen), `expectError` wird nur von 2 Dateien importiert (`error-contract.test.ts`, `push.test.ts`).
- `server/src/test/helpers.ts` komplett gelesen: `TestServer`-Interface (Z. 40-43, nur baseUrl+close), `startTestServer` (Z. 45-78) resolved das Objekt → Anhangpunkt für register/login/json. `server/src/express/test-helpers.ts` = nur `expectError` (Z. 12-24).
- Test-Runner geklärt: node:test (`server/package.json:13`), Coverage `test:coverage` mit 90/85/85 für `src/logics/**` (`server/package.json:14`).
- Harness-Kommentar erstellt; Dateien: `.ai-memory/issue-1142-{block,routing,new}.md` (Wegwerf, NICHT committen — nur diese Datei ist die Phasen-Notiz).

## Relevante Stellen
- `server/src/test/helpers.ts:40-78` — TestServer-Interface + startTestServer: Erweiterungsziel AK1 (register/login/json als Instanz-Methoden) + AK2 (applyTestAuthEnv) + AK3 (expectError hierher).
- `server/src/express/test-helpers.ts:12-24` — expectError-Migration AK3; Konsumenten `error-contract.test.ts`, `push.test.ts`.
- Login-Helfer-Dateien (AK4-Umstellung): pillars, pillars-dataisolation, pillars-scope-ak5, auth-avatar, push-test-endpoint, push-dataisolation, pillar-per-user-seed (+ auth.test.ts bleibt lokal).
- Register-Helfer-Dateien: tasks-nearby, geo-config, api-auth-protection, pillar-per-user-seed, routes/llmProviders.
- Inline-test-login (kein Helfer, trotzdem AK4): session-persistence, tasks-title-length, series-title-length, series-generate-all-auth, routes/suggest-pillars, routes/pillar-advisor.
- Env-Block-Muster: `server/src/express/geo-config.test.ts:17-20` (SESSION_SECRET + 3 GOOGLE_*-Zeilen).

## Annahmen
- Nightly-Bot-Issue gilt wie ein Autoren-Issue; die 5 Soll-Punkte sind der verbindliche Scope, keine produktiven Rückfragen nötig.
- Issue-Angabe „14 Dateien mit login-Helper / 7 mit register-Helper" ist leicht unpräzise (grep: 8 lokale login-, 5 lokale register-Helfer; Rest nutzt test-login inline) — für die AKs egal, es zählt das grep-Endkriterium.
- `login(email, password?)`-Signatur aus dem Issue ist an reale Bodies anzupassen: alle geprüften Helfer senden `{ email, displayName }` an /auth/test-login, nie password (verifiziert an pillars.test.ts, suggest-pillars.test.ts, tasks-title-length.test.ts) — in Randbedingungen verankert.

## Verworfen
- Split in mehrere Issues — ein Layer (nur server-Testdateien), ein zusammenhängender mechanischer Refactor, ein PR reviewbar.
- Spec-Phase — kein Produktivcode; rote Tests als Vertrag für Test-Infrastruktur sind nicht sinnvoll (Begründung steht im Analyse-Block; Routing spec=nein).
- UX-Phase — kein UI-Bezug.
- Titeländerung — präzise und korrekt.
- MEMORY.md-Eintrag — kein neuer Fehler, Kriterium nicht erfüllt.

## Offen
- Wegwerf-Artefakte `.ai-memory/issue-1142-{block,routing,new}.md` NICHT committen; `rm` bräuchte Freigabe (Muster aller Vorläufe).

## Nächster Schritt
- Impl-Phase (Label `ai:needs-impl` gesetzt): helpers.ts um register/login/json + applyTestAuthEnv + expectError erweitern, dann die ~20 Dateien mechanisch umstellen, grep-Belege AK4 + `pnpm --filter server test(+)` im PR dokumentieren.

## Fallstricke
- Request-Bodies exakt gleich lassen — `login` sendet `{ email, displayName: email.split('@')[0] }`, NICHT password; Issue-Signatur ist irreführend.
- `auth.test.ts` + `session.test.ts` von der Umstellung ausnehmen (testen den Auth-Vertrag selbst) — AK4 grept sie als erlaubte Ausnahmen.
- Env muss VOR App-Start gesetzt sein: applyTestAuthEnv nur als Ersatz für den 4-Zeilen-Block, Aufrufort bleibt je Datei oben.
- session.test.ts lokal rot ohne Redis (MEMORY 2026-08-27/08-29) — nicht jagen, per CI (Redis-Service) verifizieren.
- Sandbox: Bash-Heredocs mit Backtick-Quotes in ${…}-Konstrukten wurden abgelehnt („expansion obfuscation") → Body-Dateien per Write-Tool bauen, gh mit --body-file (funktionierte).
- Routing-Tabelle: ux nein, spec nein, impl ja/sonnet/high, review ja/sonnet/high — für Folgephasen bindend.
