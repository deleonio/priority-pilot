# Mistral-Default-Modell und Fehlerdiagnose

**Stand:** 2026-08-30

## Modellauflösung des Built-ins Mistral

- **Default:** Ohne Modellwahl in der App (`provider.model` leer) und ohne Umgebungsvariable löst sich der Built-in Mistral auf `mistral-small-latest` auf. Beim Built-in OpenRouter gilt entsprechend `openrouter/free`. Beide Defaults sind kostenfreie Modelle.
- **Vorrang:** Die in der App getroffene Modellwahl (`provider.model`, persistiert) schlägt die Umgebungsvariable (`MISTRAL_MODEL` bzw. das OpenRouter-Pendant), diese schlägt den Code-Default.
- Ein Key, dessen Plan das gewählte Modell nicht abdeckt, antwortet auf den Chat-Completions-Aufruf mit HTTP 402 „Check your subscription" — die Fehlermeldung macht das Modell sichtbar, sodass Abo- und Modellproblem unterscheidbar sind.

## Fehlermeldung nennt das verwendete Modell

Antwortet der Provider mit einem Fehlerstatus, nennt die Fehlermeldung neben Provider-Label und Status auch das **verwendete Modell**, z. B.
`Mistral (mistral-medium-latest) antwortete mit HTTP 402: Check your subscription …`.
Die Upstream-Ursache (Klartext aus dem Antwort-Body) bleibt erhalten; der API-Key taucht nie auf.
