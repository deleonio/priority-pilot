# Claude Code Workflow-Tool: Kosten-Reporting

Snippet für das Ende eines Claude-Code-`Workflow`-Skripts (agent()/pipeline()-Orchestrierung), um
den Token-Verbrauch und eine grobe USD/EUR-Kostenschätzung auszugeben.

## Einschränkungen

- Claude Code selbst zeigt Session-Kosten nur über `/usage` an — **nur USD**, keine EUR-Unterstützung,
  nicht pro Workflow-Lauf aufgeschlüsselt.
- `budget.spent()` (innerhalb eines Workflow-Skripts verfügbar) liefert nur die **Output-Token**-Zahl
  über Hauptloop + alle Agents hinweg — keine Input-/Cache-Token, keine Dollarangabe.
- Es gibt keine eingebaute Umrechnung in USD/EUR — Preis und Wechselkurs müssen manuell gepflegt
  werden.

## Snippet

```js
// Ans Ende des Workflow-Skripts anhängen, nach allen agent()-Aufrufen
const EUR_PER_USD = 0.92; // Kurs bei Bedarf aktualisieren
const USD_PER_1M_OUTPUT_TOKENS = 10.0; // Sonnet 5 Intro-Preis bis 2026-08-31 (danach $15.00) — Modell/Datum prüfen

const outputTokens = budget.spent();
const usd = (outputTokens / 1_000_000) * USD_PER_1M_OUTPUT_TOKENS;
const eur = usd * EUR_PER_USD;

log(`Tokens (output, main+workflows): ${outputTokens.toLocaleString()}`);
log(`Geschätzte Kosten: $${usd.toFixed(4)} / ~€${eur.toFixed(4)} (nur Output-Tokens, grobe Schätzung)`);
```

Nur auf ausdrücklichen Wunsch einbauen — kein Standardverhalten für Workflow-Skripte, da die
Schätzung wegen der fehlenden Input-/Cache-Token-Erfassung ungenau ist. Preis-Konstante bei Bedarf
gegen die aktuelle Preistabelle (`claude-api`-Skill) prüfen.
