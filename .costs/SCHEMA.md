# Schema: `.costs/<issueId>.json`

Pro Ticket (`issueId`) wird hier eine Datei mit den Token- und Kostendaten der
Workflow-Runs fortlaufend ergänzt (Append, kein Überschreiben). Das Format ist
maschinenlesbares JSON — ein Array von Einträgen, chronologisch nach `timestamp`
sortierbar. Siehe `.github/scripts/cost-record.ts`.

## Wo die Daten tatsächlich liegen

**Zwischenpuffer (90 Tage):** Jeder Phasen-Lauf lädt seinen Datensatz als Artefakt
`claude-costs-<phase>-issue-<n>-<run_id>` hoch — die Phasen selbst committen NICHT nach
`.costs/` (sieben Phasen × parallele Tickets auf denselben Ordner erzeugen Konflikte auf
main).

**Dauerhaft eingecheckt — der Siegel-Lauf:** Der Documenter (Phase 6) merged nach dem
Merge des PRs alle Artefakte eines Tickets in **eine** Datei `.costs/<n>.json` und
committet sie auf main (`chore(costs): Ticket #<n> versiegelt [skip ci]`, siehe
`.github/scripts/cost-seal.ts` und den Schritt „Kostenlauf versiegeln" in
`06-claude-pr-documenter.yml`). Er ist der einzige Schreiber je Datei — damit ist das
Konflikt-Argument gegen `.costs/`-Commits für den terminalen Seal entkräftet, und die
Repo-Datei ist die dauerhafte Instanz. Idempotent über das Dedupe: Re-Runs zählen nicht
doppelt; ein fehlgeschlagener Seal lässt sich per Documenter-`workflow_dispatch`
nachholen, solange die Artefakte leben.

Um die Zahlen eines Tickets als **eine** Tabelle zu sehen, den Workflow
[`Kosten-Baseline`](../.github/workflows/cost-baseline.yml) manuell mit der Ticket-Nummer
starten. Er sammelt alle Artefakte des Tickets ein und schreibt den Bericht in die
Job-Summary. Lokal gegen ein Verzeichnis mit entpackten Artefakten:

```
node .github/scripts/cost-aggregate.ts --issue 912 --dir /tmp/costs
```

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
| `turns`               | int    | Deduplizierte Assistant-Antworten (= API-Calls) des Laufes, inkl. Subagenten           |
| `valueCost`           | float  | Verbrauchsbewertung zu Modellklassen-Preisen (USD), siehe unten                        |

**`tokensIn` enthält die Cache-Token.** Es ist die Summe aus ungecachten Eingabe-Token,
`cacheCreationTokens` und `cacheReadTokens` — also der gesamte eingabeseitige Verbrauch.
Wer die Kosten nachrechnen will, braucht deshalb die Aufteilung: die drei Anteile werden
mit unterschiedlichen Faktoren berechnet.

**`cost` ist 0 nur noch bei `openrouter`.** Für dessen Modelle gibt es keine Preisliste im
Repo; ein mit Anthropic-Listenpreisen gerechneter Wert wäre schlicht falsch. Das Feld
`model` zeigt dann, worauf sich der Verbrauch bezieht.

**`zai` ist bepreist** (Listenpreise des GLM Coding Plan, `PRICES_EUR_PER_MTOK_ZAI` in
`cost-from-transcript.ts`):

| Modell-Präfix  | EUR je Mio. Token (in/out) |
| -------------- | -------------------------- |
| `glm-5.3*`     | 3,00 / 10,00               |
| `glm-5-turbo*` | 1,20 / 4,00                |
| `glm-4.7*`     | 0,60 / 1,20                |

Die Preise stehen bewusst in **EUR** (so sind sie gegen die z.ai-Preisliste prüfbar) und
werden an genau einer Stelle über die Konstante `EUR_TO_USD` in USD umgerechnet — alle
Felder und der gesamte Report rechnen in USD, weil in einer Report-Summe claude-, zai- und
openrouter-Läufe nebeneinanderstehen und eine gemischte Währungssumme still falsch wäre.
Der Kurs ist **fest**, nicht tagesaktuell: Baseline und Nachher-Messung müssen mit
demselben Kurs gerechnet werden, sonst vergleicht der Trend Wechselkurse statt
Pipeline-Änderungen. Wer den Kurs ändert, rechnet die Altdaten mit
`node --import tsx .github/scripts/cost-backfill-zai.ts --write` neu.

