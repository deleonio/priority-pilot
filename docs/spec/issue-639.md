# Issue 639: OpenRouter-Endpoint über ENV konfigurierbar

**Ziel**: `OPENROUTER_API_URL` als Env-Variable einführen, mit der sich der OpenRouter-Endpoint der
LLM-Kaskade konfigurieren lässt (analog zur bereits konfigurierbaren `OPENROUTER_MODEL`). Default
`https://openrouter.ai/api/v1`.

## Vorbedingung

- Die LLM-Kaskade aus #638 ist gemergt: `server/src/llm/llm.ts` ruft Mistral (Primär-Call) und
  OpenRouter (Verfeinerung) über eine gemeinsame `callProvider`-Funktion auf. Architektur-Doku:
  `docs/llm-providers.md`.
- Die in #639 ursprünglich beschriebene separate `OpenRouterProvider`-Klasse (mit eigenem
  `classifyPillars`/`parseTaskText`/`adviseActivities`-Interface, Referenz auf eine nie existierende
  `mistral-provider.ts`) wurde **nicht** so umgesetzt — #638 entschied sich stattdessen für das
  Kaskaden-Design (ein gemeinsamer Unterbau statt zwei Provider-Klassen, siehe
  `docs/llm-providers.md` „Architektur"). Die funktionalen #639-Akzeptanzkriterien sind dadurch
  bereits erfüllt, nur eben anders strukturiert als ursprünglich geplant:
  - classifyPillars/parseTaskText/adviseActivities laufen für OpenRouter mit —
    `server/src/llm/cascade.test.ts` (Mocked-Fetch-Tests „beide Keys" / „nur OpenRouter-Key").
  - `MissingApiKeyError` bei fehlendem Key — `cascade.test.ts` „kein Key → MissingApiKeyError".
  - Timeout/Error-Handling identisch zu Mistral — beide Provider laufen über dieselbe
    `callProvider`-Funktion (struktureller Fakt, kein separater Test nötig).
  - Prompt-Templates/JSON-Schema geteilt — `requestModelJson` nutzt für beide Provider dieselben
    `messages`, geprüft in `llm.test.ts`/`cascade.test.ts`.
  - `OPENROUTER_MODEL` konfigurierbar — bereits implementiert (`llm.ts`, `getOpenRouterConfig`).
- Einzige noch offene Lücke: der OpenRouter-**Endpoint** ist hartkodiert
  (`OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'` in `server/src/llm/llm.ts`).
  `docs/llm-providers.md` führt den Timeout explizit als „fest verdrahtet, nicht über ENV
  konfigurierbar" auf — der Endpoint fehlt sogar aus der ENV-Variablen-Übersichtstabelle. Kein Test
  im Repo prüft eine konfigurierbare URL.

## Schritte (zu testendes Verhalten)

1. `OPENROUTER_API_URL` gesetzt (z. B. `https://custom-gateway.example.com/v1`) und
   `OPENROUTER_API_KEY` gesetzt → ein Kaskaden-Aufruf (z. B. `parseTaskTextWithMistral`) sendet den
   Request an `${OPENROUTER_API_URL}/chat/completions`, **nicht** an den hartkodierten
   Standard-Endpoint.
2. `OPENROUTER_API_URL` **nicht** gesetzt → Standard-Endpoint bleibt
   `https://openrouter.ai/api/v1/chat/completions` (Regressionsschutz — bereits durch bestehenden
   Test „nur OpenRouter-Key → 1× fetch, OpenRouter-Endpoint" in `cascade.test.ts` abgedeckt, kein
   Duplikat nötig).

## Erwartetes Ergebnis

- Neuer Test in `server/src/llm/cascade.test.ts` ist aktuell **rot**: `getOpenRouterConfig()` liest
  `process.env.OPENROUTER_API_URL` nicht, sondern verwendet immer die Konstante
  `OPENROUTER_ENDPOINT`.
- Implementiert die Umsetzung `OPENROUTER_API_URL` (Default `https://openrouter.ai/api/v1`) und baut
  daraus `${url}/chat/completions` als Endpoint, wird der Test grün, ohne dass bestehende Tests
  brechen.

## Nicht Teil dieser Spec (bereits erfüllt, kein neuer Test)

Siehe Vorbedingung — alle übrigen #639-Akzeptanzkriterien sind durch die #638-Kaskade bereits funktional erfüllt und in `cascade.test.ts` / `llm.test.ts` abgedeckt.

---

## Versionierung

- **v1.0** (2026-08-16): Initialefassung für Issue #639. OpenRouter-Endpoint über ENV konfigurierbar spezifiziert.
- **v1.1** (2026-08-17): Nightly-Sync — Ist-Stand-Korrektur. Feature ist bereits implementiert: llm.ts nutzt OPENROUTER_API_URL mit Default https://openrouter.ai/api/v1, DEFAULT_OPENROUTER_API_URL konstante vorhanden.

---

## Status

**ABGESCHLOSSEN** — OpenRouter-Endpoint ENV-Konfiguration ist implementiert und in Produktion.
