# Spec 873: Pipeline-Labels Optimierung

## Ziel

Eliminierung toter Label-Marker in GitHub Actions-Workflows, um No-Op-Runs zu vermeiden.

## Vorbedingung

- Repo auf Stand 2b02eb1
- 4 Label-Marker ohne Trigger/Guard-Logik existieren: ai:ux-reviewed, ai:specified, ai:implemented, ai:fixed
- Jedes Label-Add feuert 4 (Issue) bzw. 3 (PR) Workflow-Runs

## Schritte

### AK1: Setz-Konvention dokumentieren

- docs/pipeline-flow.md: Neuer Abschnitt mit Label-Writes nur im Post-Assertion, Removes zuerst, Done-Labels idempotent
- .github/scripts/check-phase-label.sh: Kopf-Kommentar mit Setz-Konvention

### AK2: Marker aus Workflows entfernen

- 02-claude-ux.yml: ai:ux-reviewed (create + add) entfernen
- 03-claude-spec.yml: ai:specified (create + add) entfernen, auch in ticket-spec.md
- 04-claude-implement.yml: ai:implemented (removes + force-add) entfernen
- 06-claude-pr-fixup.yml: ai:fixed (create + alle 3 Verdict-Zweige) entfernen

### AK3: 05 findings-Zweig anpassen

- Kein ai:reviewed mehr, nur ai:needs-fixup (letzter Write)
- needs-human unverändert (ai:reviewed + ai:needs-human)
- Header-Kommentar (Zeile 11) und clear_verdict-Kommentar (~257) anpassen

### AK4: 01 idempotent machen

- ai:analysed nur setzen, wenn noch nicht vorhanden (~Zeile 306-307)
- Sub-Issue-Pre-Labeling unverändert

### AK5: check-phase-label.sh anpassen

- Soll-Tabelle auf 12 Labels kürzen (6 × ai:needs-*, ai:analysed, ai:reviewed, ai:documented, ai:needs-human, ai:to-big-issue, ai:continued)
- Kommentar „reine Marker ohne Trigger“ entfernen

### AK6: Doku bereinigen

- AGENTS.md: Label-Kette + Tabellen aktualisieren
- docs/pipeline-flow.md: Label-Referenz aktualisieren
- docs/adr/0003-label-schema-ai-needs-und-past.md: Entscheidung + Begründung ergänzen
- .ai-knowledge/tdd-strategy.md: L14, L84
- ticket-spec.md: L20, L92-97
- ticket-ux.md: L18-19, L64
- ticket-implementation.md: L12
- ticket-triage.md: L276
- .ai-knowledge Dateien: Phasen-Wissensbasis konsistent neu formulieren

### AK7: Remote-Labels löschen

- gh label delete ai:ux-reviewed --yes
- gh label delete ai:specified --yes
- gh label delete ai:implemented --yes
- gh label delete ai:fixed --yes

### AK8: Verifikation

- grep -rn "ai:ux-reviewed|ai:specified|ai:implemented|ai:fixed" .github docs AGENTS.md .ai-knowledge → keine Treffer
- pnpm format grün
- pnpm lint grün

## Erwartetes Ergebnis

- Keine No-Op-Runs bei Label-Adds mit aktivem ai:needs-*-Trigger
- 4 tote Marker entfernt, 3 tragende Labels bleiben (ai:analysed, ai:reviewed, ai:documented)
- Neue Label-Kette: ai:needs-analyse → ai:analysed → ai:needs-ux-ui/ai:needs-spec → ai:needs-spec → ai:needs-impl → PR ai:needs-review → (🟢) ai:reviewed [Gate] | (🔴) ai:needs-fixup → ai:needs-review → … → Merge → ai:documented

## Test-Strategie

Laut ADR #567 und AK8: Keine neuen Tests für Workflow-Änderungen. Verifikation erfolgt durch grep-Check + pnpm format/lint.
