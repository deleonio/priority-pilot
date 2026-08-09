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
