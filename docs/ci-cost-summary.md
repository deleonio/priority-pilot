# CI-Kosten-Zusammenfassung (GitHub Actions)

Jeder `anthropics/claude-code-action`-Schritt der KI-Pipeline (Triage, Spec, Umsetzung, Review,
Fixup) schreibt am Ende eine grobe Token-/Kosten-Schätzung in die Job-Summary des jeweiligen
GitHub-Actions-Laufs.

## Wie es funktioniert

Direkt nach dem `claude`-Schritt in jedem der fünf Workflows
(`claude-triage.yml`, `claude-spec.yml`, `claude-implement.yml`, `claude-pr-review.yml`,
`claude-pr-fixup.yml`) läuft die Composite-Action
[`.github/actions/cost-summary`](../.github/actions/cost-summary/action.yml):

```yaml
- name: Kosten-Zusammenfassung
  if: always()
  continue-on-error: true
  uses: ./.github/actions/cost-summary
  with:
    execution-file: ${{ steps.claude.outputs.execution_file }}
    label: Triage
```

Die Action liest die `execution_file`, die `claude-code-action` als Output bereitstellt (JSON-Array
oder JSONL von Agent-SDK-Messages), extrahiert den letzten `type: "result"`-Eintrag und daraus
`total_cost_usd` sowie `usage` (Input-/Output-/Cache-Tokens). Ergebnis landet als Tabelle in
`$GITHUB_STEP_SUMMARY` (sichtbar auf der Zusammenfassungsseite des jeweiligen Actions-Laufs) und
zusätzlich als `::notice::` im Log.

## Wo einsehen

GitHub → Actions → betroffener Lauf → **Summary**-Tab, Abschnitt „Kosten-Schätzung — \<Phase\>".

## Einschränkungen

- `total_cost_usd` ist eine **Client-seitige Schätzung** von `claude-code-action` selbst, keine
  autoritative Abrechnung. Für echte Kosten: Claude Console bzw. Usage-Cost-API.
- Die EUR-Umrechnung nutzt einen **hart hinterlegten Kurs** (`EUR_PER_USD` in
  `.github/actions/cost-summary/action.yml`) — bei Bedarf manuell aktualisieren.
- **Fail-open:** Fehlt die `execution_file` (z. B. weil der Claude-Schritt durch einen Guard
  übersprungen wurde) oder lässt sie sich nicht parsen, wird der Schritt übersprungen (`::notice::`)
  statt den Job scheitern zu lassen — `if: always()` + `continue-on-error: true`, analog zu den
  bestehenden Session-Archiv-Schritten.
- Es gibt (noch) keine Aggregation über mehrere Läufe hinweg (z. B. Gesamtkosten pro Woche) — jede
  Job-Summary zeigt nur den eigenen Lauf.
