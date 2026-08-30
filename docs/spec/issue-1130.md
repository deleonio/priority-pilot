# Issue 1130 — Fehlervertrag zentralisieren (`http-error.ts`)

## Ziel

`sendError`, `handleWriteError` und `parseId` existieren heute als 9 bzw. 2 bzw. 3 lokale
Kopien in den Express-Routen. Der Fehlervertrag `{ message: string }` + Statuscode soll
**genau einmal** im neuen Modul `server/src/express/http-error.ts` existieren (Muster:
`llmProviderQuery.ts`, `server-error-handler.ts`). **Kein Verhaltenswechsel** — der
HTTP-Vertrag bleibt byte-identisch (Statuscodes, Body-Form, Fehlertexte).

## Vorbedingungen

- `server/src/express/error-contract.test.ts` (Verhaltensnachweis aus #117) läuft
  **ohne jede Anpassung** grün — er ist die Regressions-Absicherung des Vertrags.
- Divergierende Kopien werden vereinheitlicht (Obermenge):
  - `parseId`: Signatur `string | string[]` (tasks/series), Verhalten „nur positive
    Ganzzahlen → `number`, sonst `null`" (deckt die `string`-Variante aus
    `llmProviders.ts` ab).
  - `handleWriteError`: `SequelizeValidationError` → 400 mit `'; '`-verbundener
    Sammelmeldung, sonst 500 `'Interner Serverfehler.'`; Log-Kontext (series loggt,
    tasks nicht) entfällt bzw. wird parametrisiert — kein Vertrag.
  - `geoConfig.ts` arbeitet bisher mit `Response<{ message: string }>` → einheitlich `ErrorDto`.

## Schritte / Verhalten

1. `http-error.ts` exportiert `sendError(res, status, message)`,
   `handleWriteError(res, error)` und `parseId(raw)`.
2. Alle Routen (`tasks`, `series`, `pillars`, `push`, `geoConfig`, `llmProviders`,
   `lektorat`, `suggestPillars`, `pillarAdvisor`) importieren `sendError` aus dem neuen
   Modul; `tasks`/`series` zusätzlich `handleWriteError` und `parseId`,
   `llmProviders` zusätzlich `parseId`.
3. Die Inline-500er in `routes/scores.ts` (2×), `express/index.ts` (3×) und
   `routes/llmProviders.ts` (1×) werden zu `sendError(res, 500, 'Interner Serverfehler.')`.
4. Keine lokale Definition von `sendError`/`handleWriteError`/`parseId` bleibt in
   `server/src` zurück.

## Erwartetes Ergebnis

- `grep -rn "const sendError\|const parseId\|const handleWriteError" server/src` → 0 Treffer.
- `server/src/express/http-error.test.ts` deckt das Verhalten der drei Helfer ab (AK4).
- `error-contract.test.ts` unverändert grün (AK5).

## Testfall-Mapping

| TF  | AK      | Test                                             | Art                                                                                          |
| --- | ------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| TF1 | AK1–AK3 | `http-error.test.ts` → „Duplikat-Guard"          | statischer Dubletten-Wächter (Quelltext-Scan)                                                |
| TF2 | AK4     | `http-error.test.ts` → Unit-Tests mit Mock-`res` | `node:test`                                                                                  |
| TF3 | AK5     | `error-contract.test.ts` (bestehend)             | Verhaltensnachweis, unverändert grün — kein neuer Test (Duplikat-Schutz), Verifikation im PR |
