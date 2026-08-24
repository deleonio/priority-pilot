# LLM-Provider einrichten

Der Server nutzt ein LLM für drei Funktionen: **Säulen-Klassifikation** (welche Lebensbalance-Säulen
passen zu einem Task?), **Freitext-Parsing** (Struktur aus Freitext) und den **Aktivitäten-Berater**
(welche Aktivitäten zahlen auf welche Säulen ein).

Seit dem **Single-Provider-System (#951)** läuft jede Anfrage an **genau einen** aktiven Provider —
die frühere Mistral→OpenRouter-Kaskade ist entfernt. Beliebig viele Provider sind konfigurierbar;
per Radio-Button (Einstellungen → Tab „LLM") wird genau einer aktiviert.

> **Wo der Code lebt:** [`server/src/llm/`](../server/src/llm/) — `llm.ts` (Aufruf),
> `llmProviders.ts` (Provider-Verwaltung + Migration), `index.ts` (Barrel-Exporte).

---

## Architektur

```
Express-Route                Single-Provider (server/src/llm/llm.ts)
──────────────────────       ─────────────────────────────────────────────
POST /tasks/suggest-pillars  ┐
POST /tasks/parse-text       ├── requestModelJson()
POST /pillars/advisor        ┘   │
POST /lektorat                  └─ resolveProvider() → llm_providers (aktiv)
                                    └─ 1 Call an Endpoint/Key/Modell des Providers
```

Alle Provider sprechen denselben API-Dialekt (OpenAI Chat Completions). Es gibt keine separate
Implementierung pro Provider — nur Endpoint, Key und Modell unterscheiden sich (`callProvider`).

**Fehlerverhalten:** Kein aktiver Provider (oder sein Key fehlt) → HTTP 503 mit klarer Meldung.
Upstream-Fehler des Providers (HTTP-Fehler, Timeout, ungültige Antwort) → HTTP 502. Ein Fallback
auf einen anderen Provider existiert bewusst nicht mehr.

---

## Provider verwalten

Eingeloggte Nutzer verwalten die Provider in der App: **Einstellungen → Tab „LLM"**. Die
Radio-Group zeigt alle konfigurierten Provider; ein Klick aktiviert ihn serverweit
(`POST /llm-providers/{id}/activate`, alle anderen werden deaktiviert).

Dazu gibt es die REST-API (`GET/POST/PUT/DELETE /llm-providers`):

| Endpunkt                            | Wirkung                                                                      |
| ----------------------------------- | ---------------------------------------------------------------------------- |
| `GET /llm-providers`                | Alle Provider inkl. Aktiv-Markierung — **ohne** API-Keys                     |
| `POST /llm-providers`               | Provider anlegen (Name, Endpoint, API-Key, Modell); erster wird direkt aktiv |
| `PUT /llm-providers/{id}`           | Provider bearbeiten; API-Key nur bei Änderung senden (leer = unverändert)    |
| `DELETE /llm-providers/{id}`        | Provider löschen                                                             |
| `POST /llm-providers/{id}/activate` | Genau diesen Provider aktivieren, alle anderen deaktivieren                  |

**API-Keys sind write-only.** Sie werden nie in API-Antworten serialisiert und nie in die UI
geladen; das Eingabefeld startet immer leer.

---

## Migration & Legacy

Bestehende Konfiguration wird automatisch übernommen: Steht eine Zeile im alten
`/llm-config`-System (#640) mit Mistral-/OpenRouter-Keys, werden beim ersten Zugriff
„Mistral" (aktiv) und „OpenRouter" (inaktiv) als Provider angelegt. Die alten Endpunkte
`GET/PUT /llm-config` bleiben für Kompatibilität erhalten, steuern aber nichts mehr —
maßgeblich sind ausschließlich die `llm_providers`-Einträge.

Die früheren Env-Variablen (`MISTRAL_API_KEY`, `OPENROUTER_API_KEY`, …) sind mit der Kaskade
entfallen: Sie werden nicht mehr gelesen. Provider-Konfiguration erfolgt zur Laufzeit über die
UI/API — ohne Server-Neustart.

---

## LLM-Test-Pinning (#749/#951)

Der optionale Query-Parameter `provider` auf allen LLM-Endpunkten überschreibt den aktiven
Provider für **diesen einen Aufruf** — aufgelöst wird der Name Case-insensitiv gegen die
konfigurierten Provider:

```
POST /tasks/parse-text?provider=Mistral
POST /pillars/advisor?provider=OpenRouter
```

| `provider`-Wert        | Verhalten                               |
| ---------------------- | --------------------------------------- |
| fehlt (default)        | Der aktive Provider (`llm_providers`)   |
| Name eines Providers   | Genau dieser Provider für diesen Aufruf |
| ungültig (z. B. `foo`) | HTTP 400 mit klarer Meldung             |

Das Frontend pinnt die Auswahl der Radio-Group lokal (`localStorage`-Key `llm-provider-selection`,
JSON-Objekt) und hängt `provider=<Name>` an jede LLM-Anfrage (`frontend/src/api.ts`).

> **NICHT betroffen:** `POST /tasks/suggest-pillars/feedback` — das ist Persistenz, kein
> LLM-Call.
