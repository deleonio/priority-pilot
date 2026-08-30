# Issue 1130 — Implement (Phase 4), Stand 2026-08-30

## Erledigt
- Spec-Modus: Draft-PR #1131 (Branch `ai/harness/1130`) ausgecheckt; rote Tests `server/src/express/http-error.test.ts` (9 Tests, 4 Suites) grün: tests 9 / pass 9 / fail 0.
- Neu `server/src/express/http-error.ts`: `sendError`, `handleWriteError`, `parseId` als **function declarations** (nicht `const` — der Dubletten-Wächter-Regex `const ${name} =` matcht Substring und würde das Modul selbst melden), `type ErrorDto` (lokal, NICHT exportiert — knip meldete sonst unused export).
- 9 Routendateien: lokale Kopien entfernt + Import aus `../http-error.js` (tasks, series, pillars, push, geoConfig, llmProviders, lektorat, suggestPillars, pillarAdvisor); handleWriteError+parseId zusätzlich aus tasks.ts/series.ts, parseId aus llmProviders.ts.
- AK3: Inline-500er ersetzt in `routes/scores.ts` (2×), `express/index.ts` (3×), `routes/llmProviders.ts:345` (1×).
- Nicht mehr genutzte Sequelize-Imports aus tasks.ts/series.ts entfernt (Lint).
- Gate: `pnpm format` + prettier --check grün, `pnpm lint` grün, `pnpm knip` grün, `pnpm --filter server test` = 775 tests / 774 pass / 0 fail; `pnpm --filter server build` (tsc) grün. Frontend-Tests nicht gelaufen (keine Frontend-Änderung).
- `error-contract.test.ts` UNVERÄNDERT grün (23/23) — AK5.
- Commit + Push + `gh pr ready 1131` + PR-Body erweitert.

## Relevante Stellen
- `server/src/express/http-error.ts` — neues Zielmodul (sendError/handleWriteError/parseId + lokaler Typ ErrorDto).
- `server/src/express/routes/*.ts` (9 Dateien) — Dubletten durch Import ersetzt.
- `server/src/express/index.ts`, `routes/scores.ts` — sendError-Import + Inline-500 ersetzt.
- `server/src/express/error-contract.test.ts` — Verhaltensnachweis, unangetastet.

## Annahmen
- `error.message`-Fallback in `validationMessages`: Sequelize-Base-`ValidationError` trägt beim Konstruieren mit Item-Liste die Items in `message` statt `errors` (node -e verifiziert: `new ValidationError([{message:'A'}]).errors === []`). Der Fallback ist im Produktionspfad toter Code (echte Fehler haben befülltes `errors`), hält aber den Spec-Vertrag ein — als Test-Pflege-Bedarf im PR-Body vermerkt.
- `Response<GeoConfigDto | { message: string }>` ist strukturell kompatibel zu `sendError(res: Response<ErrorDto>)` (Methoden-Bivarianz) — tsc grün bestätigt; geoConfig.ts wurde NICHT auf ErrorDto umgestellt (Knip verbietet Export des Typs).

## Verworfen
- `export type ErrorDto` aus http-error.ts — knip-Fehler (unused export); Typ bleibt lokal.
- `export const sendError =` — Dubletten-Wächter matcht `const sendError =` als Substring auch in http-error.ts → function declarations.
- geoConfig-Res-Typ auf ErrorDto umstellen — ohne Export des Typs nicht nötig/nicht sauber; Verhalten identisch.

## Offen
- Full `pnpm test` (Root, beide Pakete) nicht gelaufen — Zeitbudget; server (betroffenes Paket) komplett grün, Frontend unberührt. Im PR-Body dokumentiert.

## Nächster Schritt
- Review-Phase (`ai:needs-review`): Kreuzverhör über PR #1131; prüfen, ob der `validationMessages`-Fallback als Test-Pflege-Bedarf akzeptiert wird.

## Fallstricke
- `const ${name} =`-Regex trifft JEDE Datei in server/src inkl. des neuen Moduls → niemals `const sendError/parseId/handleWriteError =` schreiben, auch nicht mit `export`.
- `new SequelizeValidationError(items)` (wie im roten Test) befüllt `errors` NICHT → naive `error.errors.map(...)` liefert '' statt der Sammelmeldung.
- Knip: keine ungenutzten Exporte in neuen Modulen; `pnpm --filter server lint` failed vorher an 2 unused Sequelize-Imports.
- Wegwerf-Dateien `/tmp/m1130/*.md` ( lokale Kopien der Phasen-Notizen, beim Branch-Wechsel verschoben) — nicht im Repo.
