# Issue 1223 — Review-Phase (Runde 1 Kreuzverhör + Runde 2 Fixup-Verifikation), Stand 2026-09-05

**ERGEBNIS Runde 2 (Fixup-Verifikation): VERDICT needs-fixup.** Alle 5 Claims des Fixup-Kommentars
sind im Diff von `510b7c6e` enthalten (Nits #4/#5 verifiziert und in „Behobene Anmerkungen"
verschoben), ABER: CI e2e (1) weiter rot — Run 33981962811, 5/5 Gruppentests failen. Der neue
scoped Locator im gemeinsamen Invite-Helper ist ein Strict-Mode-Violation (NEUES Finding #6).

## Erledigt
- MODE-Runde 2 = Fixup-Verifikation (`<!-- ai-review -->`-Marker vorhanden, aber nur Stub
  „kein Sammelkommentar gepostet" — die echten Findings standen im ai-fixup-decisions-Kommentar,
  Tabelle „✅ Behobene Anmerkungen" = Claim-Checklist).
- Claim-Check gegen `git show 510b7c6e`: #1 (`.group-tasks`-Scoping AK7), #2 (`toHaveCount(1)` statt
  `.or()`+`count()`, AK8), #3 (Invite-Klick gescoped), #4 (`tasks` init `null` + KolSpin,
  GroupDetail.tsx:34/165), #5 (`Set.has`, groups.ts:562/573) — alle mechanisch korrekt umgesetzt.
- CI geprüft (`gh pr checks 1239`): e2e (1) FAIL, e2e (2)/(3)/(4), verify, precheck PASS. Log-Auswertung:
  5 Failures, ALLE im Helper `createGroupAndInvite` an groups-for-each-other.spec.ts:47 bzw.
  groups-foreign-task.spec.ts:43 — „strict mode violation: resolved to 2 elements": Gruppendetail
  rendert INNERHALB von `<li data-group-id class="groups-item">`, der Suchtreffer
  `<li class="group-search-hit">` (GroupDetail.tsx:197) ist dessen Nachfahre → `listitem`-Filter
  matcht Vorfahre + Nachfahre.
- Inline-Kommentare gepostet: 3941524562 (groups-for-each-other.spec.ts:47), 3941525464
  (groups-foreign-task.spec.ts:43), commit_id = 510b7c6ea97a112ce4d38e2971a217e76ef0a581.
- Sammelkommentar neu aufgebaut: Stub issues/comments/5553498798 per PATCH mit vollständigem
  `<!-- ai-review -->`-Body überschrieben (Review-Status needs-fixup, #4/#5 → Behobene,
  #1–#3 offen, #6 neu). Defekten Leichnam issues/comments/5553487192 (Body war nur
  `@/tmp/collected.md`, vom Workflow verbaut) per DELETE entfernt.
- Titel-Gate: `feat(frontend): list tasks created for fellow members (#1223)` = konform (58 Zeichen)
  → kein Rename.

## Relevante Stellen
- `frontend/e2e/groups-for-each-other.spec.ts:46-47` + `frontend/e2e/groups-foreign-task.spec.ts:42-43`
  — Fixort für #6: `page.locator('li.group-search-hit').filter({ hasText: INVITEE_NAME })`.
- `frontend/src/components/GroupDetail.tsx:197` — `group-search-hit`-Klasse existiert (Fix ist valide);
  `:170/172` — `group-tasks`/`group-task` existieren (#1/#2-Scoping korrekt).
- CI-Fehlermeldung Run 33981962811 Job 101348672379 — Beleg für #6 (nicht Phasen-Notiz vertrauen).

## Annahmen
- Die 5 Failures sind sämtlich #6 (3× for-each-other + 2× foreign-task, alle im Helper); nach Fix von
  #6 sollten #1–#3 mitgrün — im Sammelkommentar so formuliert, dass ein grüner Lauf #1–#3 erledigt.
- `INVITEE_NAME` (= „Lángename Empfängerin …") ist datenbankweit eindeutig; `group-search-hit`-Scoping
  grenzt genug ein (CI-Fehler zeigt als 2. Treffer nur den eigenen Gruppen-Listenpunkt).

## Verworfen
- reviewed trotz rotem e2e (1) — SKILL: kein 🟢, solange CI rot.
- needs-human — kein Produkt-/Designfrage, reiner Locator-Defekt.
- Titel-Rename — bereits konform aus Runde 1.

## Offen
- Fixup-Runde 2 steht aus (nur #6 zu beheben, 2 Zeilen in 2 Specs); danach MODE = Fixup-Verifikation,
  Sammelkommentar = issues/comments/5553498798 (PATCH), Finding-Nummern stabil lassen.

## Nächster Schritt
- Nach Fixup 2: Claim-Check nur für #6 (Locator auf `li.group-search-hit`) + e2e (1) muss grün sein →
  #1–#4 + #6 in „Behobene" schieben, VERDICT reviewed.

## Fallstricke
- „Behoben via <SHA>" im ai-fixup-decisions-Kommentar ist nur eine Behauptung — immer gegen
  `git show <SHA>` UND `gh pr checks` verifizieren; der Fixup hatte lokal Gate + Unit grün, aber e2e
  nie ausgeführt und dabei einen funktionierenden Helper-Zeile kaputtgeändert (Regression im Fixup).
- Scoping auf `getByRole('listitem')` ist in Gruppen-Specs gefährlich: Gruppendetail hängt im
  Gruppen-`li` → jeder Textfilter matcht Vorfahre + Nachfahre. Immer Blatt-Klasse (`li.group-search-hit`)
  scopen.
- `gh api issues/comments/<id> -X PATCH/DELETE` für Sammelkommentar-Pflege; PR-Kommentarliste via
  `gh api repos/.../issues/1239/comments --jq` (IDs nötig, `gh pr comment` hat kein --jq).

---
Runde 1 (Kreuzverhör, VERDICT needs-fixup, Review 5122197395): Blocker #1 AK7-Lokator
(`getByText(/von /)` page-weit, Strict Mode), #2 AK8 `.or()`+einmaliges `count()` → Bounding-Box null,
#3 Kollateral Shard-DB-Nutzersuche („Einladen" resolved ×2), Nits #4/#5. PR-Titel in Runde 1 per
`gh pr edit` auf Conventional Commit umbenannt. Diff 1089 Zeilen/15 Dateien war in Runde 1 vollständig
gelesen (groups.ts:540 ff. Endpunkt, openapi.yml, client, api.ts, GroupDetail.tsx, GroupsSection.tsx,
API-Tests, e2e, Spec-Doc); geprüft und nicht beanstandet: Auth-Parität resolveGeoUser, NULL-sicherer
Filter, AK4-DeepEqual + E-Mail-Leak-Guard, AK6-Sortierung, Klick-Guard-Regression.
