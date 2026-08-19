# Schema: `.costs/<issueId>.json`

Pro Ticket (`issueId`) wird hier eine Datei mit den Token- und Kostendaten der
Workflow-Runs fortlaufend ergänzt (Append, kein Überschreiben). Das Format ist
maschinenlesbares JSON — ein Array von Einträgen, chronologisch nach `timestamp`
sortierbar. Siehe `.github/scripts/cost-record.ts`.

## Pflichtfelder (pro Eintrag)

| Feld        | Typ               | Bedeutung                                                       |
| ----------- | ----------------- | --------------------------------------------------------------- |
| `issueId`   | string            | GitHub-Issue-ID, unter der der Datensatz abgelegt ist           |
| `timestamp` | string (ISO-8601) | Zeitpunkt des Workflow-Runs (UTC), z. B. `2026-08-09T10:00:00Z` |
| `tokensIn`  | int               | Eingabe-Token des Runs                                          |
| `tokensOut` | int               | Ausgabe-Token des Runs                                          |
| `cost`      | float             | Kosten des Runs (USD)                                           |

## Optionale Zusatzfelder (seit der Transkript-Erfassung)

Geschrieben von `.github/scripts/cost-from-transcript.ts` über die Action
`.github/actions/record-cost`. Ältere Datensätze haben sie nicht — Leser müssen sie
als optional behandeln.

| Feld                  | Typ    | Bedeutung                                                                              |
| --------------------- | ------ | -------------------------------------------------------------------------------------- |
| `phase`               | string | Pipeline-Phase (`analyse`, `ux`, `spec`, `implement`, `review`, `fixup`, `documenter`) |
| `model`               | string | Modell mit dem größten Output-Anteil im Lauf                                           |
| `provider`            | string | Aufgelöster LLM-Provider (`claude`, `zai`, `openrouter`)                               |
| `cacheCreationTokens` | int    | Anteil an `tokensIn`, der in den Prompt-Cache geschrieben wurde (~1,25x Preis)         |
| `cacheReadTokens`     | int    | Anteil an `tokensIn`, der aus dem Cache gelesen wurde (~0,1x Preis)                    |
| `sidechainTokens`     | int    | Anteil des Verbrauchs, der auf Subagenten entfiel (nur wenn > 0)                       |

**`tokensIn` enthält die Cache-Token.** Es ist die Summe aus ungecachten Eingabe-Token,
`cacheCreationTokens` und `cacheReadTokens` — also der gesamte eingabeseitige Verbrauch.
Wer die Kosten nachrechnen will, braucht deshalb die Aufteilung: die drei Anteile werden
mit unterschiedlichen Faktoren berechnet.

**`cost` ist 0 bei Nicht-Anthropic-Providern.** Für GLM-Modelle über `zai`/`openrouter`
gelten Fremdtarife; ein mit Anthropic-Listenpreisen gerechneter Wert wäre schlicht falsch.
Das Feld `model` zeigt dann, worauf sich der Verbrauch bezieht.

## Beispiel

```json
[
	{
		"timestamp": "2026-08-09T10:00:00Z",
		"tokensIn": 12000,
		"tokensOut": 3400,
		"cost": 0.18,
		"issueId": "515"
	}
]
```

Vor jedem Commit wird der Inhalt per `scanForSecrets` geprüft — Tokens/Keys dürfen
nicht ins Repo gelangen.
