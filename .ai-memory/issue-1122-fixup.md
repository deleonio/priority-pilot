# PR 1122 — Fixup (Runde 1), Stand 2026-08-29

**Umfang:** Nur die 2 gemeldeten Findings (F1, F2) aus dem ai-review-Sammelkommentar (ID 5462044979, Inline-IDs 3886460228/3886460236). Keine Entscheidungs-Findings (keine Options-IDs im Kommentar) → beide unambiguisch behoben.

## Erledigt
- F2: `.github/scripts/harness-comment.sh` — `$#`-Guard vor `--repo`/`--issue` (Exit 2 mit Meldung statt unbound-$2-Crash unter `set -u`).
- F1 (Kante 2): `.github/workflows/01-claude-triage.yml` (Migrationsblock, `HAS_BLOCK != true`) — statt blindem `gh issue comment` jetzt Upsert: `harness-comment.sh --id` → REST-HID, bei Treffer `gh api -X PATCH repos/…/issues/comments/$HID -f body=…`, sonst erstes Anlegen. Genau ein Marker-Kommentar garantiert.
- F1 (Kante 1): derselbe Workflow — neuer Happy-Case-Cleanup-Block NACH dem `ai:analysed`-Ensure: wenn `HAS_BLOCK = true` und der Body noch `KI-ANALYSE:START` trägt, werden beide Segmente (KI-ANALYSE + ai-phase-routing) aus dem Body geschnitten (gleiches awk wie im Legacy-Pfad), danach `BODY` neu gelesen. Damit gilt der Claim aus PR-Body/ADR 0009 („migriert jeden Analyse-Block") im Normalfall.
- `docs/adr/0009-issue-storage-harness-kommentar.md` — Begründungssatz um den Upsert-per-HID-Fall ergänzt (blockloser Marker-Kommentar wird aktualisiert, nicht dupliziert).
- Neuer Test `.github/scripts/harness-comment.test.ts` (Exit-2-Guards, Body-/ID-Modus, kein Marker → leer, unbekannte Flags ignoriert) — läuft über `pnpm test:scripts`.
- Gate via gate-runner (format/prettier/lint/knip/test) vor Push — ALL GREEN (766 server / 481 frontend / 251 script tests).
- Commit + Push: `21ddfc6f` auf `ci/harness-kommentar` (inkl. Phase-Note).
- Beide Review-Threads beantwortet + resolved (GraphQL PRRT_kwDONloM186dZgt5 / PRRT_kwDONloM186dZgt9).

## Relevante Stellen
- `.github/workflows/01-claude-triage.yml:335-381` — Migrations-/Self-Heal-Block (F1-Upsert hier).
- `.github/workflows/01-claude-triage.yml:~498` — nach `ai:analysed`-Ensure: Einfügestelle des Happy-Case-Cleanups (Validator-Skip via Label gesichert, Pitfall der Review-Notiz).
- `.github/scripts/harness-comment.sh:31-39` — Arg-Parsing (F2).
- `.github/scripts/needs-human-explain.test.ts` — Vorbild für den gh-PATH-Stub im neuen Test.

## Annahmen
- `gh api -X PATCH repos/<repo>/issues/comments/<id> -f body=<…>` ist der korrekte REST-Update-Aufruf (REST-ID statt GraphQL-Node-ID, da `harness-comment.sh --id` `.id` liefert).
- `ai:analysed` ist nach dem Ensure-Block garantiert gesetzt (Label-Skip des Validators 00 beim Body-Edit) — deshalb Cleanup dort und nicht im Migrationsblock.
- Cleanup greift nur bei `HAS_BLOCK = true` (Block im Kommentar existiert) — im needs-human-Fall ohne Kommentar-Block wird der Body nicht angetastet.

## Verworfen
- Claim-Korrektur statt Code-Fix (Alternative aus dem Finding) — Code-Fix macht den Claim wahr und hebt zugleich den Alt-Body für Menschen; strengere Lösung, gleicher Aufwand.
- Umbau des Legacy-Migrationspfads auf Upsert-freundlichere Reihenfolge / Verschieben des Body-Edits hinter den Label-Check — Prä-Existing, vom Review explizit nicht als Regression gewertet (`.ai-memory/issue-1122-review.md` Verworfen).
- Test für die Workflow-Inline-Bash (Cleanup/Upsert) — Workflow-YAML hat keinen Testmechanismus; die neue Script-Logik (harness-comment.sh) ist getestet.

## Offen
- Sammelkommentar (ai-review, ID 5462044979) NICHT vom Fixup angefasst — Abhaken der Findings F1/F2 ist Aufgabe der Review-Phase (FIXUP-VERIFICATION, Delta-Grenze = Sammelkommentar-updatedAt 2026-08-29T11:18:52Z).

## Nächster Schritt
- Review-Phase: FIXUP-VERIFICATION — beide Threads resolved mit Fix-Referenz `21ddfc6f`, CI auf dem Fixup-Commit vollständig grün (e2e 1–4 + verify, Runs 33250489645/33250489667).

## Fallstricke
- Sammelkommentar NICHT neu anlegen — PATCH auf ID 5462044979, Finding-Nummern F1/F2 stabil.
- `-f body=` (nicht `--input -`): multiline Body muss von gh JSON-kodiert werden.
- Wegwerf-Artefakte der Review-Phase NICHT committen: `issue-1122-diff.txt`, `issue-1122-pr-body.md`, `issue-1122-review-body.md`, `issue-1122-f1.md`, `issue-1122-f2.md`, `issue-1122-collected.md`. Nur `issue-1122-fixup.md` + `issue-1122-review.md` sind echte Notizen.
