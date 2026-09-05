# Issue 1223 — Fixup (Runde 2), Stand 2026-09-05T18:55Z

**ERGEBNIS:** Review (Fixup-Verifikation Runde 1) bleibt `needs-fixup`: neuer Blocker **#6** —
Runde 1 hatte den Invite-Helper als „Scope" auf `getByRole('listitem').filter({ hasText:
INVITEE_NAME })` gesetzt, aber das Gruppendetail rendert INNERHALB von
`<li data-group-id class="groups-item">` (GroupDetail.tsx:159, :211), der Suchtreffer
`<li class="group-search-hit">` (GroupDetail.tsx:197) ist dessen Nachfahre → `hasText` matcht
beide → „strict mode violation: resolved to 2 elements", 5/5 Gruppentests failen im gemeinsamen
Helper (CI e2e (1) Run 33981962811). Mentor-Rat lag in
`~/.claude/.../memory/mentor-advice-1239-fixup-r2.md` (/tmp war schreibgeschützt).

## Erledigt
- `frontend/e2e/groups-for-each-other.spec.ts:46`: `hit`-Locator auf Blatt-Klasse umgestellt —
  `page.locator('li.group-search-hit').filter({ hasText: INVITEE_NAME })`.
- `frontend/e2e/groups-foreign-task.spec.ts:42`: derselbe Ersatz.
- NICHT angefasst (Mentor): Gruppen-Klicks `getByRole('listitem').filter({ hasText: … })`
  (for-each-other :42,:127,:158,:183; foreign-task :37) — im letzten Lauf grün, Suchtreffer-li
  enthält den Gruppennamen nicht.
- Gate lokal: prettier --check ✓, eslint ✓ auf beide Specs (Subagent-Rollen fallen in dieser
  Umgebung mit API Error 400 aus → direkt selbst gefahren, MEMORY 2026-09-05).
- Nachweis-Zeilen #1/#2/#3/#6 in den ai-fixup-decisions Kommentar (ID 5553636067) gepatcht.
- Threads bewusst NOCH NICHT resolved — Mentor: schließen „sobald e2e (1) grün ist".

## Relevante Stellen
- `frontend/e2e/groups-for-each-other.spec.ts:43-49` — Helper `createGroupAndInvite`, Fixort.
- `frontend/e2e/groups-foreign-task.spec.ts:38-45` — gleicher Helper (Kopie), Fixort.
- `frontend/src/components/GroupDetail.tsx:195-197` — Beweis, dass `li.group-search-hit`
  existiert (Blatt-Element, kein Nachfahre seiner selbst → Locator streng-fähig).
- Offene Threads: `PRRT_kwDONloM186flikG` (for-each-other :47), `PRRT_kwDONloM186fliuT`
  (foreign-task :43). Resolved bereits: `PRRT_kwDONloM186flP3N` (Body-Verweis-Thread).

## Annahmen
- `li.group-search-hit` enthält genau einen „Einladen"-Button (ein Treffer je Suchbegriff);
  INVITEE_NAME grenzt ggf. weitere Treffer der Shard-DB weiter ein.
- e2e (1) ist nach Locator-Fix grün — Runde-1-Failures waren sämtlich #6 (Review-Einschätzung,
  CI-Fehlermeldung im Helper, nicht in den AK-Assertions).

## Verworfen
- `.first()` oder erneutes `getByRole('listitem')` als Fix — äußerer li enthält ALLE Treffer-
  Buttons, `hit.getByRole('button', …)` würde erneut strict verletzen (Mentor-Falle).
- Lokaler e2e-Lauf — Webserver-Boot + Chromium-Install > Restbudget (~7 min bis Soft-Deadline);
  CI ist Gate (wie Runde 1).
- Umbau von `getByText('Ausstehend')` — Badge existiert nur in GroupDetail.tsx:158, nie streng.

## Offen
- CI-Verifikation ausstehend (e2e (1) nach diesem Push). Falls grün: beide Threads resolven,
  Verdict `already-done`. Falls rot: neues Finding, weitere Runde.

## Nächster Schritt
- Folgelauf: CI e2e (1) prüfen → bei grün Threads `PRRT_kwDONloM186flikG` + `PRRT_kwDONloM186fliuT`
  resolven und `VERDICT: already-done` (Tabelle im ai-fixup-decisions Kommentar ist die
  Claim-Checkliste).

## Fallstricke
- Strict-Mode-„Scoping" via Rolle+Text hilft hier NICHT: `<li class="groups-item">` umschließt
  das ganze Gruppendetail inkl. Suchtreffern — Blatt-Klasse ist der einzige eindeutige Scope.
- Mentor-Rat stand in ~/.claude-Memory (nicht /tmp): bei „MENTOR-RAT nicht übermittelt"-Lage
  immer die Memory-Dateien des Projekts prüfen, bevor ohne Rat fixt.
- Threads sind GraphQL-only (REST 404), resolve via `resolveReviewThread(threadId:)`.
