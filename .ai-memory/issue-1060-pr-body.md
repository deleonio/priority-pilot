## Rote Spec-Tests für #1060 (Mistral-Default-Modell & 402-Fehlerdiagnose)

Spezifikation: `docs/spec/issue-1060.md`. Implementation folgt (Phase 4) — dieser PR enthält nur Spec + rote Tests.

### Abgedeckte Akzeptanzkriterien

- **AK1** — Code-Default des Built-ins Mistral ist `mistral-small-latest` (statt `mistral-medium-latest`): angepasste Assertion in `llmProviderActivation.test.ts` + Default-Spiegel in `routes/llmProviders.test.ts`. **Rot.**
- **AK2** — Vorrang Wahl > ENV > Default bleibt: zwei neue Unit-Tests (`MISTRAL_MODEL` schlägt Default; persistierte App-Wahl schlägt ENV und Default). Grün heute — bewusste Regression-Wächter, damit die Rangfolge beim AK1-Fix nicht kaputtgeht. Persistenz über die API ist bereits durch den bestehenden Route-Test gedeckt (kein Duplikat).
- **AK3** — 402-Fehlermeldung nennt Label, **verwendetes Modell**, Status und Upstream-Ursache, nie den API-Key: neuer Unit-Test mit 402-Mock (`Check your subscription …`). **Rot.**
- **AK4** — Doku-Konsistenz (`openapi.yml`, `.env.example`, `docs/*`): kein Test — Markdown/YAML/String-Match wäre ein zahnloser Change-Detector (ADR 0001); Prüfung im Review der Implementation.

### Test-Pflege-Bedarf

- `llmProviderActivation.test.ts:103` und `routes/llmProviders.test.ts:179` spiegelten den alten Default `mistral-medium-latest` — an den neuen Default angepasst (AK1 widerspricht den alten Assertionen). Im Route-Test wurde zusätzlich das gewählte Modell der Persistenz-Assertion auf `mistral-large-latest` geändert, damit Wahl und Default unterscheidbar bleiben.

Closes #1060
