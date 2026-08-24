# LLM-Provider einrichten

Der Server nutzt ein LLM für vier Funktionen: **Säulen-Klassifikation** (welche Lebensbalance-Säulen
passen zu einem Task?), **Freitext-Parsing** (Struktur aus Freitext), den **Aktivitäten-Berater**
(welche Aktivitäten zahlen auf welche Säulen ein?) und das **Lektorat**.

Jede Anfrage läuft an **genau einen** aktiven Provider. Es gibt zwei Arten:

- **Fixe Built-ins** „Mistral“ und „OpenRouter“ — immer angelegt, nicht lösch- oder bearbeitbar.
  Key, Basis-URL und Default-Modell kommen aus den ENV-Variablen des Servers
  (`MISTRAL_API_KEY`, `OPENROUTER_API_KEY` u. a., siehe `server/.env.example`).
- **Custom-Provider** — beliebig viele, zur Laufzeit in der App angelegt (Name, URL, Token),
  frei bearbeitbar und löschbar. Der Key liegt write-only in der Datenbank.

**Fallback:** Ist kein Custom-Provider aktiv (nie gewählt oder aktiver gelöscht), übernimmt
automatisch ein Built-in — Mistral, wenn `MISTRAL_API_KEY` gesetzt ist, sonst OpenRouter. Ist
kein Custom-Provider gewählt **und** kein Built-in-Key vorhanden, antworten die LLM-Endpunkte
HTTP 503.

**Modellwahl:** Die verfügbaren Modelle des aktiven Providers werden live von dessen
OpenAI-kompatiblen `GET /models`-Endpoint geholt (`GET /llm-providers/{id}/models`) und in der
App als Single-Select angeboten. Die Wahl persistiert am Provider; Built-ins defaulten auf das
ENV-Modell (`MISTRAL_MODEL`/`OPENROUTER_MODEL`), solange nichts gewählt ist. Die Radio-Group
zeigt jeden Provider als „Name (Modell)“. Scheitert der Live-Abruf, liefert der Built-in Mistral
einen eingebauten Katalog bekannter `-latest`-Modelle als Fallback (Antwort `source:
'fallback'`, in der App gekennzeichnet) — Mistral verlangt für `/models` einen Key mit aktivem
Abo und antwortet z. B. nach Free-Tier-Ablauf mit HTTP 402. Custom-Provider verlangen deshalb
das Modell schon beim Anlegen; ohne Katalog bliebe ein Live-Fehler sonst ohne Wahlmöglichkeit.

> **Wo der Code lebt:** [`server/src/llm/`](../server/src/llm/) — `llm.ts` (Aufruf),
> `llmProviders.ts` (Provider-Verwaltung, Built-ins, ENV-Auflösung), `index.ts` (Barrel-Exporte).

---

## Architektur

```
Express-Route                Single-Provider (server/src/llm/llm.ts)
──────────────────────       ─────────────────────────────────────────────
POST /tasks/suggest-pillars  ┐
POST /tasks/parse-text       ├── requestModelJson()
POST /pillars/advisor        ┘   │
POST /lektorat                  └─ resolveProvider() → llm_providers
                                    │  (explizit aktiv ODER Built-in-Fallback)
                                    └─ 1 Call an Endpoint/Key/Modell des Providers
```

Alle Provider sprechen denselben API-Dialekt (OpenAI Chat Completions). Es gibt keine separate
Implementierung pro Provider — nur Endpoint, Key und Modell unterscheiden sich (`callProvider`).
Built-ins lösen ihre Werte zur Laufzeit aus den ENV-Variablen auf; Custom-Provider speichern
Basis-URL und Key in der `llm_providers`-Tabelle (ein gespeicherter `/chat/completions`-Suffix
aus Altbeständen wird toleriert).

**Fehlerverhalten:** Kein aktiver Provider, fehlender Key oder fehlendes Modell → HTTP 503 mit
klarer Meldung. Upstream-Fehler des Providers (HTTP-Fehler, Timeout, ungültige Antwort) → HTTP 502.
Ein Fallback auf einen _anderen_ Provider bei Upstream-Fehlern gibt es bewusst nicht — der
Built-in-Fallback greift nur bei der _Auswahl_, nicht bei Fehlerfällen.

---

## Provider verwalten

Eingeloggte Nutzer verwalten die Provider in der App: **Einstellungen → Tab „KI-Provider“**.

- **Radio-Group:** listet Built-ins und Custom-Provider; ein Klick aktiviert genau einen
  serverweit (`POST /llm-providers/{id}/activate`, alle anderen werden deaktiviert).
- **Modell-Select:** darunter erscheint die Modellliste des aktiven Providers; die Wahl wird
  sofort gespeichert.
- **Verwaltung:** „Neuer Provider“ legt einen Custom-Provider an (Name, Endpoint-Basis-URL,
  API-Key, Modell). Bearbeiten/Löschen gibt es nur für Custom-Provider — Built-ins sind fix.
- **Status-Hinweis:** zeigt, ob die KI-Features nutzbar sind (aktiver Provider mit Key und
  Modell) oder was fehlt.

Dazu gibt es die REST-API (alles hinter Login):

| Endpunkt                            | Wirkung                                                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `GET /llm-providers`                | Alle Provider inkl. effektiver Aktiv-Markierung — **ohne** API-Keys                                                       |
| `POST /llm-providers`               | Custom-Provider anlegen (Name, Endpoint, API-Key, Modell) — startet inaktiv                                               |
| `PUT /llm-providers/{id}`           | Bearbeiten; für Built-ins ist nur `model` erlaubt, sonst HTTP 400                                                         |
| `DELETE /llm-providers/{id}`        | Custom-Provider löschen (Built-ins → HTTP 400); Fallback übernimmt                                                        |
| `POST /llm-providers/{id}/activate` | Genau diesen Provider aktivieren, alle anderen deaktivieren                                                               |
| `GET /llm-providers/{id}/models`    | Verfügbare Modelle des Providers (Proxy auf dessen `GET /models`, kurz gecacht); Mistral-Fallback-Katalog bei Live-Fehler |

**API-Keys sind write-only.** Sie werden nie in API-Antworten serialisiert und nie in die UI
geladen; das Eingabefeld startet immer leer. Für Built-ins liegt der Key nie in der DB, sondern
nur im Server-ENV — die API signalisiert lediglich, OB einer vorhanden ist (`hasApiKey`).

---

## LLM-Test-Pinning (#749)

Der optionale Query-Parameter `provider` auf allen LLM-Endpunkten überschreibt den aktiven
Provider für **diesen einen Aufruf** — aufgelöst wird der Name Case-insensitiv gegen die
konfigurierten Provider:

```
POST /tasks/parse-text?provider=Mistral
POST /pillars/advisor?provider=OpenRouter
```

| `provider`-Wert        | Verhalten                               |
| ---------------------- | --------------------------------------- |
| fehlt (default)        | Der effektiv aktive Provider            |
| Name eines Providers   | Genau dieser Provider für diesen Aufruf |
| ungültig (z. B. `foo`) | HTTP 400 mit klarer Meldung             |

> **NICHT betroffen:** `POST /tasks/suggest-pillars/feedback` — das ist Persistenz, kein
> LLM-Call.
