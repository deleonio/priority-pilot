# Issue 1012 — Fixup (Runde 1)

## Erledigt
- Beide Review-Findings behoben, lokal grün (lint/knip(nur pre-existing hints)/format +
  Pre-Commit-Hook), committet als 2830ea73 und gepusht auf feat/llm-test-prompt.
- Finding 1 (serverseitiger Schutz POST /:id/test): Ergebnis-Cache pro Provider-ID in
  llmProviders.ts (`TEST_RESULT_TTL_MS = 10_000`, `testResultsCache`, `resetProviderTestCache`);
  laufende Tests teilen ihr Promise (expiresAt=Infinity), TTL läuft ab Antwort; PUT/DELETE
  invalidieren analog modelsCache; Runner-Throw löscht den Eintrag. Keine OpenAPI-Änderung.
- Finding 2 (Duplikation): `server/src/llm/upstreamError.ts` neu mit `upstreamErrorDetail()`;
  llm.ts (callProvider, war llm.ts:350-373) und llmProviders.ts importieren es, lokale Kopie gelöscht.
- Tests: llmProviders.test.ts — `resetProviderTestCache` im beforeEach, Aufruf-Zähler
  `testRunnerCalls` im injizierten Runner, neuer Test „Test-Cooldown“ (serieller Cache-Hit +
  PUT-Invalidierung; Modell mistral-small-latest via PUT auf Built-in erlaubt).
- Review-Threads replied + resolved (GraphQL): PRRT_kwDONloM186b7aRO (Finding 1, Reply 3849427567),
  PRRT_kwDONloM186b7aZd (Finding 2, Reply 3849428007) — beide isResolved=true.
- Git-Identität war nicht gesetzt → user.name/email gesetzt (Claude / noreply@anthropic.com).

## Relevante Stellen
- server/src/express/routes/llmProviders.ts — Cache-Block nach `RunProviderTest`-Typ, Route
  POST /llm-providers/:id/test (Cache-Check nach Vorab-Checks), PUT/DELETE invalidieren.
- server/src/llm/upstreamError.ts — geteilte `upstreamErrorDetail(response)`, 200-Zeichen-Kürzung.
- server/src/llm/llm.ts — callProvider-Fehlerblock jetzt 3 Zeilen via Import.
- server/src/express/routes/llmProviders.test.ts — Cooldown-Test am Dateiende der Test-Sektion.

## Annahmen
- TTL 10s + PUT-Invalidierung erfüllt die Review-Vorgabe („In-Flight-Dedupe ODER kurzer Cooldown“
  — umgesetzt als beides in einem Mechanismus).
- Kein Entscheidungs-Finding vorhanden → kein ai-fixup-decisions-Kommentar, kein needs-human.
- Neue Tests werden erstmals in CI laufen (lokal verboten) — deterministisch gehalten: serielle
  Aufrufe, keine Timer, Deltas statt absoluter Zähler.

## Verworfen
- Promise.all-Parallel-Test: Rennfall über die await-Lücke (findByPk vor Cache-Set) → flaky, weggelassen.
- 429-Cooldown-Antwort: hätte OpenAPI-Vertrag erweitern müssen — Ergebnis-Cache braucht das nicht.

## Offen
- (keine — CI auf 2830ea73 grün: verify + e2e (1–4) pass)

## Nächster Schritt
- Runde abgeschlossen ohne Verdict (Commits = Fortschritt). Nächste Phase: Review-Runde 2 prüft
  2830ea73 nach; bei neuen Findings gleiche Dateien/ Stellen wie oben.

## Fallstricke
- GraphQL im Bash-Tool: Variablen im selben Call; `addPullRequestReviewThreadReply` will
  `pullRequestReviewThreadId`, Resolve heißt `resolveReviewThread(input:{threadId})` (MEMORY 08-23).
- Keine Labels setzen. Tests nie lokal ausführen.
- Edit-Tool brauchte exakt neu gelesenen Block (Unicode-Mismatch bei „—“/Anführungszeichen aus
  älterem Read) — bei Match-Fehler Dateistelle frisch lesen und klein schneiden.
