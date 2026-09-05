# Issue 1223 — Review-Phase (Kreuzverhör, Runde 1), Stand 2026-09-05

**ERGEBNIS: VERDICT needs-fixup.** Review 5122197395 (body, 🔴), Inline-Kommentar 3941408434 an
`frontend/e2e/groups-for-each-other.spec.ts:129`, Sammelkommentar `<!-- ai-review -->` = issuecomment
5553487192. PR-Titel per Titel-Gate auf `feat(frontend): list tasks created for fellow members (#1223)`
umbenannt (war kein Conventional Commit).

## Erledigt
- MODE = Kreuzverhör (kein `<!-- ai-review -->`-Kommentar vorhanden); Closing-Issue #1223 existiert
  (length 1) → AKs aus dem Harness-Marker-Kommentar (issuecomment mit `KI-ANALYSE:START`, AK1–AK8 +
  TF1–TF4) gelesen.
- Kompletten Diff gelesen (1089 Zeilen, 15 Dateien): `groups.ts` Endpunkt `GET /groups/:id/tasks`
  (:540 ff.), `openapi.yml` Pfad+Schema `GroupTask`, `client/src/index.ts` Export, `frontend/src/api.ts`
  `getGroupTasks`, `GroupDetail.tsx` Abschnitt + `refreshKey`, `GroupsSection.tsx` Klick-Guard
  (Refresh statt No-op), API-Test (3 Tests), e2e (3 Tests), Spec-Doc.
- **Blocker #1 verifiziert über CI, nicht nur Memory:** `gh pr checks 1239` → `e2e (1)` + `e2e (3)`
  FAIL (Run 33980252704); `e2e (2)`/`e2e (4)` pass. Deckungsgleich mit Impl-Notiz („1/3, 2 Test-Defekte“).
  Defekte: `getByText(/von /)` seitenweit (KolTabs-Panels gemountet, Strict-Mode), `.or()`-Locator +
  Einmal-`count()` raced (Zeilen 129, 182-194).
- Geprüft und NICHT beanstandet: Auth-Parität (`resolveGeoUser` in allen groups-Routen, grep),
  NULL-sicherer JS-Filter, AK4-DeepEqual + E-Mail-Leak-Guard, AK6-Sortier-Orakel (case-insensitive
  vs. byte-wise), Klick-Guard-Regression.

## Relevante Stellen
- `frontend/e2e/groups-for-each-other.spec.ts:129,182-194` — Blocker-Fixort; Fix-Vorschlag im
  Inline-Kommentar (Scope auf `.group-tasks`, `expect.poll`/`toPass()`; Assertionen bleiben gleich
  stark → keine Spec-Abschwächung).
- `frontend/src/components/GroupDetail.tsx:665` — Nit: Leerzustand-Hinweis blitzt während des ersten
  Ladens (`tasks` init `[]`); KolSpin-Muster :116 als Vorbild.
- `server/src/express/routes/groups.ts:1064` — Nit: `memberIds.includes` O(n·m).

## Annahmen
- Produkt verhält sich korrekt (Impl-Notiz: Beweislauf mit Wegwerf-Kopie 3/3 grün); ich habe e2e
  selbst nicht lokal gefahren — Beleg ist CI-rot + Impl-Notiz, beides unabhängig konsistent.
- 2 rote e2e-Tests sind Locator-Defekte, keine Spec-Abschwächung → fixup darf sie reparieren,
  sofern die Korrektur im PR begründet wird (SKILL: test correction reported back with justification).

## Verworfen
- needs-human — keine Produkt-/Designfrage; alles fixbar.
- Performance-Finding SQL-Join — Größenordnung irrelevant, nur Nit.
- Delegation an Subagents — MEMORY 2026-09-05: Rollen fallen mit `API Error 400 modelCode does not
  exist` aus; Diff/Verdict ohnehin nie delegierbar.

## Offen
- Fixup-Runde steht aus; danach MODE = Fixup-Nachweis (Sammelkommentar-ID 5553487192 updaten,
  Finding #1 in „✅ Behobene Anmerkungen“ schieben).

## Nächster Schritt
- Fixup-Verifikation: Claim-Checklist gegen Fixup-Diff (commit_id HEAD d3789a11 beim Review),
  e2e (1)/(3) müssen grün sein, dann Sammelkommentar per PATCH issues/comments/5553487192 updaten.

## Fallstricke
- `gh api .../pulls/1239/comments` braucht für `line` + `side` IMMER `commit_id`, sonst 422
  „positioning wasn't supplied“ — HEAD-SHA mitgeben.
- `gh pr comment` hat KEIN `--jq`; Ausgabe-Interaktion über `gh api issues/<nr>/comments`.
- Review-Inline-Kommentar über `-F comments[][path]`-Array-Syntax landet mit line=null → besser
  direkt `pulls/<nr>/comments` (einzeln) posten und den defekten via DELETE pulls/comments/<id>
  entfernen (REST-ID, nicht GraphQL-Node).
- `gh pr edit` hat kein `--json` — Titel-Verifikation separat.
- CI-Befund (e2e rot) vor dem Verdict gegen `gh pr checks` belegen, nicht nur Phasen-Notiz vertrauen.
