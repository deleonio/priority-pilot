# Issue #1060 — Triage (Mistral-API-Anbindung funktioniert nicht mehr)

## Erledigt

- **Re-Triage-Lauf 3 (2026-08-27T16:18Z) — AUFGELOEST, Ampel 🔴 → 🟢.**
- Delta-Kommentar seit `stand=2026-08-27T13:43:03Z` gelesen: Antwort von @deleonio
  (2026-08-27T16:16:11Z) auf den `ai-triage-decision`-Kommentar: „Mistral antwortete mit
  **HTTP-402**. Wichtig. Meine subscription war damals nicht das Problem." + 3x „Ja"
  (Key gesetzt / Mistral aktiv markiert / OpenRouter funktioniert). Bindend.
- Damit Fall (a) Konfiguration und (b) abgelaufenes Abo aus Lauf 2 ausgeschlossen → Fall (c).
- **Ursache gefunden** (Widerspruch Code vs. Doku, per grep belegt):
  `server/src/llm/llmProviders.ts:84` = `defaultModel: 'mistral-medium-latest'`, waehrend
  `openapi.yml:252`, `:296`, `:367` unveraendert `mistral-small-latest` als Default nennen.
  Das Refactoring hat den Default auf ein abo-pflichtiges Modell gehoben → 402 trotz gueltigem
  Key. OpenRouter defaultet auf `openrouter/free` und laeuft deshalb weiter.
- Issue-Body neu geschrieben (`stand=2026-08-27T16:18:09Z`) mit Ursache, 4 AKs, 4 Testfaellen,
  Ampel 🟢, „Offene Fragen: Keine". Routing unveraendert (ux nein / spec+impl+review ja,
  sonnet, medium). Quelle: `.ai-memory/issue-1060-body.md`.
- Labels final: `ai:analysed`, `ai:needs-spec`, `ai:model:sonnet` (verifiziert per
  `gh issue view 1060 --json labels`). `ai:needs-analyse` + `ai:needs-human` entfernt.
- KEIN Ping-Kommentar (Skill: bei eindeutigem Ergebnis ist der Body-Block die vollstaendige
  Kommunikation).

## Relevante Stellen

- `server/src/llm/llmProviders.ts:84` — der Bug: `defaultModel: 'mistral-medium-latest'`.
  Fix-Ziel: `mistral-small-latest`.
- `server/src/llm/llmProviders.ts:173` — `toRuntimeConfig()`:
  `provider.model || process.env[envModel] || definition.defaultModel` (Vorrang-Kette, AK2).
- `server/src/llm/llmProviders.ts:85-93` — `fallbackModels` enthaelt `mistral-small-latest`;
  greift auch, wenn `GET /models` mit 402 antwortet → Nutzer mit persistierter Medium-Wahl
  koennen in der UI umschalten.
- `server/src/llm/llmProviders.ts:102` — OpenRouter-Default `openrouter/free` (Vorbild-Muster).
- `server/src/llm/llm.ts:351-357` — `callProvider()`, Fehlermeldung
  `` `${config.label} antwortete mit HTTP ${status}: ${detail}` `` — hier fehlt die
  Modellkennung (AK3).
- `openapi.yml:252,296,367` — Doku-Default `mistral-small-latest` (der Beleg fuer die Aenderung).
- `server/.env.example:19-20`, `docs/server-setup.md:128`, `docs/deployment.md:107` — nennen
  `mistral-medium-latest`, muessen mit AK4 angeglichen werden.
- **Tests, die den alten Default festschreiben und mitgezogen werden muessen:**
  `server/src/llm/llmProviderActivation.test.ts:103`,
  `server/src/express/routes/llmProviders.test.ts:179`.
  Referenz fuer 402-Assertion: `server/src/express/routes/llmProvidersTest.test.ts:58-64`.

## Annahmen

- `mistral-medium-latest` ist im Plan des Melders nicht enthalten, `mistral-small-latest`
  schon. Nicht direkt verifizierbar (kein Zugriff auf das Mistral-Konto), aber die einzige
  Erklaerung, die 402 + „Abo war nicht das Problem" + „hat frueher funktioniert" zugleich
  deckt — und der Doku-Default belegt, dass genau dieses Modell sich geaendert hat.
- Der Melder hatte kein Modell explizit in der App gewaehlt (sonst greift der Code-Default
  gar nicht). Deshalb ist die DB-Wahl als Randbedingung im Body ausdruecklich erwaehnt.

## Verworfen

- Screenshot auslesen (`curl` auf `user-attachments`): vom Bash-Tool als
  genehmigungspflichtig abgelehnt (Lauf 2). Nicht mehr noetig — der Fehlertext kam als
  Kommentar-Antwort.
- Git-Archaeologie (`git log -- server/src/llm/`): Shallow-Clone
  (`git rev-parse --is-shallow-repository` = true), Historie nicht einsehbar. Ersatz gefunden:
  die stehengebliebene `openapi.yml`-Doku als „Fossil" des alten Defaults.

## Offen

- Keine. Ticket geht in die Spec-Phase.

## Nächster Schritt

Spec-Phase (Phase 3): rote Tests je AK1-AK3 schreiben, AK4 ist Doku (kein Test).
Reihenfolge im Impl: erst `llmProviders.ts:84` + die zwei bestehenden Default-Assertions,
dann die Modellkennung in `llm.ts:354`, zuletzt Doku/openapi.

## Fallstricke

- **AK1 allein heilt nicht jeden Nutzer**: wer `mistral-medium-latest` in der App gewaehlt hat,
  hat den Wert in der DB (`provider.model`) — der Default greift dann nicht. Diese Randbedingung
  nicht wegkuerzen, sonst wirkt der Fix im Feld unvollstaendig.
- Die zwei bestehenden Tests (`llmProviderActivation.test.ts:103`,
  `llmProviders.test.ts:179`) behaupten den ALTEN Default und werden mit dem Fix rot. Das ist
  erwartet — anpassen, nicht als Regression missdeuten.
- Fehlermeldung nie mit API-Key anreichern (write-only Serialisierung, siehe Kommentar in
  `llmProvidersTest.test.ts:9`).
