# Issue 1142 — Review (Kreuzverhör, Runde 1), Stand 2026-08-31T05:35:00Z

**PR #1150** (`ai/harness/1142` → main), MODE = Kreuzverhör (0 `<!-- ai-review -->`-Kommentare vor Start). **VERDICT: needs-fixup** — Sammelkommentar: https://github.com/deleonio/priority-pilot/pull/1150#issuecomment-5474180270

## Erledigt
- Full Diff (23 Dateien, +374/−451) gelesen; AKs aus Harness-Kommentar (my-github-action-bot 2026-08-31T04:30:54Z, stand=04:30:40Z), Ampel 🟢, AK1–AK5.
- Eigene grep-Verifikation am Branch-Stand `ffee389c`: `const login|register = async` in express = 0 ✓; `auth/test-login` nur auth.test.ts + session.test.ts ✓; **`auth/register` AUCH in auth-avatar.test.ts:84 ✗ (AK4-Verletzung)**; `applyTestAuthEnv` in 16 Dateien ✓; `express/test-helpers.ts`-Refs = 0 ✓; `expectError` nur aus `test/helpers.js` ✓.
- 2 Inline-Findings gepostet (Review-Kommentare 3891951898 = auth-avatar.test.ts/file-level, 3891951966 = helpers.ts:45).
- Sammelkommentar mit Marker gepostet (genau 1 `ai-review`-Kommentar, per API verifiziert).
- **TITLE GATE:** alter Titel deutsch → `gh pr edit 1150 --title "refactor(server): central auth and request test helpers (#1142)"` gesetzt ✓.
- CI: `verify` SUCCESS (774 pass/0 fail/1 skip → AK5-Testteil CI-seitig grün), `e2e (3)` FAILURE → `frontend/e2e/issue-969.spec.ts:86` AK4-Insets-Assertion (Frontend-Layout, vom Branch unberührt, kein Produktivcode im Diff → nicht PR-verursacht; als F3 im Sammelkommentar dokumentiert, kein Fix-Ziel).

## Relevante Stellen
- `server/src/test/helpers.ts:45` `applyTestAuthEnv(prefix)` — leitet ALLE 4 Werte ab → wo Prefix = alter Secret-Wert, ändert sich der Wert (api-auth-protection `'test-secret-issue-207'` → `'…-secret'`); funktional irrelevant, aber PR-Claim „Env-Werte bleiben identisch" falsch.
- `server/src/test/helpers.ts:79` `registerResponse` (rohe Response, kein Assert) vs. `:97` `registerOn` (201+Cookie) — für F1 ist `registerResponse` die richtige Wahl, weil `server.register` eine NEUE 201-Assertion einführen würde (Randbedingung „KEINE inhaltliche Änderung an Assertions").
- `server/src/express/auth-avatar.test.ts:84-93` — roher `/auth/register` + echter `/auth/login`; Login bleibt roh (bewusst kein Passwort-Login-Helfer), nur Register auf `registerResponse` umstellen.
- `server/src/express/pillar-per-user-seed.test.ts` — behält lokalen `login` (echter `/auth/login`, nicht `async`-Arrow, darum vom AK4-grep nicht erfasst) → legitim, zentraler Helfer deckt nur test-login ab.

## Annahmen
- `verify`-Job deckt `pnpm --filter server test` ab (AK5-Teil 1) → grün akzeptiert als Suite-Nachweis; `test:coverage` nicht gelaufen (AK5-Teil 2) — als vertretbar bewertet, weil Schwellen 90/85/85 nur `src/logics/**` betreffen und dort nichts geändert wurde; im Sammelkommentar transparent dokumentiert.
- `e2e (3)`-Rot = pre-existing/flaky, Begründung über Diff-Inhalt (kein Produktivcode) + unberührte Spec-Datei, NICHT über einen main-Vergleichslauf.
- knip-Claim „unused export `fetchProviderModelsFromUpstream` (llmProviders.ts:223)" als pre-existing akzeptiert: Datei vom Branch unberührt; Export wird zwar in derselben Datei genutzt (:254, :265), knip meldet ihn wegen fehlendem Fremd-Import — nicht nachgeprüft (keine node_modules im Runner).

## Verworfen
- 🟢 despite F1 — AK-Wortlaut-Verletzung + falsche PR-Messgröße; wäre ein stillschweigendes Akzeptieren der Abweichung.
- needs-human — kein Punkt, der eine Produkt-/Architekturentscheidung erfordert; F1/F2 sind eindeutig fixbar.
- SESSION_SECRET-Wertdrift als eigenes Finding — Wert muss nur präsent sein, `verify` grün; nur als F2 (PR-Text-Korrektur) gewürdigt.
- Mock/test-spike für die neuen Helfer — Test-Infrastruktur, Spec sieht „Tests für Tests" explizit nicht vor (AK1–AK3 per Review/Grep).

## Offen
- Fixup-Runde steht aus (F1 Code-Zeile + Import, F2 PR-Body-Zeile).
- Wegwerf-Artefakte in `.ai-memory/` NICHT committen: `issue-1142-review-payload.json`, `issue-1142-review-c1.json`, `issue-1142-review-c2.json`, `issue-1142-review-comment.md` (gesendeter Sammelkommentar). Nur diese Datei ist die Phasen-Notiz.

## Nächster Schritt
- Fixup-Verifikation (MODE = Fixup-Nachweis): nur F1/F2-Delta prüfen — `grep -rln "auth/register" server/src --include="*.test.ts"` muss nur noch auth.test.ts (+ helpers.ts) treffen, PR-Body-Zeile korrigiert, `verify` grün, dann Behobene-Anmerkungen-Tabelle pflegen und auf `reviewed` drehen (vorher `e2e (3)`-Status erneut ansehen).

## Fallstricke
- **Inline-Review-Kommentare nur auf Diff-Zeilen:** `POST /pulls/{n}/reviews` mit `comments[].line` auf einer NICHT im Diff liegenden Zeile → 422 „Line could not be resolved"; `subject_type:"file"` wird an DIESER Endpoint-Route nicht akzeptiert (GraphQL-Fehler „Field is not defined"). → Einzelkommentare über `POST /pulls/{n}/comments` mit `subject_type:"file"` (ohne `line`) bzw. `line`+`side:"RIGHT"` posten; Review-Body separat als Review mit `event=COMMENT` ohne `comments[]`.
- `gh pr edit` hat kein `--jq` — Flag-Fehler bricht die Kommandokette ab (Titel-Edit lief beim 1. Versuch nicht); Flags pro Befehl prüfen.
- `commit_id` beim Inline-Kommentar = PR-head-SHA (`gh pr view --json headRefOid`), nicht der Merge-SHA des lokalen Checkouts.
- AK4-grep-Kriterium (`const login = async`) ist schwächer als die Absicht: nicht-async Pfeil-Helfer (pillar-per-user-seed `login`, auth-avatar Register) fallen durch das Raster — beim Fixup-Verifikation nicht nur greifen, sondern Dateien lesen.
