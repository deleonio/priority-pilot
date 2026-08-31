# Issue 1136 — Review (Phase 5), Stand 2026-08-31T04:40Z

**ERGEBNIS: VERDICT needs-fixup, 🟡.** MODE = Kreuzverhör (kein `<!-- ai-review -->`-Kommentar vorhanden). Closing Issue #1136 → AKs aus dem Harness-Marker-Kommentar (KI-ANALYSE-Block, stand=2026-08-31T02:44:40Z) gelesen. 3 fixable Findings als Inline-Kommentare gepostet (Review-ID 5063140023, event=COMMENT), Sammelkommentar `<!-- ai-review -->` angelegt (issuecomment-5473789034). Titel-Gate: PR-Titel war „Profile-Erstellung hängt nach Google-Authentifizierung (#1136)" → per `gh pr edit 1149 --title` auf `fix(auth): end endless spinner after Google authentication (#1136)` (70 Zeichen) umgestellt.

## Erledigt
- Diff komplett gelesen (`gh pr diff 1149`, 11 Dateien, +445/−5; Produktionscode nur `frontend/src/lib/auth.ts:12` und `server/src/express/routes/auth.ts:180-204,259-260`).
- Trennungsprinzip geprüft: `git diff 11571757 c1127c05` über die vier Spec-Testdateien + `docs/spec/issue-1136.md` = LEER → rote Spec-Tests unverändert grün, kein Wasserrieden.
- NODE_ENV-Behauptung des playwright.config-Kommentars verifiziert: alle Server-Gates prüfen `=== 'production'` (`server/src/express/index.ts:62,111,128,148`, `session.ts:38`, `csrf.ts:17`, `routes/auth.ts:25`, `pillars.ts:150`) → NODE_ENV=test verhält sich wie Dev. Stimmt.
- `/auth/test-login` nur bei `NODE_ENV === 'test'` REGISTRIERT (routes/auth.ts:252) → kein Auth-Bypass-Risiko in Produktion.
- `/auth/error`-Referenzen gegoogelt: nur in auth.ts + dessen Tests, keine veralteten Testreferenzen → kein Test-Pflege-Bedarf.

## Relevante Stellen
- `frontend/e2e/google-signup.spec.ts:39` — F1: Pass-Through-`/auth/me` (routes/auth.ts:225) liefert ohne Session 200 mit „Lokaler Modus" → Browser-Assertions grün unabhängig vom Cookie-Transfer.
- `frontend/playwright.config.ts:74-83` — `GOOGLE_CLIENT_ID/SECRET`, `GOOGLE_ALLOWED_EMAILS/EMAIL` = '', SESSION_SECRET bewusst nicht gesetzt → `isAuthActive()` false in E2E (Ursache von F1).
- `server/src/express/auth.test.ts:231` — F2: Kommentar behauptet failureRedirect, tatsächlich greift der neue Guard (routes/auth.ts:180-184); failureRedirect (:187) + regenerate-Fehler (:204) ungetestet; auch `docs/spec/issue-1136.md:219` falsch.
- `server/src/express/routes/auth.ts:259` — F3: `hasAllowlist` dupliziert `requireAuth.ts:5-6` (privat, dort :51 genutzt).
- `Root.tsx:24-31,96` — Loop-Guards unverändert intakt (AK3), Fehler-Alert nennt „neu laden" — AK1/AK3-Tests in `Root.test.tsx` (neu) + `auth.test.ts` (erweitert) substanzvoll (echter Abort über `AbortSignal.timeout(0)`-Spy, nicht Fake-Timer).

## Annahmen
- AK4-Greeting-Assertions möglich: `displayName` fließt über `App.tsx:612` in `Dashboard.tsx:84` (Begrüßung) — nicht selbst im Browser verifiziert, als Fix-Vorschlag formuliert.
- CI der PR (e2e 13/13, gates grün) laut PR-Body übernommen, nicht selbst ausgeführt (keine Sandbox-Runner).

## Verworfen
- Cookie-Parsing `setCookie.split(';')[0].split('=')` (google-signup.spec.ts:38) als Finding — express-session signiert ohne `=`-Padding (cookie-signature strippt `=`), Session-ID ist base64url → funktioniert; Scheitern wäre sichtbar, nicht still.
- needs-human — kein Befund, der eine dokumentierte Menschenentscheidung (O1) oder ADR berührt; alles fixbar.
- 🟢 — F1 verletzt die Test-Substanz-Anforderung an AK4 (Test kann nicht failen), daher needs-fixup.

## Offen
- Wegwerf-Artefakte in `.ai-memory/` NICHT committen: `issue-1136-review-payload.json`, `issue-1136-review-comment.md`, `issue-1136-harness.md`. Nur `issue-1136-review.md` (diese Datei) ist die Phasen-Notiz.

## Nächster Schritt
- Fixup-Runde: F1 (Identitäts-Assertion im AK4-E2E), F2 (Kommentar + Spec-Vorbehalt korrigieren, failureRedirect-Pfad per passport-stub sichern), F3 (`hasAllowlist` aus requireAuth exportieren). Danach Fixup-Verifikation per Diff-Scoping ab issuecomment-5473789034 (updatedAt).

## Fallstricke
- E2E „Session"-Tests in diesem Repo haben ohne Identitäts-Assertion keine Zähne: `isAuthActive()` ist in der E2E-Umgebung absichtlich aus → `/auth/me` antwortet immer 200 (Pass-Through-Nutzer). Nur der Vergleich „Test-Nutzer vs. Lokaler Modus" unterscheidet echte Session von Pass-Through.
- Marker-Suche muss per `gh api repos/.../issues/1149/comments` auf den Body-Präfix `<!-- ai-review -->` filtern — `gh pr view --json comments` gibt die Kommentare nicht zurück (Feld existiert für PRs nicht leer, sondern gar nicht) und `gh pr comment --edit-last` ist laut Skill anfällig.
