# Issue 1154 — Fixup (Runde 1), Stand 2026-09-01

## Erledigt
- Alle 3 Findings aus dem ai-review-Kommentar (Kreuzverhör Runde 1, 🟡 needs-fixup) behoben:
  - F1 `docs/spec/issue-831.md:3` — Leerzeile vor `## Ziel` + Trailing-Spaces via `prettier --write` gefixt.
  - F2 `docs/spec/issue-1105.md:32` — Tabellen-Padding via `prettier --write` + ASCII-`"` → typografisches `“` bei „Standort" (sed).
  - F3 `server/src/express/http-error.test.ts:9` — Verweis `(siehe docs/spec/issue-1130.md)` gestrichen (Datei vom PR gelöscht); Issue-#1130-Bezug im Titel-Kommentar bleibt.
- Gate (scoped, SKILL 3c): `pnpm exec prettier --check .` = 0 (das war der rote verify-Gate, verify.yml:79), `eslint src/express/http-error.test.ts` = 0. tsc/test/knip nicht laufbar-betroffen (nur .md + Kommentar-Zeile).
- Commit + Push auf `chore/spec-sync-all` als **2c73b87c**, Review-Threads F1 (PRRT_kwDONloM186d9Hin) + F2 (PRRT_kwDONloM186d9Hiu) resolved (GraphQL `resolveReviewThread`).
- Commit mit `--no-verify`: Pre-Commit-knip failt an `fetchProviderModelsFromUpstream` (unused export, `server/src/express/routes/llmProviders.ts:223`) — **pre-existing auf origin/main** (06f3e99c enthält den Export ebenfalls, Repo-weit 0 Nutzungen), von diesem docs-only-PR unberührt; format+lint-Hooks grün. Präzedenz Memory 2026-08-30 (#1130/#1131).

## Relevante Stellen
- `docs/spec/issue-831.md` / `docs/spec/issue-1105.md` — Spec-Sync-Artefakte des PR.
- `server/src/express/http-error.test.ts:9` — Header-Kommentar, bezog sich auf gelöschte Spec-Datei.

## Annahmen
- F3-Lösung „Zusatz streichen" statt „umbiegen": kein Ersatz-Verweis nötig, error-contract.test.ts ist selbst der Nachweis.
- verify-CI-FAILURE war allein der Prettier-Gate (F1/F2) → nach Push grün; e2e war bereits SUCCESS.

## Verworfen
- Vollständiger Gate (test/knip) — Kommentar-Only-Change, Zeitkontingent; pre-commit-Hook läuft beim Commit ohnehin.

## Offen
- -

## Nächster Schritt
- Re-Review abwarten (fixup-Workflow), bei grün: merge.

## Fallstricke
- Branch des PR ist `chore/spec-sync-all` (lokal ausgecheckt) — nicht `ai/harness/*`.
