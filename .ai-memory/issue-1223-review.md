# Issue 1223 — Review (Fixup-Verifikation Runde 2), Stand 2026-09-05T19:05Z

**ERGEBNIS: VERDICT reviewed 🟢.** PR #1239. Fixup-Commit `1f782a92` setzt den Runde-1-Fix für
#6 exakt wie vorgegeben um (`page.locator('li.group-search-hit').filter({ hasText: INVITEE_NAME })`
in `groups-for-each-other.spec.ts:46` + `groups-foreign-task.spec.ts:42`, sonst nur Phasen-Notiz).
Verify-Run **33985684376** auf Head `f67a4ec2` vollständig grün: e2e (1)–(4) + verify ✓ →
#1/#2/#3 gelten damit als erledigt (Runde-1-Abhängigkeit „sofern der Lauf grün ist" erfüllt).
Beide offenen Threads (`PRRT_kwDONloM186flikG`, `PRRT_kwDONloM186fliuT`) resolviert.
Sammelkommentar ID 5553498798 aktualisiert (Findings 1,2,6,3 + Nits 4,5 in die ✅-Tabelle).

## Erledigt
- MODE bestimmt: `<!-- ai-review -->`-Marker vorhanden (Kommentar 5553498798) → Fixup-Verifikation.
- Delta seit Runde-1-Review: nur `1f782a92` (Code) + Memory-Commits — Commit-Liste via
  `gh pr view --json commits` geprüft.
- Fix-Diff gegen Claim-Checkliste (aus `.ai-memory/issue-1223-fixup.md`, da der
  ai-fixup-decisions-Kommentar 5553636067 defekt ist: Body = wörtlich
  `@.ai-memory/issue-1223-dec.md`) verifiziert: 2 Zeilen, genau der vorgegebene Locator.
- Blatt-Klasse bestätigt: `GroupDetail.tsx:197` `<li className="group-search-hit">` mit genau
  1 Name-Span + 1 „Einladen"-KolButton → strict-fähig; INVITEE_NAME beider Specs ist jeweils
  eindeutig (Langname bzw. „Ines Empfängerin"), Shard-DB-Kollision ausgeschlossen.
- Gruppen-Klicks `getByRole('listitem').filter({ hasText: groupName })` bewusst NICHT beanstandet
  (Suchtreffer-li enthält keinen Gruppennamen; in grünem Lauf bestätigt).
- Title-Gate: `feat(frontend): list tasks created for fellow members (#1223)` = 60 Zeichen,
  konform → kein Rename.
- Threads resolviert (GraphQL `resolveReviewThread`, REST 404 auf Einzelabruf — s. Fallstricke).

## Relevante Stellen
- `frontend/e2e/groups-for-each-other.spec.ts:46`, `frontend/e2e/groups-foreign-task.spec.ts:42` — Fixorte.
- `frontend/src/components/GroupDetail.tsx:195-199` — Beweis für Eindeutigkeit des Locators.
- Sammelkommentar 5553498798 (ai-review), ai-fixup-decisions 5553636067 (defekt, nur Datei-Ref).

## Annahmen
- „#1–#3 gelten mit grünem Lauf als erledigt" (Runde-1-Formulierung) als Abnahme-Kriterium übernommen.
- Verify-Run auf Head deckt den PR-Branch ab (Head `f67a4ec2` = Memory-Commit nach `1f782a92`, nur Notiz).

## Verworfen
- Nachfassen des defekten ai-fixup-decisions-Bodies — Fixup-Phase-Artefakt, nicht Review-Mandat;
  als nicht-blockierender Hinweis im Sammelkommentar vermerkt.
- Re-Review des ganzen PR — Modus verbietet erneutes Kreuzverhör.

## Offen
- -

## Nächster Schritt
- Merge-Kette (gate-merge) läuft automatisch; falls ein Check doch rot: neue Runde Fixup-Nachweis.

## Fallstricke
- `gh api -X PATCH repos/.../issues/1239/comments/<id>` → 404; Issue-Kommentare patcht man unter
  `/repos/{owner}/{repo}/issues/comments/<id>`.
- Review-Threads sind GraphQL-only (REST 404); resolve via `resolveReviewThread(threadId:)`.
- Fixup-Kommentar-Body kann wörtlich ein Datei-Ref sein (`@/tmp/...`, `@.ai-memory/...`) — Claims
  dann aus `.ai-memory/issue-123{N}-fixup.md` lesen, nicht den Kommentar erwarten.
