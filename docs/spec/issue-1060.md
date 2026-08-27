# Spec #1060 — Mistral-Default-Modell und Fehlerdiagnose

## Ziel

Die Mistral-Anbindung funktioniert nach dem Provider-Refactoring wieder ohne explizite
Modellwahl. Ursache der Regression: Der Code-Default des Built-ins Mistral wurde auf das
abo-pflichtige `mistral-medium-latest` umgestellt, während die Dokumentation durchgehend
`mistral-small-latest` nennt. Ein Key, dessen Plan `mistral-medium-latest` nicht abdeckt,
antwortet auf den Chat-Completions-Aufruf mit HTTP 402 „Check your subscription“ — ohne dass
sich am Abo etwas geändert hat.

## Preconditions

- Kein Custom-Provider aktiv; Mistral-Built-in ist über `MISTRAL_API_KEY` der Fallback
  (oder explizit per Radio-Wahl aktiviert).
- Weder in der App ein Modell gewählt (`provider.model` leer) noch `MISTRAL_MODEL` gesetzt.

## Verhalten (Akzeptanzkriterien)

### AK1 — Code-Default `mistral-small-latest`

Ohne gewähltes Modell und ohne `MISTRAL_MODEL` löst sich der Built-in Mistral auf
`mistral-small-latest` auf (statt `mistral-medium-latest`). Damit greift — analog zum
OpenRouter-Default `openrouter/free` — bewusst ein kostenfreies Modell.

### AK2 — Vorrang bleibt: Wahl > ENV > Default

- Ein gesetztes `MISTRAL_MODEL` schlägt den Code-Default.
- Eine in der App getroffene Modellwahl (`provider.model` persistiert in der DB) schlägt
  ENV und Default.
- Die Reihenfolge ändert sich durch AK1 nicht.

### AK3 — Fehlermeldung nennt das verwendete Modell

Antwortet der Provider mit einem Fehlerstatus, nennt die `MistralRequestError`-Meldung neben
Label und Status auch das **verwendete Modell**, z. B.
`Mistral (mistral-medium-latest) antwortete mit HTTP 402: Check your subscription …`.
Die Upstream-Ursache (Klartext aus dem Body) bleibt erhalten; der API-Key taucht nie auf.
So kann der Nutzer Abo- vs. Modellproblem unterscheiden.

### AK4 — Dokumentation konsistent zum Code

`openapi.yml`, `server/.env.example`, `docs/server-setup.md`, `docs/deployment.md` und
`docs/llm-providers.md` nennen denselben Default wie der Code. Reine Doku-Konsistenz —
kein Test (Markdown/YAML wäre ein zahnloser String-Match, ADR 0001); Prüfung per Review.

## Tests (rot, aus dieser Spec abgeleitet)

Alle in `server/src/llm/llmProviderActivation.test.ts` (node:test mit DB + gemocktem Fetch):

| Test                                                       | AK  | prüft                                                                                                               |
| ---------------------------------------------------------- | --- | ------------------------------------------------------------------------------------------------------------------- |
| Fallback Mistral ohne Wahl/ENV sendet Default-Modell       | AK1 | Fetch-Body `model === 'mistral-small-latest'` (Anpassung der bestehenden Assertion, die den alten Default spiegelt) |
| `MISTRAL_MODEL` schlägt Default                            | AK2 | Fetch-Body `model === 'ministral-8b-latest'` bei gesetztem ENV                                                      |
| App-Wahl schlägt ENV und Default                           | AK2 | nach `updateProvider(model)` schickt der Call das gewählte Modell trotz gesetztem `MISTRAL_MODEL`                   |
| 402-Fehlermeldung nennt Modell, Status, Ursache — ohne Key | AK3 | `MistralRequestError`-Message matcht Modellkennung + `HTTP 402` + Upstream-Detail und enthält den API-Key nicht     |

Die Persistenz der Modellwahl über die API ist bereits durch
`server/src/express/routes/llmProviders.test.ts` („Built-in-Modellwahl: PUT mit nur model“)
gedeckt — kein Duplikat.
