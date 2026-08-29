# Issue 1098 — Review (Runde 1 Kreuzverhör + Runde 2 Fixup-Nachweis), Stand 2026-08-29

**ERGEBNIS Runde 2 (Fixup-Nachweis): VERDICT needs-fixup, Ampel 🔴 unverändert.** Sammelkommentar `<!-- ai-review -->` (id 5459252697) gepatcht, `Review-Typ: Fixup-Nachweis`, Updated 2026-08-29T00:48:32Z. **Kein Fixup-Commit seit der 1. Runde** — einziger Delta-Commit `28a2617c` (nur `.ai-memory/issue-1098-review.md`). F1–F5 am Head re-verifiziert, alle offen, keine neu.

## Erledigt
- MODE-Bestimmung: Marker `<!-- ai-review -->` vorhanden (Kommentar id 5459252697, first round posted 2026-08-29T00:42:40Z) → Fixup-Verifikation, kein neues Kreuzverhör.
- Titel-Gate: Titel `feat(frontend): server-side geo config, alarm distance, interval (#1098)` = 72 Zeichen, Conventional Commits ok → kein Rename.
- Runde 1 (aus der Notiz der vorherigen Laufes, alles gepostet): Full-Diff + Issue #1098 (AK1–AK7, TF1–TF8) geprüft; Inline-Findings F1–F5 + Sammelkommentar als eine Review mit event=COMMENT gepostet; Verdict needs-fixup. AK-Abdeckung gut (alle 7 AKs grün, TDD-Ordnung `fa49cefa` rot vor feat).
- Runde 2 Re-Verifikation am Head `5f50d997d` (git grep): F1 kein `migrateUserGeoConfig*` in `server/src/logics/migrate.ts`/`index.ts`, nur `models/user.ts:16,49`; F2 `.github/scripts/resolve-escalation.sh` MISSING; F4 `('true' as unknown as boolean)` `SettingsPage.tsx:192`; F5 `tasks.ts:356` `User.findByPk(getUserId(req))` vs. `geoConfig.ts:24` `resolveGeoUser`.

## Relevante Stellen (offene Findings, stabile Nummern)
- F1 🔴 Blocker: 3 neue non-null User-Spalten ohne Startup-Migration → Login/`/tasks/nearby`/`/geo-config` brechen auf Bestands-DBs (`no such column`). Fix: `migrateUserGeoConfigColumns` in `server/src/logics/migrate.ts` + Aufruf in `index.ts` vor `sync()` (Muster `migrateTaskAddress`).
- F2 🟠 `.github/workflows/04-claude-implement.yml:172` ruft fehlendes `resolve-escalation.sh`, `|| true` maskiert; Out-of-Scope.
- F3 🟠 `LlmSettings.tsx:61`/`PillarList.tsx:48` `?? null`/`?? []` — Produktivcode ans künstliche api-Proxy-Double (`SettingsPage.test.tsx:40-46`) angepasst, Out-of-Scope.
- F4 🟡 `SettingsPage.tsx:192` Type-Assertion zur Fehlerunterdrückung → `type DisabledProp = boolean | string`.
- F5 🟡 `tasks.ts:357` User-Auflösung weicht von `resolveGeoUser` ab; `?? 5` dupliziert DEFAULTS.
- Hinweis (kein Finding): jede `useGeolocation`-Instanz holt selbst `GET /geo-config` (3–4 Requests/Seite).

## Annahmen
- `sync()` ohne `alter` fügt keine Spalten zu Bestandstabellen hinzu (Kommentarblock `index.ts:155-180`, Präzedenz #207/#217/#531/#951).
- Der zweite Lauf wurde ohne vorgeschaltetes Fixup getriggert; Inhaltswertung unabhängig vom CI-Rollup.

## Verworfen
- Neues Kreuzverhör/Whole-Diff-Walk in Runde 2 — Marker vorhanden, Delta seither nur `.ai-memory/` (SKILL Step 5 Diff-Scoping).
- Inline-Kommentare erneut posten — F1–F5 stehen noch am Diff, keine Duplikate.
- needs-human: alle Findings konkret fixbar, keine Architektur-/Produktfrage.

## Offen
- -

## Nächster Schritt
- Fixup-Runde umsetzen (Label übernimmt der Workflow): F1 Migration (Blocker) zuerst, danach F2–F5; dann erneuter Fixup-Nachweis.

## Fallstricke
- PR-Titel vor dem Verdict prüfen (72 Zeichen = Limit, kein Zeichen Luft); Labels NICHT setzen.
- Review-Kommentare als EINE Review mit event=COMMENT, kein REQUEST_CHANGES.
- Diff-Anker aus dem PR-Head nehmen, nicht aus dem lokalen main-Workspace.
- Kein Fixup-Commit ≠ „PR schlecht geworden“ — nur Bestätigung, keine neuen Findings erfinden, Nummern stabil halten.
