# Eingebettete Provider-Fehler bei HTTP 200 sichtbar machen – Issue 2774

**Stand:** 2026-10-20
**Ziel:** Ein Provider, der mit HTTP 200 antwortet, aber im Body einen Fehler meldet (OpenRouter-Form: `{error:{message}}`, `{detail}` oder `{message}` — z. B. „Insufficient credits", Rate-Limit, Moderation), liefert dem Nutzer die konkrete Ursache statt der generischen Meldung „Antwort des Modells enthielt keinen Text."

Diese Spezifikation beschreibt das Verhalten von `callProvider` (`server/src/llm/llm.ts`) für eingebettete Fehler und die Unveränderlichkeit der normalen Pfade. Vorbild ist `runProviderTest` (`server/src/express/routes/llmProviders.ts`, PR #2683), das dasselbe Problem für den Provider-Test bereits löst (Meldungsform „… meldete: <Detail>").

---

## Journey: LLM-Aufruf mit eingebettetem Provider-Fehler

### Ziel

Der Nutzer sieht bei einer 200-Antwort mit eingebettetem Provider-Fehler die konkrete Ursache (MistralRequestError, 502-Pfad), nicht eine wertlose Format-Fehlermeldung.

### Vorbedingung

- Aktiver LLM-Provider konfiguriert (`setTestLlmProvider` im Test)
- Provider antwortet mit HTTP 200 und einem JSON-Body OHNE `choices`, aber mit einem der bekannten Ursachen-Felder (`error.message`, `detail`, `message`)

### Schritte / Erwartetes Ergebnis

1. **Eingebetteter Fehler wird durchgereicht (AK1, TF1)**
   - `callProvider` prüft nach `response.json()` das Body-Detail (`upstreamBodyDetail(payload)`)
   - Bei nicht-leerem Detail: `MistralRequestError` mit der konkreten Ursache in der Meldung (Form analog zum Vorbild: `${label} (${model}) meldete: ${detail}`)
   - Die Meldung enthält NICHT „enthielt keinen Text"
   - Detail-Kürzung bleibt bei `upstreamBodyDetail` (200 Zeichen)
2. **Normale Antworten bleiben unverändert (AK2, TF2)**
   - JSON-Pfad: 200 mit `choices[0].message.content` als JSON-String → geparst wie bisher
   - Freitext-Pfad (`json = false`, #2350, z. B. `draftTaskWithMistral`): 200 mit `choices[0].message.content` als Klartext → getrimmter Freitext wie bisher
   - Valide Bodies (mit `choices`) haben kein `detail`/`error.message`/`message`-Feld → keine zusätzlichen Fehler
3. **Provider-Test unverändert (AK3, TF3)**
   - `runProviderTest` in `llmProviders.ts` bleibt code-unangetastet; die Bestands-Suiten (`llm.test.ts`, `llmProviders.test.ts`) bleiben grün — abgedeckt durch die vorhandenen Tests, kein neuer Test nötig

### Offene Fragen

- (keine)
