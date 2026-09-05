# Issue 1223 — Fixup (Runde 1), Stand 2026-09-05T17:45Z

**ERGEBNIS:** Review-Verdict war `needs-fixup`, aber Sammelkommentar wurde defekt gepostet
(Body = wörtlich `@/tmp/collected.md`, Kommentar-ID 5553487192) und der Inline-Kommentar
3941408434 ebenfalls (`@/tmp/rv-inline.md`) — die Finding-Texte standen NUR in
`.ai-memory/issue-1223-review.md`. Findings von dort + CI übernommen (Review-Marker 5553498798
bestätigt: kein Sammelkommentar-Inhalt, PR #524/#530-Muster).

## Erledigt
- Blocker-Fix in `frontend/e2e/groups-for-each-other.spec.ts`: AK7 (:124 ff.) Locator auf
  `.group-tasks` gescoped (`getByText(/von /)` page-weit = Strict-Mode ×5, KolTabs-Panels bleiben
  gemountet); AK8 (:180 ff.) `.or()`+einmaliges `count()` ersetzt durch scoped
  `.group-tasks .group-task`-Filter + `toHaveCount(1)` (Poll) + boundingBox-Loop über
  [heading, taskEntry]; Helper `createGroupAndInvite`: „Einladen"-Klick auf den
  INVITEE_NAME-listitem gescoped.
- Kollateral-Fix `frontend/e2e/groups-foreign-task.spec.ts` (#1213, gleicher Helper): dito —
  Ursache der CI-Rots in :86/:142: die Shard-DB hält Test-Nutzer anderer Specs vor, Suche
  „Empfängerin" trifft jetzt 2 Konten → 2 „Einladen"-Buttons → Strict Mode. (Beweis: für-each-
  other läuft alphabetisch zuerst und legte ‚Lángename Empfängerin…' an; groups-invitations
  nutzt denselben page-weiten Klick, liegt aber in anderen Shards.)
- Nit `frontend/src/components/GroupDetail.tsx`: `tasks` init `null` + KolSpin-Zweig (Muster
  `members === null`), Leerzustand-Hinweis erst nach Load.
- Nit `server/src/express/routes/groups.ts:562,573`: `memberIdSet = new Set(memberIds)`,
  Filter mit `.has()` statt `memberIds.includes` (O(n·m) → O(n)).
- Gate lokal: prettier --check 4 Dateien ✓, eslint (2 Specs + GroupDetail) ✓, `tsc --noEmit`
  frontend ✓ + server ✓, vitest GroupDetail.test.tsx 10/10 ✓.
- ai-fixup-decisions Kommentar neu angelegt (existierte nicht; Review-Sammelkommentar defekt),
  Nachweis-Tabelle mit 4 Zeilen.

## Relevante Stellen
- `frontend/e2e/groups-for-each-other.spec.ts:43-52,124-133,180-198` — Fixorte Blocker.
- `frontend/e2e/groups-foreign-task.spec.ts:42-52` — Helper-Fix (Kollateralschaden).
- `frontend/src/components/GroupDetail.tsx:18-19,166-169` — tasks-Spin/Leerzustand.
- `server/src/express/routes/groups.ts:561-573` — Set-Lookup im mutual-Filter.
- Review-Thread: GraphQL-ID nötig (REST pull 404 auf Kommentar-Einzelabruf); resolve via
  `resolveReviewThread`.

## Annahmen
- `issue-969.spec.ts:86`-Rot in e2e (3) (`expect(received).toBeTruthy()`) ist flaky/fremd:
  Datei nicht im PR-Diff (Settings-Insets vs. Gruppen-Feature), Review hat sie nicht beanstandet.
  Neuer Verify-Run nach Push entscheidet; falls weiter rot → nächste Runde.
- Server-API-Tests (`groups-tasks.api.test.ts`) laufen lokal wegen fehlender Session/DB-Services
  auf 401 — env-bedingt, Datei-Inhalt des Tests identisch zum Base; CI-verify deckt es ab.

## Verworfen
- Vollständigen e2e-Lauf lokal fahren — Webserver-Boot + Shards > Restbudget; CI ist Gate.
- Phase-Notiz-Commit ohne Fix — alles Grüne war bereits committet, Diff ist rein fixup.

## Offen
- -

## Nächster Schritt
- Nächste Runde: Verifikation per Fixup-Nachweis (✅-Tabelle im ai-fixup-decisions Kommentar)
  + CI e2e (1)/(3) müssen grün sein; issue-969 beobachten.

## Fallstricke
- Review-„Finding-Text" kann leer/defekt sein (`@/tmp/…`-Body) — Findings dann aus der
  Review-Phasen-Notiz + CI rekonstruieren, nicht den Kommentar-Inhalt erwarten.
- e2e-Shard-DB persistiert Test-Nutzer über Specs hinweg (afterEach räumt nur Tasks/Groups) —
  Nutzersuchen müssen auf den eigenen INVITEE-Listenpunkt gescoped werden, sonst Strict-Mode
  ×N, sobald eine zweite Spec denselben Namensanteil nutzt.
- `getByText(/von /)` page-weit ist in dieser App nie streng-fähig (KolTabs hält Panels
  gemountet) — immer auf den Container scopen.
