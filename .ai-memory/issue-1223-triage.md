# Issue 1223 — Triage (Phase 1), Stand 2026-09-05T15:13:05Z

**ERGEBNIS: VERDICT analyzed, Ampel 🟢.** Initial-Triage (kein Harness-Kommentar; einziger Kommentar = github-actions ai-quality 2026-09-04T17:22:13Z, keine Entscheidung). Harness-Kommentar erstellt (issuecomment-5552736133) mit KI-ANALYSE-Block + Routing-Tabelle, Labels `ai:needs-analyse` entfernt, `ai:analysed` + `ai:needs-ux-ui` gesetzt (Endstand verifiziert). Kein Ping, kein Titel-/Body-Edit, kein Split, kein Auto-Close (Endpunkt existiert nicht — Routenliste groups.ts geprüft).

## Erledigt
- Issue geladen, Trigger = Initial-Triage; kompletten Body analysiert (Issue ist Teil von #952, baut auf #1213 auf).
- Recherche an Subagenten delegiert (ADR 0008): groups-Routen, Task-Modell, #1213-Verifikation, Frontend-GroupDetail, openapi/Client, Test-Vorbilder — alles bestätigt.
- Harness-Kommentar per `gh issue comment --body-file` (Heredoc, Zeilen Spalte 0) erstellt.
- Labels gesetzt + verifiziert.

## Relevante Stellen
- `server/src/express/routes/groups.ts:55-61` — `findMembership` (einzige Sichtbarkeitsschicht; Nichtmitglied → 404 wie :130); neuer `GET /groups/:id/tasks` hier.
- `server/src/express/routes/tasks.ts:477` — POST /tasks setzt `createdById` (Ersteller) + `userId` (Empfänger); Datenbasis steht (#1213 gemergt).
- `server/src/models/task.ts:67,71,14` — `userId`/`createdById` nullable, `TaskStatus = 'Open'|'In process'|'Done'`.
- `server/src/express/routes/tasks.ts:100-107` — `loadUserNames` → Map (Anzeigenamen-Muster); `groups.ts:235` `displayNameOf` (Fallback email).
- `openapi.yml:1204` — Gruppen-Pfade (Tag `groups`); Client-Regenerierung nötig (`client/package.json` script `generate`, läuft auf `prepare`).
- `frontend/src/components/GroupDetail.tsx:28,204` — neuer Abschnitt „Füreinander angelegt" hier; Daten via `api.*` aus `frontend/src/api.ts` (openapi-fetch).
- `server/src/express/tasks-created-by.test.ts` — Test-Vorbild (User/Group/GroupMember/Task direkt seeden, Alice/Bob/Carol); `groups.api.test.ts` = node:test + fetch + `startTestServer()`.
- `frontend/e2e/groups-foreign-task.spec.ts` — e2e-Vorbild #1213 (echtes Backend, 375px, zweiter Kontext via `POST /auth/test-login`).

## Annahmen
- Sortierung konkretisiert im Analyse-Block: Empfänger-Anzeigename case-insensitive, dann deadline (null zuletzt), dann id — Issue sagt nur „nach Empfänger und innerhalb dessen nach Fälligkeit"; als Randbedingung festgelegt, keine Produktfrage.
- 401 für unauthentifiziert ergibt sich aus globalem requireAuth (`server/src/express/index.ts:237`) — in TF2 mitgetestet.
- Ein PR (Server+OpenAPI+Frontend+Tests), Präzedenz #1083/#1098.

## Verworfen
- Split — ein zusammenhängender AK-Satz, API-Vertrag Teil desselben Features.
- Titel-/Body-Copyedit — „Gruppenübersicht der füreinander angelegten Aufgaben" trifft exakt; Body-Edit ohnehin verboten (ADR 0009).
- needs-human — keine offenen Fragen; #1213-Abhängigkeit erfüllt (Code auf main verifiziert).
- MEMORY.md-Eintrag — kein neuer Fehler, Kriterium nicht erfüllt.

## Offen
- -

## Nächster Schritt
- UX-Phase (Label `ai:needs-ux-ui` gesetzt): Abschnitt „Füreinander angelegt" in GroupDetail (Mobile-first 375px, KolBadge/KolHeading-Muster TaskTree.tsx:126-130 für Für/Erstellt-von).

## Fallstricke
- OpenAPI-Pfad + Client-Regenerierung gehören in denselben PR, sonst fehlen dem Frontend die Typen.
- Keine description/checklist im Response, nie email/passwordHash ausliefern (Datenisolation, Issue-Body begründet es selbst).
- Done-Ausschluss + Selbst-Aufgaben-Ausschluss (userId == createdById) gilt auch für Admins (AK2).
- E2E 375px: Bounding-Box statt scrollWidth am Body (App-Shell clippt overflow-x, Memory 2026-08-24).
- Routing-Tabelle (ux ja/sonnet/medium, spec ja/sonnet/medium, impl ja/sonnet/high, review ja/sonnet/high) für Folgephasen bindend.
