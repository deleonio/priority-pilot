# Fixup PR #1061 — Runde 1 (F1–F4 alle behoben)

## Erledigt

- Review-Threads via GraphQL geholt (REST `pulls/comments` → 403 „Resource not accessible by
  integration"); Query per `--input`-Datei (`.ai-memory/gql-threads.json`, `gql-bodies.json`),
  da Multiline-Query im `-f`-Flag an gh/GraphQL-Parser scheitert.
- F2 behoben: `server/src/logics/nominatim.ts` — Factory `createNominatimRateLimiter` ersetzt durch
  module-level `isNominatimRateLimited(ip, session)` mit geteilter `rateLimitMap`. Aufrufer
  `routes/geocodeSearch.ts` + `routes/reverseGeocode.ts` umgestellt (Import + beide Call-Sites).
- F2-Zusatztest: `server/src/express/geocode-search.test.ts` — „Reverse-Geocode direkt nach Suche
  derselben Session → gedrosselt" (fetch-Mock chained: eigener Wrapper für /reverse, delegiert an
  mockNominatim für /search, real für den Rest; afterEach-Restore greift trotzdem).
- F1 behoben: `frontend/src/lib/useAddressSearch.test.ts` NEU — 4 Tests (Mindestlänge, Debounce
  1 Aufruf/letzter Text, Überholschutz aborted + späte Antwort verworfen, Unmount-abort) mit
  `vi.useFakeTimers()` + Deferred-Promises + `vi.mock('../api')`.
- F3 behoben: Cleanup in `useAddressSearch.ts` ruft jetzt `controller?.abort()` (mit `let controller`
  vor dem Timer, `const current` IM Timer-Callback — sonst TS18048 „possibly undefined" in den
  .then/.catch/.finally-Closures); `.then` hat jetzt ebenfalls einen abort-Guard (reale Lücke:
  Mock-Adapter, die trotz abort resolven, hätten alte suggestions gesetzt).
- F3-loading: `TaskForm.tsx` destrukturiert jetzt `loading: addressLoading` und gibt es als
  `_hint={addressLoading ? 'Adresse wird gesucht …' : undefined}` an die KolCombobox (Prop laut
  kolibri-mcp spec/combobox vorhanden).
- F4 behoben: `frontend/e2e/issue-1061-task-address.spec.ts` NEU — 375×667, `page.route('**/api/v1/geocode-search*')`
  mit 5 langen display_names, Öffnen via „neuen task anlegen"+„überspringen", `getByLabel('Adresse (optional)')`,
  Bounding-Box-Checks (nicht scrollWidth — App-Shell clippt). Läuft grün (2× verifiziert).
- GATE: format ✓, prettier ✓, lint ✓ (nach 2 Fixes: TS18048 + Deferred-Typisierung), knip ✓ (nur
  pre-existing Configuration hints), frontend test 421 passed, server test fail 0 (session.test.ts
  rot wegen fehlendem Redis — bekannter Sandbox-Fall, CI hat redis-Service; MEMORY.md 2026-08-25).
- Impeccable-Detector `.claude/skills/impeccable/scripts/detect.mjs` existiert in diesem Repo NICHT → Schritt entfällt.

## Relevante Stellen

- `server/src/logics/nominatim.ts` — geteilter Rate-Limiter (F2).
- `server/src/express/routes/{geocodeSearch,reverseGeocode}.ts` — Consumer.
- `server/src/express/geocode-search.test.ts` — 6 Tests inkl. neuem Cross-Route-Test.
- `frontend/src/lib/useAddressSearch.ts` — abort-Guards + Cleanup-abort.
- `frontend/src/lib/useAddressSearch.test.ts` — Hook-Vertrag.
- `frontend/src/components/TaskForm.tsx:274ff,887ff` — addressLoading → `_hint`.
- `frontend/e2e/issue-1061-task-address.spec.ts` — 375px-Layout-Test.

## Annahmen

- Thread-IDs (GraphQL): F1=PRRT_kwDONloM186c5Bis, F2=PRRT_kwDONloM186c5Biy,
  F3=PRRT_kwDONloM186c5BjA, F4=PRRT_kwDONloM186c5BjK (Reply+Resolve via GraphQL-Mutation nötig).
- CI war vor dem Fixup grün (nur precheck pass, Rest skipping/pending des Fixup-Runs).

## Verworfen

- Mock im F1-Test wie echtes fetch bei abort rejecten zu lassen — stattdessen abort-Guard in
  `.then` des Hooks ergänzt (robuster, Adapter-agnostisch).
- Playwright-MCP-Design-Check — Änderung ist nur ein konditionaler `_hint`; Layout-Verhalten deckt
  der neue 375px-e2e-Test ab.

## Offen

- Nichts. Commit f215c176 gepusht, alle 4 Threads beantwortet + resolved (Reply-Comment-IDs
  3873773753/3873774224/3873774676/3873775099), CI auf f215c176 grün (verify + e2e 1–4 pass).
  Nächste Review-Runde (Delta-Review) macht der CI-Workflow.

## Nächster Schritt

- Keiner — Fixup-Runde 1 abgeschlossen.

## Fallstricke

- gh REST pulls/comments in dieser Sandbox → 403; GraphQL mit `--input`-Datei nutzen.
- `let controller` + Zuweisung im Timer: TS verliert Narrowing in Closures → lokale `const current`
  im Callback verwenden.
- Kein VERDICT am Ende dieser Phase (commits determine progress); ai-review-Sammelkommentar
  (5441983273) NICHT anfassen — Review-Runde 2 pflegt ihn.
