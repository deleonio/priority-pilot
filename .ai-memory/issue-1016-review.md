# Review PR #1016 (fix/llm-ux-provider-fehlerhinweis)

## Erledigt

- Modus bestimmt: KEIN `<!-- ai-review -->`-Kommentar an PR 1016 vorhanden → **KREUZVERHÖR** (Erst-Review).
- Diff komplett gelesen (9 Dateien, 381 Zeilen Patch): `sendLlmError` neu in
  `server/src/express/llmProviderQuery.ts:16-31`, 4 LLM-Routen darauf umgestellt,
  `MissingApiKeyError`-Konstruktor umgebaut (`server/src/llm/llm.ts:73-78`),
  Readiness-Alert als IIFE in `frontend/src/components/LlmSettings.tsx:248-292`.
- Kein verknüpftes Issue: `gh pr view 1016 --json closingIssuesReferences` → leer, PR-Body
  ohne `Closes #N`. Ticket-Nummer daher unbekannt (Sammelkommentar formuliert ohne Nummer).
- 2 Findings verifiziert (siehe Fallstricke), Titel-Gate: false → umbenannt.

## Relevante Stellen

- `server/src/llm/llm.ts:73-78` — `MissingApiKeyError` hat jetzt `constructor(message: string)`
  (Pflichtparameter) statt zwei Defaults; hier liegt Finding 1.
- `server/src/llm/llm.ts:404-420` — die drei neuen Wortlaute (kein Provider / Key fehlt / kein Modell).
- `server/src/express/llmProviderQuery.ts:16-31` — `sendLlmError`, hängt an 503/502 den Hinweis
  „(Einstellungen → KI-Provider: „Testen" zeigt die Ursache.)" an.
- `server/tsconfig.json:15` — `exclude: [..., "src/**/*.test.ts", "src/test/**"]`: Testdateien
  laufen NICHT durch `tsc`, deshalb bleibt ein Arity-Fehler in Tests unsichtbar.
- `server/src/express/suggest-pillars.test.ts:179`, `error-contract.test.ts:239`,
  `pillar-advisor.test.ts:165`, `routes/parseTasks.test.ts:94` — je `new MissingApiKeyError()`
  ohne Argument (Finding 1).
- `frontend/src/components/LlmSettings.tsx:126-139` — `handleModelChange`, invalidiert
  `testResults[activeProvider.id]` NICHT (Finding 2).
- `frontend/src/components/LlmSettings.tsx:141-158` — `handleTest`, setzt das Ergebnis vor dem
  Call auf `undefined` (Vorbild für den Fix von Finding 2).

## Annahmen

- Dass `new MissingApiKeyError()` zur Laufzeit `message === ''` erzeugt, ist aus dem Code
  geschlossen (`super(undefined)`), NICHT lokal ausgeführt — im Sandbox-Repo fehlen
  `node_modules` komplett (`pnpm: command not found`, kein `server/node_modules`), also weder
  `tsc` noch `node --test` lauffähig. Nur `npx tsc` lief und scheiterte an
  `moduleResolution=node10` (fremde tsc-Version, nicht die des Projekts).
- PR-Body-Behauptung „`pnpm lint` grün" ist plausibel genau WEIL Tests aus `tsc` ausgeschlossen
  sind — der Widerspruch zu Finding 1 ist damit erklärt, nicht widerlegt.

## Verworfen

- „`sendError`-Helfer in den Routen sind jetzt tot" — geprüft per grep: `sendError` wird in
  `lektorat.ts:70,77`, `pillarAdvisor.ts:95,101,109,113`, `suggestPillars.ts:153,160,168,172,217,224,237`
  weiter für 400/500/503-Fälle genutzt. Kein Dead-Code-Finding.
- „Typ-Konflikt `Response<{text}|ErrorDto>` → `Response<components['schemas']['Error']>` in
  lektorat.ts" — Express-Methoden sind bivariant, kompiliert; kein Finding.
- „KoliBri-First verletzt" — der Readiness-Hinweis nutzt durchgehend `KolAlert`, kein eigenes
  Styling im Diff. Kein Finding.
- `testResult.latencyMs ?? 0` → „getestet, 0 ms" — bewusst NICHT als Finding gemeldet: dasselbe
  Muster steht schon vor dem PR in `LlmSettings.tsx:343`, wäre ein Pseudo-Finding.

## Offen

- Ticket-/Issue-Nummer zu PR 1016 nicht ermittelbar (keine Verknüpfung, kein `Closes`), daher
  konnten die AK aus `<!-- KI-ANALYSE:START/END -->` nicht gegengeprüft werden — beurteilt
  wurde gegen den PR-Body als Ersatz-Spezifikation.

## Nächster Schritt

- Fixup-Phase: die 4 `new MissingApiKeyError()`-Aufrufe mit einer Message versorgen und in
  `handleModelChange` (`LlmSettings.tsx:126-139`) `setTestResults((c) => ({...c, [activeProvider.id]: undefined }))`
  nach erfolgreichem `updateLlmProvider` ergänzen.

## Fallstricke

- **MEMORY.md-Kandidat (Review-Phase committet nicht, daher hier):** In diesem Repo schliesst
  `server/tsconfig.json` `src/**/*.test.ts` aus. Signatur-Änderungen an exportierten Klassen/
  Funktionen werden dadurch in Tests NICHT typgeprüft, und `tsx` strippt Typen ohne Check →
  `pnpm lint`/`pnpm build` bleiben grün, während Tests mit `undefined` weiterlaufen. → Nach
  jeder Konstruktor-/Signatur-Änderung `grep -rn "<Name>(" --include=*.test.ts server/src`.
- Sandbox ohne `node_modules` und ohne `pnpm` im PATH: lokales Verifizieren von Server-Tests
  ist in der Review-Phase nicht möglich, Befunde müssen statisch belegt werden (Datei:Zeile).
