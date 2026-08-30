# Issue 1130 — Triage (Phase 1), Stand 2026-08-30T04:26:09Z

**ERGEBNIS: VERDICT analyzed, Ampel 🟢.** Initial-Triage (0 Kommentare, kein Marker, kein ai-triage-decision). Auto-issue des Nightly-arch-opt-Workflows (Run #33291523044). Harness-Kommentar erstellt (issuecomment-5466689755, Body in `.ai-memory/issue-1130-comment.md`), Labels `ai:needs-analyse` entfernt, `ai:analysed` + `ai:needs-spec` gesetzt (verifiziert). Kein Ping, kein Titel-/Body-Edit (Titel treffend), kein Split (ein PR), kein Auto-Close (`http-error.ts` existiert nicht, Dubletten verifiziert vorhanden).

## Erledigt
- Issue geladen, alle Code-Behauptungen am Repo verifiziert (grep/sed, s. relevante Stellen): sendError 9×, parseId 3×, handleWriteError 2×, Inline-500er in scores.ts:28,49 + express/index.ts:248,258,268 + llmProviders.ts:345 (restliche llmProviders-500er nutzen bereits sendError), `error-contract.test.ts` existiert (API-Suite, Issue #117), Muster-Module `llmProviderQuery.ts`/`server-error-handler.ts` existieren.
- Analyse-Block + Routing-Tabelle (ux nein/-/-, spec ja/sonnet/medium, impl ja/sonnet/high, review ja/sonnet/high) in EINEN Harness-Kommentar geschrieben.

## Relevante Stellen
- `server/src/express/routes/{tasks:114,119,128, series:79,84,94, pillars:45, push:26, geoConfig:85, llmProviders:23,93,345, lektorat:8, suggestPillars:31, pillarAdvisor:15}.ts` — alle Dubletten-Fundstellen, Zeilennummern verifiziert.
- `server/src/express/routes/scores.ts:28,49` + `server/src/express/index.ts:248,258,268` + `routes/llmProviders.ts:345` — Inline-500er (`res.status(500).json({ message: 'Interner Serverfehler.' })`), durch sendError zu ersetzen (AK3).
- `server/src/express/llmProviderQuery.ts`, `server/src/express/server-error-handler.ts` — Muster für geteilte Express-Helfer; neues `http-error.ts` kommt daneben.
- `server/src/express/error-contract.test.ts` — existierender Verhaltensnachweis (describe/it via startTestServer + `expectError` aus `express/test-helpers.ts`); AK5 verlangt unverändert grün.
- `server/src/express/routes/geoConfig.ts:85` — einzige Kopie mit `Response<{ message: string }>` statt `Response<ErrorDto>` → vereinheitlichen.

## Annahmen
- parseId-Vereinheitlichung auf Signatur `string | string[]` (Obermenge; llmProviders-Caller mit `string` bleibt typkompatibel).
- handleWriteError-Divergenz (series.ts loggt `console.error('…Series-Route…')`, tasks.ts loggt nicht) wird vereint — Log-Kontext entfällt oder wird parametrisiert; kein HTTP-Vertrag, error-contract.test.ts unberührt.
- Keine UX-Phase (kein UI-Bezug), Spec-Phase ja (Anwendungscode, node:test-Ebene).

## Verworfen
- Titel-/Body-Copyedit — Issue vom Nightly-Workflow präzise generiert; Body-Edit eh verboten (ADR 0009).
- Split — reines Server-Refactoring, ein PR.
- MEMORY.md-Eintrag — é-Creep im Write-Output ist bereits dokumentiert (2026-08-29), nichts Neues.

## Offen
- `.ai-memory/issue-1130-comment.md` ist Wegwerf-Artefakt (gesendeter Kommentar-Stand), NICHT committen; nur diese Datei hier ist die Phasen-Notiz.

## Nächster Schritt
- Spec-Phase (Label `ai:needs-spec` gesetzt): rote Tests für AK4 in neu `server/src/express/http-error.test.ts` (mock-res für sendError/handleWriteError, parseId-Fälle); AK1–AK3/AK5 sind statisch/bestehende Suite, kein neuer roter Test nötig.

## Fallstricke
- Routing-Tabelle im Harness-Kommentar ist bindend: ux nein, spec ja/sonnet/medium, impl ja/sonnet/high, review ja/sonnet/high.
- error-contract.test.ts braucht Redis? Nein — startTestServer/SQLite-Helper, aber `session.test.ts`-Rot (Redis lokal fehlt) kennt die Suite nicht; gates ggf. auf `test:scripts`/frontend begrenzen (MEMORY 2026-08-27/-29).
- Import-Pfad im neuen Modul: SequelizeValidationError-Import mitziehen (aus sequelize bzw. bereits in tasks/series importiert); ErrorDto-Typ-Lokation vor dem ersten tsc-Lauf klären.
- Nicht über das Ziel hinausschießen: `sendServiceError` in llmProviders.ts:98 bleibt lokal (nur 1× vorhanden, nicht Teil des Tickets).
