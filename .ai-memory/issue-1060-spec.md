# Issue #1060 — Spec-Phase (rote Tests)

## Erledigt

- Branch `feat/issue-1060-mistral-default-model` von main, Commit `7e83d3e0`
  (test: red spec tests for #1060), gepusht.
- Spec angelegt: `docs/spec/issue-1060.md` (AK1-AK4 + Test-Tabelle, AK4 bewusst ohne Test — Doku).
- Rote/angepasste Tests:
  - `server/src/llm/llmProviderActivation.test.ts:103-107` — AK1-Assertion auf
    `mistral-small-latest` umgestellt (**rot**: Code liefert `mistral-medium-latest`).
  - `server/src/llm/llmProviderActivation.test.ts:142-163` — AK3: 402-Mock (`detail: Check your
    subscription …`), `MistralRequestError`-Message muss Modell + `HTTP 402` + Ursache enthalten,
    Key nie (**rot**: Message enthält kein Modell).
  - `server/src/llm/llmProviderActivation.test.ts:121-140` — AK2: `MISTRAL_MODEL` schlägt Default;
    App-Wahl (`updateProvider(model)`) schlägt ENV + Default (grün — Regression-Wächter).
  - `server/src/express/routes/llmProviders.test.ts:179` — Default-Spiegel auf
    `mistral-small-latest`; Persistenz-Assertion auf `mistral-large-latest` geändert
    (damit Wahl ≠ Default bleibt). (**rot**)
- Rot verifiziert: activation-Suite `pass 9 / fail 2` (AK1 + AK3), routes-Suite `pass 17 / fail 1`.
- Draft-PR **#1062** erstellt (Body via `.ai-memory/issue-1060-pr-body.md`, enthält `Closes #1060`).
  `closingIssuesReferences` ist bei Draft-PRs leer (GitHub füllt ihn erst später) — Body-Link reicht.
- Lefthook-Pre-Commit (Format/Knip/Lint) grün durchgelaufen; Formatter hat Spec + Tests umgebrochen.

## Relevante Stellen

- `server/src/llm/llmProviders.ts:84` — `defaultModel: 'mistral-medium-latest'` → hier muss AK1 ansetzen.
- `server/src/llm/llmProviders.ts:173` — `provider.model || ENV || defaultModel` (AK2-Rangfolge, schon korrekt).
- `server/src/llm/llm.ts:351-357` — `callProvider()` 502-Meldung `${config.label} antwortete mit HTTP …`
  → AK3: `config.model` muss in die Meldung (z. B. `Mistral (mistral-small-latest) antwortete …`).
- `server/src/llm/upstreamError.ts` — `upstreamErrorDetail()` liefert `detail` aus dem Body (Mock deckt das ab).

## Annahmen

- AK3-Test erwartet das Default-Modell `mistral-small-latest` in der Meldung (kein ENV, keine Wahl
  gesetzt) — nach AK1-Fix konsistent; bei abweichendem ENV/Wahl muss die Impl. das effektiv
  verwendete Modell nennen (AK3-Text lässt das offen, Test nutzt den Default-Fall).
- AK4 (Doku-Konsistenz) ist Review-Sache, kein automatisierter Test (ADR 0001).

## Verworfen

- Eigener llm.test.ts-Block für AK3 — braucht DB/Provider-Auflösung;_activation-Test-Datei hat
  beides schon ( sequelize.sync + ENV-Handling). Kein Duplikat.
- API-Persistenz-Test für AK2 — bereits abgedeckt durch routes-Test „Built-in-Modellwahl“.

## Offen

- -

## Nächster Schritt

- Implementierungs-Phase: PR #1062 checkout, `llmProviders.ts:84` auf `mistral-small-latest`,
  `callProvider()`-Meldung um Modell ergänzen, Doku (AK4) angleichen, Tests grün fahren.

## Fallstricke

- Draft-PR-`closingIssuesReferences` bleibt leer — Verifikation per Body-Grep, nicht per API-Feld.
- Die zwei AK2-Tests sind absichtlich schon grün (Rangfolge existiert); nicht als Fehler werten.
- Pre-Commit-Formatter bricht Zeilen um — Zeilennummern oben gelten für den committeten Stand.
