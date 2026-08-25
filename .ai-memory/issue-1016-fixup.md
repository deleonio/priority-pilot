# Fixup PR #1016 (fix/llm-ux-provider-fehlerhinweis)

## Erledigt

- Findings gelesen: 2x 🟠 aus `<!-- ai-review -->`-Sammelkommentar (Runde 1, needs-fixup),
  beide eindeutig, keine Entscheidungs-Findings. CI: alle Checks grün (verify/e2e/label/precheck
  pass), `fixup`-Job selbst `pending` (das ist dieser Lauf).
- F1: `MissingApiKeyError` Aufrufe ohne Argument in 4 Testdateien mit realistischer Message
  versorgt (siehe unten für Fortschritt).
- F2: `handleModelChange` in `frontend/src/components/LlmSettings.tsx` invalidiert
  `testResults[updated.id]` nach erfolgreichem Update.

## Relevante Stellen

- `server/src/llm/llm.ts:73-78` — `MissingApiKeyError(message: string)`, Pflichtparameter.
- `server/src/express/suggest-pillars.test.ts:179`, `error-contract.test.ts:239`,
  `pillar-advisor.test.ts:165`, `routes/parseTasks.test.ts:94` — F1, `new MissingApiKeyError()`
  ohne Argument.
- `frontend/src/components/LlmSettings.tsx:126-139` — `handleModelChange`, F2.
- `frontend/src/components/LlmSettings.tsx:141-158` — `handleTest`, Vorbild-Pattern für F2-Fix
  (Zeile 146: `setTestResults((c) => ({...c, [id]: undefined}))`-artig).

## Annahmen

- Lokale Checks (`pnpm lint`, `pnpm knip`, `pnpm format`) laufen im Sandbox-Repo NICHT
  zuverlässig (frühere Review-Phase: kein `node_modules`, `pnpm` nicht im PATH) — vor
  Commit trotzdem versuchen, bei Fehlschlag wegen fehlender Deps nicht blockieren lassen,
  sondern Diff nochmal visuell prüfen.

## Verworfen

- (keine neuen Verwürfe in dieser Phase bisher)

## Offen

- Nichts offen. Beide Findings gefixt, committet (4e98d679), gepusht, Threads
  (PRRT_kwDONloM186b-B9S = F1, PRRT_kwDONloM186b-B9Y = F2) beantwortet + resolved.
  Lokale Checks (lint/knip/format via `pnpm lint`, `pnpm knip`, `pnpm format`, zusätzlich
  über lefthook pre-commit-Hook) liefen grün; knip-Configuration-Hints sind pre-existing
  (siehe MEMORY.md 2026-08-24), kein Fix-Ziel.

## Nächster Schritt

- Keiner offen für diese Runde. Falls Folgerunde: Review-Sammelkommentar erneut prüfen,
  ob neue Findings eingetroffen sind.

## Fallstricke

- Siehe MEMORY.md 2026-08-24 Knip-Eintrag: knip-Fehler mit nur "Configuration hints" ist
  pre-existing, kein Fix-Ziel.
