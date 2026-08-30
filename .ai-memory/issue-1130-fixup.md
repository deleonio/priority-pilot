# Issue 1130 — Fixup (Runde 1 zu PR #1131), Stand 2026-08-30

**ERGEBNIS: 3/3 Findings (F1–F3) behoben, GATE PASS, kein Entscheidungs-Finding → kein VERDICT.**

## Erledigt
- Findings SCOPED gelesen: ai-review-Kommentar (PR #1131, „needs-fixup", 3 offene Findings) + 3 Review-Threads (PRRT_kwDONloM186de2lM/N/O) + `gh pr checks 1131` (e2e 1–4 pass, verify pass — der im Review genannte e2e-(3)-Rot war bereits grün gelaufen).
- **F1** `server/src/express/http-error.test.ts:119` — Konstruktor auf dokumentierte Signatur `new SequelizeValidationError('Validation error', [items])` umgestellt (sequelize 6.37.8: `constructor(message, errors, options)`, verifiziert in `server/node_modules/sequelize/lib/errors/validation-error.js:106` — `errors` wird nur so befüllt). `server/src/express/http-error.ts:13` — `validationMessages` auf `error.errors.map((item) => item.message)` reduziert (Fallback auf `error.message` war nur für die künstliche Test-Konstruktion nötig).
- **F2** `server/src/express/http-error.test.ts:35` — `srcRoot` auf `new URL('../', import.meta.url)` (= wirklich `server/src`), Pfade in `ROUTE_FILES`, `INLINE_500_FILES` und den 3 Hardcode-Listen des dritten Tests um Präfix `express/` ergänzt. JSDoc „unter server/src" stimmt jetzt. Erster Gate-Lauf rot: der dritte Test hatte eigene Hardcode-Pfade (`routes/tasks.ts` …), die nicht aus `ROUTE_FILES` kommen → nachgezogen.
- **F3** `server/src/express/http-error.ts:10` — `export type ErrorDto`; `server/src/express/routes/geoConfig.ts` — Import + 3× `Response<{ message: string }>` → `Response<... | ErrorDto>` (Z. 89/107/137; Spec-Vorbedingung `docs/spec/issue-1130.md:22`). knip bleibt grün (Export wird genutzt).
- GATE (2. Lauf, via gate-runner): format / prettier --check / lint / knip / test alles exit 0.
- Threads F1–F3 beantwortet und resolved.

## Relevante Stellen
- `server/src/express/http-error.ts` — zentraler Fehlervertrag; `ErrorDto` jetzt exportiert.
- `server/src/express/http-error.test.ts:35` — `srcRoot` = `server/src`; alle Dateipfade relativ dazu mit `express/`-Präfix.
- `server/src/express/routes/geoConfig.ts:89,107,137` — nutzen `ErrorDto`.
- `server/src/api.d.ts:1272` — `Error: { message: string }` (Form von ErrorDto).

## Annahmen
- F1: die anderen `handleWriteError`-Aufrufer (tasks/series) werfen echte Sequelize-Errors mit befülltem `errors`-Array → Verhalten byte-identisch (`error-contract.test.ts` grün bestätigt).
- F2: keine Datei unter `server/src` außerhalb `express/` definiert `const sendError/handleWriteError/parseId =` — der erweiterte Scan lief grün, also belegt.
- CI-`verify`/e2e waren vor dem Push bereits grün → server-only Change, kein e2e nötig.

## Verworfen
- E2E-Lauf — reiner Server-Refactor (Typen + Test), kein UI-Verhalten berührt (Skill 3c: nur wenn UI-Verhalten betroffen).
- Playwright/375-1280-Check — keine sichtbare UI-Änderung.
- Die übrigen 12 lokalen `ErrorDto`-Kopien in `server/src/express` — laut Review explizit außerhalb des Ticket-Scope.

## Offen
- -

## Nächster Schritt
- Nächste Review-Runde (Kreuzverhör Runde 2) über PR #1131; Exit, wenn Verdict 🟢 und keine offenen Findings.

## Fallstricke
- Der Dubletten-Wächter hat Dateipfade an ZWEI Stellen: die Arrays (`ROUTE_FILES`/`INLINE_500_FILES`) und die Hardcode-Listen im dritten Test — bei einer `srcRoot`-Änderung beide mitziehen.
- `new SequelizeValidationError([items])` (Array als erstes Argument) erzeugt `errors = []` — Sequelize erwartet `(message, errors)`; ein Test, der so konstruiert, zwingt die Produktionscode-Komplexität hoch.
