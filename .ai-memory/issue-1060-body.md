### Was ist das Problem?
Die Anbindung an die Mistral-API funktioniert nicht mehr, obwohl sie zuvor funktioniert hat.

### Wo tritt es auf?
Einstellungen → KI-Provider → Mistral

### Wie soll es sein?
Die Mistral-Anbindung soll wieder wie vor der letzten Änderung zuverlässig funktionieren, wenn Mistral als aktiver Provider ausgewählt ist.

### Woran messen wir das?
- Bei aktivem Mistral-Provider liefert eine KI-Anfrage (z. B. Klassifikation/Berater) wieder erfolgreich eine Antwort statt eines Fehlers
- Der im Screenshot sichtbare Fehler tritt nicht mehr auf

### Screenshots / weitere Hinweise
<img width="1080" height="2340" alt="Image" src="https://github.com/user-attachments/assets/2b57a443-1e99-4ecd-8e05-3968464f173e"/>

Offene Frage des Melders: Was hat sich seit der initialen Implementierung an der Mistral-Anbindung geändert?

<!-- KI-ANALYSE:START stand=2026-08-27T16:18:09Z -->
### Umsetzungskontext
Die Rueckmeldung des Melders (Kommentar vom 27.08.2026) beantwortet die offenen Fragen der
zweiten Analyse eindeutig: **HTTP 402**, `MISTRAL_API_KEY` gesetzt, Mistral als aktiver
Provider markiert, OpenRouter funktioniert in derselben Umgebung, **das Abo war nicht das
Problem**. Damit sind die Faelle (a) Konfiguration und (b) abgelaufenes Abo ausgeschlossen —
es bleibt die Regression aus dem Provider-Refactoring.

**Ursache (belegt):** Das Code-Default-Modell des Built-ins Mistral ist auf ein
abo-pflichtiges Modell umgestellt worden.

- `server/src/llm/llmProviders.ts:84` — `defaultModel: 'mistral-medium-latest'`
- `openapi.yml:252`, `openapi.yml:296`, `openapi.yml:367` — dokumentieren unveraendert den
  urspruenglichen Default **`mistral-small-latest`**

Diese Abweichung ist der einzige nachweisbare Verhaltensunterschied gegenueber dem Zustand
"hat frueher funktioniert": Ohne in der App gewaehltes Modell und ohne `MISTRAL_MODEL` gilt
der Code-Default (`toRuntimeConfig()`, `llmProviders.ts:173`:
`provider.model || ENV || defaultModel`). Ein Key, dessen Plan `mistral-medium-latest` nicht
abdeckt, beantwortet den Chat-Completions-Aufruf mit **HTTP 402 "Check your subscription"** —
genau das gemeldete Fehlerbild, ohne dass sich am Abo etwas geaendert haben muss. Dass
OpenRouter (Default `openrouter/free`) weiter laeuft, passt dazu.

- Betroffene Dateien: `server/src/llm/llmProviders.ts` (Z. 84 `defaultModel`), `server/src/llm/llm.ts`
  (`callProvider()` Z. 322-357, Fehlermeldung Z. 354), `openapi.yml` (Z. 252/296/367),
  `server/.env.example` (Z. 19-20), `docs/server-setup.md` (Z. 128), `docs/deployment.md` (Z. 107),
  `docs/llm-providers.md`
- Betroffene Komponenten: Built-in-Definition Mistral, Laufzeit-Aufloesung `toRuntimeConfig()`,
  Upstream-Fehlermeldung in `callProvider()`
- Vorhandenes Muster: Der Built-in OpenRouter defaultet mit `openrouter/free` bewusst auf ein
  kostenfreies Modell (`llmProviders.ts:102`) — dieselbe Logik gilt fuer Mistral.
