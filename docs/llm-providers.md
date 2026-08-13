# LLM-Provider einrichten

Der Server nutzt ein LLM für drei Funktionen: **Säulen-Klassifikation** (welche Lebensbalance-Säulen
passen zu einem Task?), **Freitext-Parsing** (Struktur aus Freitext) und den **Aktivitäten-Berater**
(welche Aktivitäten zahlen auf welche Säulen ein).

Alle Anfragen laufen als **Kaskade**: Mistral generiert die erste Antwort, OpenRouter verfeinert sie
als Zweitmeinung. Fällt ein Provider aus, liefert der andere allein das Ergebnis.

> **Wo der Code lebt:** [`server/src/llm/`](../server/src/llm/) — `llm.ts` (Kaskaden-Logik),
> `index.ts` (Barrel-Exporte).

---

## Architektur

```
Express-Route                Kaskade (server/src/llm/llm.ts)
──────────────────────       ──────────────────────────────────────
POST /tasks/suggest-pillars  ┐
POST /tasks/parse-text       ├── requestModelJson()
POST /pillars/advisor        ┘   │
                                 ├─ 1. Mistral (Primär-Call)
                                 │     ↓ Antwort
                                 ├─ 2. OpenRouter (Verfeinerung: Mistral's Antwort + "Optimiere")
                                 │     ↓ verfeinerte Antwort = Endergebnis
                                 └─ Fallback: ein Provider aus → der andere allein
```

Mistral und OpenRouter sprechen denselben API-Dialekt (OpenAI Chat Completions). Die Kaskade nutzt
**einen** `callProvider`-Unterbau, zweimal aufgerufen — nur Endpoint, Key und Modell unterscheiden
sich. Es gibt keine separate Implementierung pro Provider.

### Verfeinerungs-Schritt

OpenRouter bekommt die Original-Nachrichten **plus** Mistral's Antwort als `assistant`-Message und
die Anweisung:

> _"Ein anderes Modell hat die obige Antwort generiert. Überprüfe und optimiere sie: korrigiere
> Fehler, mache die Zuordnungen präziser, ergänze Aspekte, die das erste Modell übersehen haben
> könnte. Behalte exakt das gleiche JSON-Format bei."_

---

## Einrichtung

### Variablen-Übersicht

| Variable             | Pflicht | Default                 | Wirkung                             |
| -------------------- | ------- | ----------------------- | ----------------------------------- |
| `MISTRAL_API_KEY`    | einzeln | —                       | Aktiviert Mistral (Primär-Stufe)    |
| `OPENROUTER_API_KEY` | einzeln | —                       | Aktiviert OpenRouter (Verfeinerung) |
| `MISTRAL_MODEL`      | nein    | `mistral-medium-latest` | Mistral-Modell                      |
| `OPENROUTER_MODEL`   | nein    | `openrouter/free`       | OpenRouter-Modell                   |

> Mindestens ein API-Key muss gesetzt sein, sonst antworten alle LLM-Endpunkte mit HTTP 503.

### Variante A: Kaskade (beide Provider — Empfehlung)

```bash
# server/.env  (oder echte ENV im Deployment)
MISTRAL_API_KEY=dein-mistral-key
OPENROUTER_API_KEY=sk-or-v1-dein-key
# Optional — andere Modelle:
# MISTRAL_MODEL=mistral-large-latest
# (Default ist mistral-medium-latest)
# OPENROUTER_MODEL=openrouter/free
```

Mistral generiert → OpenRouter verfeinert. Höchste Qualität, aber ~doppelte Latenz pro Request.

### Variante B: Nur Mistral (ohne Verfeinerung)

```bash
MISTRAL_API_KEY=dein-mistral-key
```

OpenRouter wird nicht aufgerufen. Mistral's Antwort ist direkt das Endergebnis.

### Variante C: Nur OpenRouter

```bash
OPENROUTER_API_KEY=sk-or-v1-dein-key
```

Mistral wird übersprungen. OpenRouter generiert allein (keine Verfeinerung).

---

## Fehlertoleranz

| Situation                    | Verhalten                             | HTTP    |
| ---------------------------- | ------------------------------------- | ------- |
| Beide Provider erfolgreich   | OpenRouter-Verfeinerung               | 200     |
| Mistral failt, OpenRouter ok | OpenRouter allein (ohne Verfeinerung) | 200     |
| Mistral ok, OpenRouter failt | Mistral's Antwort                     | 200     |
| Beide failen                 | `MistralRequestError`                 | **502** |
| Kein API-Key überhaupt       | `MissingApiKeyError`                  | **503** |

Die Fehlermeldungen nennen den jeweiligen Provider (z. B. "Mistral antwortete mit HTTP 500").

### Fest verdrahtet (nicht über ENV konfigurierbar)

- **Timeout:** 30 s pro Provider-Call (`REQUEST_TIMEOUT_MS`)
- **Temperatur:** 0, **Response-Format:** `json_object`
- **Auth:** `Authorization: Bearer <apiKey>` (beide Provider identisch)

---

## Beispiel: komplette `.env` für die Kaskade

```bash
# LLM-Kaskade (Mistral → OpenRouter-Verfeinerung)
MISTRAL_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENROUTER_MODEL=openrouter/free

# ... restliche Konfiguration (DB, Port, Auth etc.) wie in server/.env.example
```

API-Keys erstellen:

- **Mistral:** <https://console.mistral.ai> → API Keys
- **OpenRouter:** <https://openrouter.ai/keys> — verfügbare (Free-)Modelle: <https://openrouter.ai/models>

Beim Server-Start wird die Konfiguration geloggt (`ENV-Konfiguration beim Start:`) — dort siehst
du `MISTRAL_API_KEY` / `OPENROUTER_API_KEY` (maskiert) und das Modell.
