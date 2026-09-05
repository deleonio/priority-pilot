# Issue 1223 — Spec-Phase (Phase 3), Stand 2026-09-05

**ERGEBNIS: VERDICT ready.** Rote Tests + Spec auf `ai/harness/1223` committet/pushed, Draft-PR
angelegt (Closes #1223). Keine Labels gesetzt, kein Ping.

## Erledigt
- Branch `ai/harness/1223` ausgecheckt (existierte mit Triage-/UX-Memory-Commits); untracked
  lokale Kopien von `issue-1223-triage.md`/`-ux.md` (vom main-Checkout) waren byte-identisch mit
  den Branch-Versionen → verworfen.
- Spec `docs/spec/issue-1223.md` neu (API-Vertrag: Endpunkt, Filter, Feldsatz, Sortierung, 404/401).
- `server/src/express/groups-tasks.api.test.ts` (TF1/TF2 → AK1–AK6): 3 Tests, gelaufen —
  2 rot (`404 !== 200`, Endpunkt fehlt), AK5-Test (Nichtmitglied 404 / anonym 401) bereits grün
  (404 fällt heute vom Express-Fallthrough, 401 vom globalen requireAuth) → bewusst als Guard
  behalten, in PR-Body dokumentiert.
- `frontend/e2e/groups-for-each-other.spec.ts` (TF3/TF4 → AK7/AK8): 3 Tests, NICHT gelaufen
  (Chromium/Backend-Aufwand); rot per Konstruktion — Abschnitt „Füreinander angelegt“ und
  Hinweistext existieren nicht in `GroupDetail.tsx` (ganz gelesen, keine der Ziel-Strings).
- Frontend-`tsc --noEmit` grün, Server-`tsc --noEmit` grün (nach `openapi-typescript`-Generierung
  von `src/api.d.ts` — gitignored, nicht committet), Prettier grün.
- Dedup geprüft: kein bestehender Test berührt `groups/.*/tasks` (grep über server/frontend/e2e).

## Relevante Stellen
- `server/src/express/routes/groups.ts:55-61` — `findMembership` = einzige Sichtbarkeitsschicht;
  neuer `GET /groups/:id/tasks` neben `:237` (members-Muster) implementieren.
- `server/src/express/routes/tasks.ts:100-107` — `loadUserNames` / `groups.ts:235` `displayNameOf`
  (Fallback E-Mail) für `recipientName`/`creatorName`.
- `server/src/express/tasks-created-by.test.ts` — Vorbild des API-Tests (Seeding direkt an Modellen,
  `server.login`, `startTestServer`, `resetDb`).
- `frontend/e2e/groups-foreign-task.spec.ts` — Vorbild des e2e (test-login + eigener Context,
  Gruppe/Einladung über UI/API, Bounding-Box statt scrollWidth).
- `frontend/src/components/GroupDetail.tsx:119,146,168` — Zielort des Abschnitts; Heading level 4,
  Leerzustand-Hinweis als `p`.

## Annahmen
- Response-Feldnamen `recipientName`/`creatorName` (Spec festgelegt, analog-Idee zu #1213s
  `forUserName`/`createdByName`, aber reduzierter Feldsatz ohne IDs) — verbindlich für Impl.
- Leerzustand-Text „Noch hat niemand eine Aufgabe für ein anderes Mitglied angelegt.“ aus dem
  KI-UX-Block als verbindlicher Test-Text übernommen.
- `deadline` im DTO als ISO-String (nullable); Sortierung wie im Analyse-Block konkretisiert
  (case-insensitive Empfänger, deadline null zuletzt, Tie per id).

## Verworfen
- e2e-Task-Anlage über das TaskForm-UI — #1213 deckt das Formular ab (dedup); Übergabe-Aufgabe
  entsteht im e2e direkt über `POST /api/v1/tasks` mit `userId` (Lookup über
  `GET /groups/:id/members`).
- AK5-Test „rot biegen“ (z. B. Status quo 404-Assertion umdrehen) — verboten; Test bleibt als
  echter Verhaltens-Guard grün.
- Unit-Tests für die GroupDetail-Liste — Abschnittsverhalten durch e2e (AK7/AK8) abgedeckt;
  eine zusätzliche Komponenten-Testdatei wäre Redundanz.

## Offen
- -

## Nächster Schritt
- Impl-Phase (Routing: sonnet/high): Endpunkt in `groups.ts` bauen (Spec-Vertrag), openapi.yml +
  Client-Regenerierung, Abschnitt in `GroupDetail.tsx` (KolHeading level 4, ul/li, KolSpin/KolAlert,
  Leerzustand-Text), bis alle Tests grün.

## Fallstricke
- AK5-Test ist heute schon grün (Fallthrough-404/requireAuth-401) — nicht als „fehlgeschlagene
  Rotation“ werten; die anderen beiden API-Tests und alle 3 e2e sind rot.
- Sortierungs-Orakel: Anzeigenamen bewusst „anna …“ vs. „Bob …“ gewählt — byte-weise wäre „Bob“
  zuerst; wer case-sensitiv sortiert, fliegt im AK6-Test.
- AK4-Feldsatz-Assertion ist `Object.keys().sort()` deepEqual — jedes zusätzliche Feld (auch
  `userId`) macht rot; E-Mail-Leak via `raw.includes('@')`.
- e2e: Empfängername steht in Mitgliederliste UND Abschnitt → `getByText(...).first()` nötig
  (strict mode).
- api.d.ts ist generiert/gitignored — tsc läuft erst nach `openapi-typescript ../openapi.yml -o
  src/api.d.ts` im server-Verzeichnis.
