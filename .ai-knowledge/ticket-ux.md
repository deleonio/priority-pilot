# Workflow: Ticket-UX (Beratung nach Spec)

UX-Beratung als automatisierte Phase **nach** Spec-Ready – beratend, nicht blockierend.
Analysiert das Ticket aus UX-Sicht (Interaktion, Mobile-First, A11y/BITV, KoliBri) und schreibt
Empfehlungen in den Issue-Body zwischen `<!-- KI-UX:START -->` und `<!-- KI-UX:END -->`.

Diese Stufe ist **Phase 2b** der Kette: UX-Expertise fließt **vor** der Implementierung ein, aber
**ohne** Code zu schreiben oder Branches/PRs zu erstellen.

Tickets = GitHub-Issues von `deleonio/priority-pilot`. Voraussetzung: `gh` ist authentifiziert.

**Auswahlkriterium:** Bearbeitet werden Issues mit Label `ai:spec-ready` (von der Spec-Phase gesetzt),
für die **noch kein** UX-Input existiert (KI-UX-Block fehlt im Body). Manueller Start via
`workflow_dispatch` möglich.

Label-Kette: `ai:analyzed` → `ai:spec-ready` → **`ux:ready` (dieser Workflow)** → `ai:ready` (Umsetzung) → PR.

## Trigger

- **Automatisch:** Label `ai:spec-ready` wird gesetzt → GitHub Action `02b-claude-ux.yml` triggert
- **Manuell:** `workflow_dispatch` mit Issue-Nummer als Input

## Output

KI-UX-Block im Issue-Body zwischen den Markern:

```markdown
<!-- KI-UX:START -->

## UX-Beratung

### Interaktion

[User-Flow, Click-Targets, Feedback]

### Mobile-First

[Breakpoints, Touch-Ziele, responsive Layouts]

### A11y/BITV

[Tastatur-Navigation, Screenreader, ARIA, Kontrast]

### KoliBri

[Component-Wahl, Theme-Integration, BITV-2.1-PS]

### Offene UX-Fragen

[Unklare Punkte, Entscheidungsbedarf]

VERDICT: ux-ready
<!-- KI-UX:END -->
```

## Verifikation & Label-Setzung

- Workflow prüft Verdict-Line im Output
- Bei `VERDICT: ux-ready` → Label `ux:ready` setzen via GitHub App-Token
- Bei `VERDICT: ux-not-ready` → Label `ux:failed` setzen
- `ai:spec-ready` wird entfernt (von UX-Phase konsumiert)

## Charakteristik

- **Beratend, nicht blockierend:** UX-Empfehlungen sind Hinweise, keine harten Blocker
- **Kein Code-Ändern:** Prompt enthält explizit KEINE Anweisungen zu Branch/PR/Code
- **Keine Gewaltenteilung wie Spec/Implement:** UX ist eine Beratung, kein Vertrag

## Modell

- Standard: `vars.CLAUDE_MODEL_SPEC` (default: `sonnet`)
- Provider via `vars.LLM_PROVIDER` (zai|claude)