**Nachträglich bepreist:** Die 236 z.ai-Läufe, die vor der Preisaufnahme mit `cost: 0`
versiegelt wurden, sind einmalig mit demselben Skript nachgerechnet worden — die
Token-Felder machen das deterministisch reproduzierbar, und ohne den Backfill wären 236
von 371 Datensätzen in der Kosten-Übersicht leer geblieben. Das Skript rechnet immer aus
den Token-Feldern, nie aus dem Vorwert, und ist damit idempotent.

**`valueCost` bewertet den Verbrauch, nicht die Rechnung** (Issue #984). Jeder Lauf wird
unabhängig vom Provider — auch `:free`-Modelle — bewertet. Liegt ein echter Listenpreis
vor (Anthropic, z.ai), gilt dieser; sonst die Modellklasse, orientiert an den
Anthropic-Referenzstufen:

| Klasse   | USD je Mio. Token (in/out) | Modell-Präfixe (Auswahl, längster Präfix gewinnt)                             |
| -------- | -------------------------- | ----------------------------------------------------------------------------- |
| flagship | $5 / $25                   | `claude-opus*`, `glm-5.3*`, `nemotron-3-ultra*`, `kimi-k2.6*`                 |
| mid      | $3 / $15                   | `claude-sonnet*`, `glm-5-turbo*`, `deepseek-v3.2*`, `kimi-k2.5*`, `laguna-s*` |
| small    | $1 / $5                    | `claude-haiku*`, `glm-4.7*`, `nemotron-3-nano*`                               |

Unbekannte Modelle zählen als `mid` (mit Warnung im Job-Log). Vollständige Zuordnung:
`MODEL_CLASSES` in `cost-from-transcript.ts`. Zweck ist die vergleichbare Effizienz-Messung
über alle Provider — `cost` bleibt die echte Abrechnungsbasis, `valueCost` ist der
Bewertungsmaßstab.

**GLM-Läufe werden zum z.ai-Listenpreis bewertet, nicht zur Klassenstufe.** Die Stufe war
für sie zu grob: `glm-5.3` zählt als `flagship` ($5/$25), kostet real aber 3/10 EUR — der
GLM-Output war damit um mehr als das Doppelte überbewertet. Für Anthropic-Modelle ändert
der Vorrang nichts, weil deren Listenpreise mit den Klassenpreisen identisch sind, aus
denen die Stufen abgeleitet wurden; openrouter bleibt beim Klassenmaßstab.

Für Altdatensätze wurde `valueCost` ursprünglich bewusst nicht nachgerechnet. Mit der
z.ai-Bepreisung ist das für `zai`-Läufe einmalig nachgeholt worden (s. o.), weil `cost` und
`valueCost` dort sonst zwei verschiedene Preisstände gemischt hätten. Wer andere
historische Läufe bewerten will, macht das weiterhin ad hoc lokal gegen die entpackten
Artefakte.

**`turns` zählt API-Calls, nicht Zeilen.** Eine Assistant-Antwort erscheint im Transkript
als mehrere JSONL-Zeilen mit identischer Nutzung; gezählt werden deduplizierte Antworten
(inkl. Subagenten). Die Zahl ist die Granularität zwischen Läufen und Token: wie viele
Prompts brauchte ein Lauf wirklich. Weil die Abos praktisch nach Prompts/Turns abrechnen,
hat sie einen eigenen repo-weiten Bericht — Workflow
[`Turn-Übersicht`](../.github/workflows/report-turns.yml) (manuell) oder lokal:

```
node .github/scripts/turns-report.ts --dir .costs
```

Läufe von vor der Turns-Erfassung (Issue #984) haben das Feld nicht; sie erscheinen dort
als „—" und zählen in keinem Durchschnitt mit.

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