- Randbedingungen:
  - Bestehende Tests behaupten den aktuellen Default und muessen mitgezogen werden:
    `server/src/llm/llmProviderActivation.test.ts:103`, `server/src/express/routes/llmProviders.test.ts:179`.
  - Nutzer, die `mistral-medium-latest` bereits in der App **gewaehlt** haben, tragen den Wert in
    der DB (`provider.model`); fuer sie aendert der Default nichts — sie muessen in
    Einstellungen → KI-Provider ein anderes Modell waehlen. Das ist moeglich, weil der
    eingebaute Fallback-Katalog (`fallbackModels`, `llmProviders.ts:85-93`) `mistral-small-latest`
    enthaelt und auch dann greift, wenn `GET /models` selbst mit 402 antwortet.
  - Der API-Key darf nie in Client-Antworten landen (write-only Serialisierung).
  - Custom-Provider und OpenRouter duerfen nicht brechen.
- Erwartetes Ergebnis: Bei aktivem Mistral-Built-in ohne explizite Modellwahl laeuft ein
  LLM-Aufruf wieder erfolgreich durch; tritt dennoch ein 402 auf, nennt die Fehlermeldung das
  verwendete Modell, sodass der Nutzer Abo- und Modellproblem unterscheiden kann.

### Akzeptanzkriterien
- AK1: Ohne gewaehltes Modell und ohne gesetztes `MISTRAL_MODEL` loest der Built-in Mistral auf
  `mistral-small-latest` auf (statt `mistral-medium-latest`).
- AK2: Ein gesetztes `MISTRAL_MODEL` und eine in der App getroffene Modellwahl haben weiterhin
  Vorrang vor dem Code-Default (Reihenfolge Wahl > ENV > Default unveraendert).
- AK3: Antwortet der Provider mit einem Fehlerstatus, nennt die Fehlermeldung neben Label und
  Status auch das **verwendete Modell** (z. B. `Mistral (mistral-medium-latest) antwortete mit
  HTTP 402: Check your subscription ...`); die Upstream-Ursache bleibt erhalten, der API-Key
  taucht nicht auf.
- AK4: `openapi.yml`, `server/.env.example`, `docs/server-setup.md`, `docs/deployment.md` und
  `docs/llm-providers.md` nennen denselben Default wie der Code — keine widerspruechlichen
  Angaben mehr.

### Testfälle
- Zu AK1: `node:test`-Unit in `server/src/llm/llmProviderActivation.test.ts` — aktiver
  Mistral-Built-in ohne `provider.model` und ohne `MISTRAL_MODEL`; der gemockte Fetch wird mit
  `model: 'mistral-small-latest'` aufgerufen. (Bestehende Assertion Z. 103 wird angepasst.)
- Zu AK2: `node:test`-Unit ebenda — zwei Faelle: (1) `MISTRAL_MODEL=ministral-8b-latest` gesetzt
  → dieses Modell im Request; (2) `provider.model='mistral-large-latest'` persistiert → schlaegt
  ENV und Default. API-Seite via `server/src/express/routes/llmProviders.test.ts` (Persistenz der
  Wahl, vgl. Z. 179-184).
- Zu AK3: `node:test`-Unit in `server/src/llm/llm.test.ts` — gemockter Fetch antwortet 402 mit
  `{ detail: 'Check your subscription on https://admin.mistral.ai/subscription' }`; die geworfene
  `MistralRequestError`-Message matcht Modellkennung UND `HTTP 402` UND die Upstream-Ursache und
  enthaelt den API-Key nicht.
- Zu AK4: kein Testfall — Dokumentation ist kein Anwendungscode; Pruefung per Sichtkontrolle
  (`grep -rn "mistral-.*-latest"` ueber `openapi.yml`, `server/.env.example`, `docs/`).

### Ampel
- Ampel: 🟢
- Begründung: Die menschliche Rueckmeldung schliesst Konfiguration und Abo als Ursache aus und
  benennt den Status (402). Damit ist die Regression lokalisiert (Default-Modell in
  `llmProviders.ts:84` gegen die Dokumentation in `openapi.yml`), die betroffenen Dateien sind
  bekannt und die Akzeptanzkriterien sind pruefbar formuliert. Umfang: ein PR.

### ❓ Offene Fragen
- Keine.
<!-- KI-ANALYSE:END -->

<!-- ai-phase-routing:START -->
| Phase | Run | Modell | Effort |
| --- | --- | --- | --- |
| ux | nein | - | - |
| spec | ja | sonnet | medium |
| impl | ja | sonnet | medium |
| review | ja | sonnet | medium |
<!-- ai-phase-routing:END -->
