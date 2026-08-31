# Issue 1136 — Triage (Phase 1), Stand 2026-08-31

**ERGEBNIS: VERDICT needs-human.** Initial-Triage (kein Harness-Kommentar; einziger Kommentar = ai-quality-Bot 2026-08-30T19:53:34Z, keine Entscheidung). Entscheidungs-Kommentar `<!-- ai-triage-decision -->` gepostet (https://github.com/deleonio/priority-pilot/issues/1136#issuecomment-5473011730) mit 3 Fragen, Labels `ai:needs-analyse` entfernt + `ai:needs-human` gesetzt (Endstand verifiziert). Kein Analyse-Block, keine Routing-Tabelle, kein Titel-/Body-Edit, kein Ping (needs-human-Pfad ist der Entscheidungs-Kommentar).

## Erledigt
- Issue geladen, Trigger als Initial-Triage bestimmt (0 Entscheidungen im Thread).
- Code-Recherche (Recherche-Subagent + eigene Verifikation der tragenden Behauptungen): Google-OAuth-Flow server- und clientseitig gelesen, Profile-Flow-Existenz per grep widerlegt (`onboarding|profilerstellung|profilecreation|firstlogin` → nur EmptyState.tsx/smoke/crud, kein Wizard).
- Root.tsx komplett gelesen (Loading-Logik), App.tsx reload() gelesen (try/finally — App-eigener Loader haengt NICHT), auth.ts komplett gelesen, express/index.ts Passport-Strategie gelesen, LoginPage-Fehler-UI geprüft.

## Relevante Stellen
- `frontend/src/lib/auth.ts:8-20` — `checkAuth()` fetch ohne Timeout; hier kommt die 30-s-Grenze rein (AK-Entwurf O1).
- `frontend/src/Root.tsx:52-88` — `authState='loading'`/`silentPending` Spinner; `.catch()` setzt nur error-State; Zeile 27 prueft bereits `params.has('error')` (tote Verzweigung, s.u.).
- `server/src/express/routes/auth.ts:179` — `failureRedirect: '/auth/error'` (rohes JSON 400, Zeile 136-138) statt `/?error=…` → Fehler-UI unerreichbar.
- `frontend/src/components/LoginPage.tsx:10-16,63-77` — `?error=` + `ERROR_MESSAGES`-Map existieren bereits; nur der Server schickt dorthin nie jemanden.
- `server/src/express/index.ts:170-176` — OAuth-`User.findOrCreate` säät KEINE Säulen; Vorbild-Parität: `auth.ts:53-64` (`/auth/register` säät `SEED_PILLARS` atomar). Einziger Code-Unterschied Sign-in vs Sign-up.
- E2E vorhanden: `frontend/e2e/login.spec.ts`, `auth.spec.ts`, `silent-login.spec.ts` — Neu-Nutzer-Pfad ungedeckt.
- `server/src/models/user.ts` — KEIN `profileComplete`/`isNewUser`-Flag (für O2 bräuchte man eines).

## Annahmen
- Kein endgültiger Hang-Mechanismus am Gerät reproduzierbar — statisch plausibelste Ursache: haengendes `/api/v1/auth/me` ohne Timeout (Root-Spinner). Timeout+Error-Surfacing ist davon unabhängig robust.
-„Ladefunktion" im Issuetext = Lade-Spinner (Root.tsx KolSpin „Authentifizierung wird geprüft …").

## Verworfen
- VERDICT analyzed/spec-ready mit Interpretation A („naechster Schritt" = Dashboard) — zentrale Erwartung „Profil-Einrichtungsfluss" existiert nicht im Code; O1-Bugfix vs O2-Feature ist eine Produktfrage, kein Raterraten.
- App.tsx als Hang-Quelle — reload() hat finally, laeuft nicht in ewigem Loading (App.tsx:144-174).
- Titeländerung („Profile-Erstellung hängt nach Google-Authentifizierung") — trifft zu.
- Split — premature vor der Scope-Entscheidung.

## Offen
- Warte auf menschliche Antwort im Issue (Entscheidung 1: O1 Bugfix vs O2 Feature; Entscheidung 2: Säulen-Paritaet im Ticket oder separat; Entscheidung 3: 30-s-Grenze nur fuer /auth/me-Check, Google-Navigation nicht abbrechbar, Fehler+Retry bei >30 s).

## Nächster Schritt
- Re-Triage nach menschlicher Antwort (Trigger: `<!-- ai-triage-decision -->`-Kommentar + alle Kommentare danach lesen, Entscheidung ist BINDEND): Analyse-Block + Routing-Tabelle in den Harness-Kommentar schreiben (HID existiert noch nicht → create via `gh issue comment 1136 --body-file -`), `ai:needs-human` entfernen, `ai:analysed` + Phase-Trigger je nach Ampel setzen.

## Fallstricke
- Bei O1: `/auth/error`-Route (auth.ts:136-138) wird von E2E/Server-Tests referenziert — failureRedirect auf `/?error=…` umstellen heisst Route + Tests mitdenken (oder Route als API-Fallback behalten).
- Bei O1: `shouldAttemptSilentLogin` (Root.tsx:24-31) bereits auf `?error=` vorbereitet — Silent-Loop-Guards nicht aushebeln.
- Bei Säulen-Paritaet: `findOrCreate` + Säulen-Sähung nicht atomar ohne Transaction — Muster aus auth.ts:53-64 (sequelize.transaction) uebernehmen; Migration fuer bereits existierende OAuth-User ohne Säulen ansprechen (Nachsähung beim Login oder Script).
- E2E fuer Google-OAuth-Flow: kein echter Google-Zyklus in CI — `/auth/test-login` (NODE_ENV=test, auth.ts:236-269) als Praezedenz fuer Session-Erzeugung; frisches sessionStorage/cookie-Setup simuliert „neues Gerät".
- `gh issue edit --body` bleibt verboten (ADR 0009) — alles in den Harness-Kommentar.
