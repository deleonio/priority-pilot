# Issue 1226 — Spec (Phase 3), Stand 2026-09-06

**ERGEBNIS: VERDICT ready.** Rote Tests + Spec in einem Commit auf `ai/harness/1226`, Draft-PR erstellt (Titel = Issue-Titel wörtlich). AK1–AK6 abgedeckt; Spec-Entscheidung für den Analyse-Randfall dokumentiert (docs/spec/issue-1226.md).

## Erledigt
- Branch `ai/harness/1226` ausgecheckt (vorhanden, trägt Triage+UX-Memory-Commits). Lokal untracked liegende `issue-1226-triage.md`/`-ux.md` mussten nach /tmp/1226notes verschoben werden, damit der Checkout klappt (Dateien liegen auf dem Branch identisch → danach wiederhergestellt).
- AKs aus dem Harness-Kommentar (stand=2026-09-05T23:21:14Z) übernommen; KI-UX-Block (4 offene Fragen, jeweils Empfehlung) in den Frontend-Vertrag der Spec eingearbeitet — die Empfehlungen sind dort als Entscheidungen vermerkt, ohne die roten Tests zu blocken.
- Spec NEU: `docs/spec/issue-1226.md` (Ziel/Datenmodell/API-Vertrag/Frontend-Vertrag/AK→Tests-Tabelle).
- API-Tests NEU: `server/src/express/groups-invite-links.api.test.ts` — 7 Tests: AK1 (201 + Token ≥ 32 + neuer Token je Aufruf; Mitglied 403, Nicht-Mitglied 404), AK2 (öffentliches GET ohne Session mit Feldminimierung: kein `members`, keine E-Mail; 404 unbekannt; 410 bei zurückdatiertem `expiresAt`), AK3 (redeem 401 ohne Session; danach Mitglied `member` per Members-Liste nachgeprüft; 409 Zweit-Einlösen UND 409 bei anderweitig entstandener Mitgliedschaft), AK4 (DELETE als Admin → 204; danach GET und redeem 410; Mitglied-DELETE 403).
- e2e NEU: `frontend/e2e/groups-invite-links.spec.ts` — AK5 (Link per API als Setup, Beitretende in eigenem Context via test-login-Cookie, `/gruppen/beitreten?token=…`: Gruppenname + Einladender + Button, Klick → Erfolgsbestätigung + Mitgliedschaft per API nachgeprüft), AK6 (375 px, Bounding-Box von Button + Karteninhalt ≤ 375, NICHT scrollWidth).
- Rot-Beleg: `tsx --test` läuft und scheitert an `SyntaxError: … does not provide an export named 'GroupInviteLink'` (missing export = legitimer erster Rot-Zustand). Server-`tsc` unbeeinflusst: `server/tsconfig.json` exkludiert `src/**/*.test.ts`; 15 Baseline-Fehler (`../api` nicht generiert) unverändert.
- Dedup: kein bestehender Test zu invite-links (nur #1212-Einladungen) → keine Dubletten, kein Test-Pflege-Bedarf.
- Prettier über alle 3 Dateien gelaufen; Pre-Commit ging durch.

## Relevante Stellen
- `server/src/express/routes/groups.ts` — Muster `findMembership` (Z. 72), Admin-Gate 403, Einladungs-Endpunkte Z. 265–350; Impl baut die 4 Routen hier + öffentlichen Teil-Router.
- `server/src/express/index.ts:198,201` — `app.use('/api/transit', transitRouter)` VOR `app.use(requireAuth)`: Mount-Punkt für das öffentliche `GET /invite-links/{token}` (redeem dahinter, sonst umgeht es die Auth).
- `server/src/models/groupInvitation.ts` + `models/index.ts` — Vorbild für NEU `groupInviteLink.ts` und dessen Registrierung.
- `frontend/src/Root.tsx:145` (`/bahn`-Weiche) und `:109-113` (returnTo) — öffentliche Route + Login-Roundtrip.
- `frontend/src/components/GroupDetail.tsx:212-236` — `Modal`-Bestätigungsmuster für „Ungültig machen".
- `server/src/test/helpers.ts` — `applyTestAuthEnv` (setzt SESSION_SECRET → isAuthActive → 401 ohne Session ist testbar), `startTestServer`, `server.login`.
- `server/src/express/geo-config.test.ts:48` — 401-ohne-Session-Assertionsmuster.
- `frontend/e2e/groups-invitations.spec.ts` — 2-Context-Muster (test-login → Set-Cookie → neuer Context), Bounding-Box-375px-Muster.

## Annahmen
- Token = hex-String aus `crypto.randomBytes` ≥ 32 Zeichen; Tests prüfen Länge ≥ 32 + Eindeutigkeit je Aufruf (Entropie selbst nicht messbar).
- DELETE /invite-links/{id} → 204 (Spec-Entscheidung, AK sagt nur „invalidiert").
- Redeem-DTO `{groupId}`; öffentliches GET `{name, invitedByName}` — Feldnamen als Vertrag in der Spec festgelegt.
- e2e-Beitrittsseite: Erfolgszustand enthält Text „beigetreten" (KI-UX: Erfolg als eigener Zustand) — Impl hält sich an den Spec-Wortlaut.
- API-Tests nutzen `server.login` (auth-aktiv), damit 401/403/404-Unterscheidungen real sind.

## Verworfen
- Test für Admin-Link-Liste (`GET /groups/{id}/invite-links`) — kein AK; die 4 analysierten Endpunkte sind genau AK1–AK4. Listen-UI-Frage in der Spec als Frontend-Vertrag (einmal voll + dann maskiert) ohne API-Test vermerkt.
- Unit-Tests für GroupJoinPage (Vitest) — AK5/AK6 schreiben e2e vor; API-Vertrag deckt die Serverseite.
- 375px-Assertions per scrollWidth — verboten (App-Shell clippt overflow-x:hidden, Memory 2026-08-24).
- Titel-/Body-Copyedit des Issues — verboten (ADR 0009).

## Offen
- Keine blockingen. Die 4 UX-Fragen sind im KI-UX-Block mit Empfehlungen versehen und in der Spec als (abweichbar entscheidbare) Verträge festgehalten.

## Nächster Schritt
- Impl-Phase auf `ai/harness/1226` fortsetzen: `GroupInviteLink`-Modell + 4 Endpunkte (öffentlicher GET-Router VOR `express/index.ts:201`), `/gruppen/beitreten`-Weiche + `GroupJoinPage`, Link-Verwaltung in `GroupDetail`, OpenAPI/Client-Typen — bis die roten Tests grün sind.

## Fallstricke
- redeem MUSS hinter requireAuth bleiben (401 ohne Session), GET davor — beide unter `/invite-links/…`; ein gemeinsamer öffentlicher Router würde redeem öffnen.
- 409 gilt auch, wenn die Mitgliedschaft anderweitig (persönliche Einladung) entstand — transaktionaler Membership-Check (Spec-Entscheidung, Test „Zweit-Einlösen …").
- Widerrufen und abgelaufen → 410 (nicht 404); 404 nur unbekanntes Token.
- `tsx --test`-Rotlauf scheitert schon am Modell-Import — nach Anlegen des Modells laufen die Tests sofort gegen echte 404/SPA-Fallback-Routen (dann echte Assertions rot).
- Phase-Notes auf `ai/harness/1226` sind committed; checkout von main erfordert vorheriges Wegverschieben der lokalen Kopien (untracked-Überlappung).
