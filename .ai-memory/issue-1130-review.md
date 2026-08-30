# Issue 1130 — Review (Phase 5), Stand 2026-08-30

## Erledigt
- MODE = Kreuzverhör (kein `<!-- ai-review -->`-Kommentar auf PR #1131 vorhanden); Closing-Issue #1130 vorhanden → AKs aus dem KI-ANALYSE-Block im Harness-Kommentar (issuecomment, `<!-- ai-harness -->`, KI-ANALYSE:START stand=2026-08-30T04:26:09Z).
- Kompletten Diff gelesen (`.ai-memory/issue-1130-review-diff.patch`, 712 Zeilen), PR-Body + Harness-Block ausgewertet (`.ai-memory/issue-1130-review-{prbody,harness}.md`).
- TDD-Trennung verifiziert: Spec-Tests nur in Commit `7cb581f8` (test: red spec tests), Impl-Commit `a92b844e` berührt `http-error.test.ts` NICHT → Spec-Tests unverändert grün übernommen.
- `error-contract.test.ts` unverändert vs. origin/main (Subagent + Diff) → AK5-Evidenz.
- CI am Head: verify grün, e2e (1)/(2)/(4) grün, **e2e (3) rot** — `e2e/issue-969.spec.ts:113 expect(box).toBeTruthy()` (Frontend-Layout-Test, PR ist server-only → nicht PR-bedingt, vermutlich Flaky).
- 3 Findings als Inline-Kommentare gepostet (Review, event=COMMENT) + Sammelkommentar (`<!-- ai-review -->`) mit VERDICT **needs-fixup**.
- TITLE GATE: PR-Titel `[arch-opt] …` → `refactor(server): central http error contract in one module (#1130)` via `gh pr edit 1131 --title`.

## Relevante Stellen
- `server/src/express/http-error.ts:14` — F1: `validationMessages`-Fallback auf `error.message`; nur für die künstliche Test-Konstruktion nötig (Produktion: `errors` befüllt) → toter Code.
- `server/src/express/http-error.test.ts:117` — `new SequelizeValidationError([items])` ohne Message-Argument (sequelize 6.37.8) befüllt `errors` nicht; F1-Fix: Signatur `(message, errors)`.
- `server/src/express/http-error.test.ts:34,36` — F2: `srcRoot` = Testdatei-Verzeichnis (`server/src/express/`), JSDoc behauptet aber „unter server/src“; Guard schmaler als AK1-Wortlaut.
- `server/src/express/http-error.ts:10` — F3: `type ErrorDto` lokal statt exportiert; Spec-Vorbedingung (geoConfig → ErrorDto) nicht umgesetzt; knip-Argument entkräftet, sobald geoConfig importiert.
- `server/src/express/llmProviderQuery.ts:25` — restlicher Inline-500 in `sendLlmError` (bewusst NICHT als Finding: LLM-eigener Mapper mit Hinweistexten, außerhalb AK3-Scope).
- 14 lokale `type ErrorDto =`-Kopien in server/src/express (Subagent-Liste) — außerhalb Ticket-Scope, nicht als Finding.

## Annahmen
- Test-Grünheit der Impl-Phase (9/9 http-error, 23/23 error-contract, 775 Server-Tests) nicht lokal reproduzierbar — Sandbox ohne `node_modules`; verify-Job in CI grün als Ersatznachweis.
- `new SequelizeValidationError([items])`-Verhalten laut Impl-Notiz (node -e verifiziert); eigener Lauf nicht möglich → F1 bleibt unabhängig davon korrekt (toter Produktionscode steht fest).
- e2e(3)-Rot als Flaky/nicht PR-bedingt eingeordnet (keine Frontend-Änderung im PR).

## Verworfen
- llmProviderQuery.ts-Inline-500 als Finding — außerhalb AK3 (nur 6 Call-Sites im AK), Mapper mit Zusatzverhalten, Scope-Creep.
- Serien-`console.error`-Wegfall als Finding — vom Analyse-Block ausdrücklich als kein Vertrag sanktioniert; kein Re-Litigieren der Spec.
- geoConfig-Verhaltenstest — reiner Typ-Refactor, kein AK.
- needs-human — F1 ist fixbar (Impl selbst hat die Korrektur empfohlen; Korrektur hier gebilligt) → needs-fixup.

## Offen
- Wegwerf-Artefakte in `.ai-memory/` NICHT committen: `issue-1130-review-{diff.patch,prbody.md,harness.md,review.json,collected.md}.md`. Nur diese Datei ist die Phasen-Notiz.

## Nächster Schritt
- Fixup-Phase: F1 (Test-Signatur `(message, errors)` + `validationMessages` vereinfachen), F2 (`srcRoot` auf `../` oder JSDoc korrigieren), F3 (`export type ErrorDto` + geoConfig-Import); danach Re-Review (Fixup-Nachweis) gegen die 3 stabilen Finding-Nummern.

## Fallstricke
- `Entscheidungs-Findings`-Heading im Sammelkommentar NUR bei needs-human setzen — Pipeline substring-testet den Body darauf (SKILL step 5); in needs-fixup-Kommentaren ausgelassen.
- Neues Modul + Testdatei: Review-Inline-Kommentare brauchen `commit_id` = Head-SHA und RIGHT-side Zeilennummern.
- PR-Titel war kein Conventional-Commit (`[arch-opt] …`) → Title-Gate vor dem Verdict.
