# Issue 1130 — Spec (Phase 3), Stand 2026-08-30

## Erledigt
- Branch `ai/harness/1130` ausgecheckt (existierte bereits, nur Triage-Commit 326345d9); kein offener PR für #1130 (Idempotenz geprüft).
- Spec `docs/spec/issue-1130.md` neu erstellt (Ziel/Vorbedingungen/Schritte/Erwartetes Ergebnis/Testfall-Mapping TF1–TF3).
- Rote Tests `server/src/express/http-error.test.ts` (8 Tests in 4 Describes): Dubletten-Wächter (AK1–AK3) + Unit-Tests mit Mock-res für sendError/handleWriteError/parseId (AK4). Rot verifiziert: Import `./http-error.js` fehlt → Datei fail (legitimer erster roter Zustand, `node --import tsx --test src/express/http-error.test.ts` → fail 1).
- Prettier über beide Dateien gelaufen (Gate-Sicherheit).
- Commit + Push + Draft-PR siehe PR #<PR-NR>.

## Relevante Stellen
- `server/src/express/http-error.ts` — fehlt; Zielmodul (Muster: `llmProviderQuery.ts`, `server-error-handler.ts`).
- Lokale Kopien: sendError ×9 (tasks.ts:114, series.ts:79, pillars.ts:45, push.ts:26, geoConfig.ts:85 — dort `Response<{ message: string }>` statt ErrorDto, llmProviders.ts:23, lektorat.ts:8, suggestPillars.ts:31, pillarAdvisor.ts:15); handleWriteError tasks.ts:119/series.ts:84; parseId tasks.ts:128, series.ts:94 (beide `string | string[]`), llmProviders.ts:93 (`string`).
- Inline-500er: routes/scores.ts:28,49; express/index.ts:248,258,268; routes/llmProviders.ts:345.
- `server/src/express/error-contract.test.ts` — bestehender Verhaltensnachweis (AK5), läuft unverändert; `SequelizeValidationError` = `ValidationError` aus 'sequelize' (tasks.ts:3).

## Annahmen
- TF1 als Quelltext-Scan im Test implementiert (statischer Dubletten-Wächter) statt reiner grep-Befehl — hat Zähne (Wieder-Einfügen einer lokalen Kopie macht ihn rot); Selbsttreffer des Testfiles durch zusammengesetztes RegExp (`'const ' + name + ' ='`) vermieden.
- AK5 braucht keinen neuen Test (`error-contract.test.ts` deckt den Vertrag ab, Duplikat wäre zahnlos) — Verifikation im PR-Body dokumentiert.
- Vereinheitlichte `parseId`-Signatur `string | string[]` (Obermenge, siehe Analyse-Block Randbedingungen).

## Verworfen
- Eigene AK5-Testkopie — bestehende Suite ist der Verhaltensnachweis (SKILL: kein Test ohne Zähne).
- Import-Zähler als exakte-Zahl-Assertion (`=== 9`)-Variante — positive Form (alle 9 Dateien importieren) ist äquivalent präzise und robuster gegen neue Dateien.

## Offen
- -

## Nächster Schritt
- Impl-Phase (Routing: sonnet/high): `http-error.ts` bauen, 9 sendError-Kopien + 2 handleWriteError + 3 parseId durch Imports ersetzen, geoConfig auf `ErrorDto` ziehen, Inline-500er ersetzen; dann `http-error.test.ts` grün + `error-contract.test.ts` unverändert grün.

## Fallstricke
- Log-Kontext in series.ts (`console.error('Unerwarteter Fehler in Series-Route:', …)`) entfällt/parametrisiert — kein Vertragsbruch, nicht als AK gesichert.
- `geoConfig.ts` sendError-Kopie hat anderen Res-Typ → beim Zusammenziehen Typ auf `ErrorDto` (`components['schemas']['Error']`) vereinheitlichen, sonst tsc-Fehler.
- Testfile-Regex trifft sich nicht selbst (zusammengesetztes Muster) — beim Umschreiben auf Literal-Regex würde der Dubletten-Wächter das eigene Testfile melden.
- `pnpm test` lokal an `session.test.ts` (Redis) rot — umgebungsbedingt, nicht jagen (MEMORY 2026-08-29).
