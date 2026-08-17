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

Es gibt **zwei Konfigurationswege** — beide setzen dieselben Werte (Keys + OpenRouter-Modell):

| Weg                            | Wo                                | Wann sinnvoll                                                     |
| ------------------------------ | --------------------------------- | ----------------------------------------------------------------- |
| **A: Env-Variablen**           | `server/.env` bzw. Deployment-Env | Erstinbetriebnahme, Infrastructure-as-Code, Server-Neustart nötig |
| **B: Settings-UI** (seit #640) | `/settings` → Tab „LLM"           | Key-Wechsel im laufenden Betrieb, ohne Server-Zugriff/Neustart    |

**Vorrang:** Eine in der DB persistierte Konfiguration (Weg B) gewinnt **pro Feld** gegen die
Env-Variable (Weg A); leere/nicht gesetzte DB-Felder fallen auf die Env zurück
(`loadEffectiveLlmConfig` in [`server/src/llm/llm.ts`](../server/src/llm/llm.ts)). Das betrifft
genau drei Felder: `MISTRAL_API_KEY`, `OPENROUTER_API_KEY` und `OPENROUTER_MODEL`. `MISTRAL_MODEL`
und `OPENROUTER_API_URL` sind **ausschließlich über Env** konfigurierbar und in der Settings-UI
nicht erreichbar. Ohne DB-Konfiguration verhält sich der Server exakt wie vorher — reiner
Env-Betrieb.

### Weg A: Env-Variablen

#### Variablen-Übersicht

| Variable             | Pflicht | Default                        | Wirkung                                                |
| -------------------- | ------- | ------------------------------ | ------------------------------------------------------ |
| `MISTRAL_API_KEY`    | einzeln | —                              | Aktiviert Mistral (Primär-Stufe)                       |
| `OPENROUTER_API_KEY` | einzeln | —                              | Aktiviert OpenRouter (Verfeinerung)                    |
| `MISTRAL_MODEL`      | nein    | `mistral-medium-latest`        | Mistral-Modell                                         |
| `OPENROUTER_MODEL`   | nein    | `openrouter/free`              | OpenRouter-Modell                                      |
| `OPENROUTER_API_URL` | nein    | `https://openrouter.ai/api/v1` | OpenRouter-Basis-URL (Endpoint = `…/chat/completions`) |

> Mindestens ein API-Key muss gesetzt sein (über Env **oder** Settings-UI), sonst antworten alle
> LLM-Endpunkte mit HTTP 503.

#### Variante A: Kaskade (beide Provider — Empfehlung)

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

#### Variante B: Nur Mistral (ohne Verfeinerung)

```bash
MISTRAL_API_KEY=dein-mistral-key
```

OpenRouter wird nicht aufgerufen. Mistral's Antwort ist direkt das Endergebnis.

#### Variante C: Nur OpenRouter

```bash
OPENROUTER_API_KEY=sk-or-v1-dein-key
```

Mistral wird übersprungen. OpenRouter generiert allein (keine Verfeinerung).

### Weg B: Settings-UI (`/settings` → Tab „LLM")

Eingeloggte Nutzer konfigurieren die Kaskade auch direkt in der App: **Einstellungen → Tab „LLM"**.
Dort lassen sich `MISTRAL_API_KEY`, `OPENROUTER_API_KEY` und das OpenRouter-Modell setzen; die
Werte landen in der DB und wirken **sofort** — ohne Server-Neustart und ohne Zugriff auf die
Env-Datei.

**API-Keys sind write-only.** Die Eingabefelder sind maskiert und starten immer **leer** — ein
gespeicherter Key wird nie zurück in die UI geladen. Angezeigt wird pro Provider nur der Status
_„gespeichert"_ / _„nicht gesetzt"_, nie der Wert. Daraus folgt:

- **Leeres Feld = unverändert.** Speichern mit leerem Feld überschreibt nichts.
- **Zurück zum Env-Fallback:** Dafür gibt es die expliziten Aktionen **„Key löschen"** (nur
  sichtbar, wenn ein Key persistiert ist) bzw. **„Modell zurücksetzen"** (nur bei vom Default
  abweichendem Modell). Sie entfernen den DB-Wert, danach greift wieder die Env-Variable.
- Der Status spiegelt ausschließlich den **DB-Stand** — ein per Env gesetzter Key erscheint dort
  bewusst **nicht** als „gespeichert".
- Schlägt das Laden der Konfiguration fehl, zeigt der Tab nur eine Fehlermeldung statt eines
  Formulars, damit kein vorhandener Key versehentlich überschrieben wird.

---

## LLM-Test-Schalter (#749)

Über die Frontend-Einstellungen (Radio-Group „LLM-Provider") lässt sich pro Browser die
LLM-Anfrage auf einen einzelnen Provider pinning. Der Schalter gilt pro
`localStorage`-Eintrag (`llm-provider-selection`) — andere Nutzer/Geräte sind nicht
betroffen.

**Vertrag:** Optionaler Query-Parameter `provider` auf allen LLM-Generierungs-Endpunkten:

```
POST /tasks/parse-text?provider=mistral
POST /tasks/suggest-pillars?provider=openrouter
POST /pillars/advisor?provider=mistral
POST /lektorat?provider=openrouter
```

| `provider`-Wert        | Verhalten                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| fehlt (default)        | Kaskade unverändert (Mistral primär → OpenRouter-Verfeinerung)                            |
| `mistral`              | Nur Mistral-Call. Key fehlt → 503. Call scheitert → 502. **Kein** OpenRouter-Fallback.    |
| `openrouter`           | Nur OpenRouter solo. Key fehlt → 503. Call scheitert → 502. **Kein** Mistral-Primär-Call. |
| ungültig (z. B. `foo`) | HTTP 400 mit klarer Meldung. Nicht still Kaskade.                                         |

Das Frontend hängt `provider=getProvider()` an den Query-String jeder LLM-Anfrage an
(`frontend/src/api.ts`). Der Server validiert den Parameter in den Routen und reicht
ihn an `requestModelJson` durch, das die Kaskade entsprechend pinnt.

> **NICHT betroffen:** `POST /tasks/suggest-pillars/feedback` — das ist Persistenz, kein
> LLM-Call.

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
