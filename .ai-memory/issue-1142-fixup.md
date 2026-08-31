# Issue 1142 — Fixup (PR #1150, Runde 1), Stand 2026-08-31

## Erledigt
- Findings SCOPED gelesen: ai-review-Kommentar (05:34:08Z, Ampel 🟡 needs-fixup, 3 Findings) + 2 Inline-Threads.
- F1 behoben: `server/src/express/auth-avatar.test.ts:84` roher `POST /auth/register` → `await registerResponse(server, 'avatar-pw@example.com', 'sicher123')` + Import ergänzt (auth-avatar.test.ts:10). Verhältnisneutral, keine Assertion geändert.
- AK4 verifiziert: `grep -rln "auth/register" server/src --include="*.test.ts"` → nur noch `auth.test.ts` (erlaubte Ausnahme).
- F2 behoben: PR-Body-Zeile korrigiert (Env-Werte können sich um `-secret`/`-client-id`-Suffix unterscheiden).
- F3 (`e2e (3)` rot, `frontend/e2e/issue-969.spec.ts:86`): CI-Rerun war bereits grün — alle 4 e2e-Shards + `verify` pass (run 33361093878). Flaky, nicht PR-verursacht → kein Commit nötig.
- Gate: `node --import tsx --test src/express/auth-avatar.test.ts` 3 pass / 0 fail; prettier --check ok; eslint ok; `tsc --noEmit` ok.
- Beide Inline-Threads resolved; Commit gepusht.

## Relevante Stellen
- `server/src/test/helpers.ts:79` — `registerResponse(target, email, password='password123')` (genutzter Helfer).
- `server/src/express/auth-avatar.test.ts:84` — Fixort (F1).
- PR-Body-Messgrößen-Absatz — Fixort (F2).

## Annahmen
- Kein Entscheidungs-Finding → KEIN ai-fixup-decisions-Kommentar nötig (Wrap-up: nur für needs-human/already-done). F3-Flakiness ist bereits im Review-Kommentar selbst dokumentiert und durch grünen CI-Rerun entwertet.
- Kein Verdict (Commit bestimmt Fortschritt) — nächste Review-Runde bewertet.

## Verworfen
- Frontend-/Layout-Prüfung (Schritt 6) — Diff enthält kein UI, nur Server-Test-Helfer.
- F3 als Fix-Ziel — Review sagt explizit „kein Fix-Ziel dieses PRs"; Shard inzwischen grün.

## Offen
- -

## Nächster Schritt
- Nächste Review-Runde (Phase 7) erwartet; bei 🟢 ist #1150 merge-fähig.

## Fallstricke
- `registerResponse` hat Default-Passwort `password123` — Passwort explizit mitgeben, sonst schlägt der folgende Login fehl (d0ff0257).
- `cd server` aus dem Repo-Root schlägt fehl, wenn die Bash-Session schon in `server/` steht (Arbeitsverzeichnis persistiert) — mit absoluten Pfaden/pwd prüfen.
- Tests laufen mit `node --import tsx --test`, NICHT vitest (vitest im server-Paket nicht installiert).
