# Workflow: Ticket-UX (Beratung vor Spec)

UX-Beratung als automatisierte Phase **vor** der Spec -- beratend, nicht blockierend.
Analysiert das Ticket aus UX-Sicht (Interaktion, Mobile-First, A11y/BITV, KoliBri) und schreibt
Empfehlungen in den Issue-Body zwischen `<!-- KI-UX:START -->` und `<!-- KI-UX:END -->`.
Verbindliche Quelle für Mobile-First/A11y-Empfehlungen: [docs/mobile-ui-rules.md](../docs/mobile-ui-rules.md).

Diese Stufe ist **Phase 2** der 7-Phasen-Kette: UX-Expertise fließt **vor** der Spec ein, aber
**ohne** Code zu schreiben oder Branches/PRs zu erstellen.

Tickets = GitHub-Issues von `deleonio/priority-pilot`. Voraussetzung: `gh` ist authentifiziert.

**Auswahlkriterium:** Bearbeitet werden Issues mit Label `ai:spec-ready` (von der Triage gesetzt,
nicht von der Spec-Phase), für die **noch kein** UX-Input existiert (KI-UX-Block fehlt im Body)
und ux:ready noch nicht gesetzt ist (Nicht-UI-Tickets haben ux:ready schon von der Triage).
Manueller Start via `workflow_dispatch` moeglich.

Label-Kette: `ai:analyzed` → `ai:spec-ready` → **`ux:ready` (dieser Workflow)** → `ai:ready` (Spec) → Umsetzung → PR.

## Trigger

- **Automatisch:** Label `ai:spec-ready` wird gesetzt → GitHub Action `02-claude-ux.yml` triggert.
  UX prueft im Pre-Check: ai:analyzed vorhanden, ux:ready abwesend. Bei Nicht-UI-Tickets ist
  ux:ready bereits von der Triage gesetzt → Pre-Check schlaegt fehl → No-op (Spec laeuft direkt).
- **Manuell:** `workflow_dispatch` mit Issue-Nummer als Input

## Output

KI-UX-Block im Issue-Body zwischen den Markern:

```markdown
<!-- KI-UX:START -->

## UX-Beratung

### Interaktion

[User-Flow, Click-Targets, Feedback]

### Mobile-First

[Breakpoints, Touch-Ziele, responsive Layouts — Maßstab: docs/mobile-ui-rules.md]

### A11y/BITV

[Tastatur-Navigation, Screenreader, ARIA, Kontrast — siehe docs/mobile-ui-rules.md]

### KoliBri

[Component-Wahl, Theme-Integration, BITV-2.1-PS]

### Offene UX-Fragen

[Unklare Punkte, Entscheidungsbedarf]

VERDICT: ux-ready
<!-- KI-UX:END -->
```

## Verifikation & Label-Setzung

- Workflow prueft Verdict-Line im Output
- Bei `VERDICT: ux-ready` → Label `ux:ready` setzen via GitHub App-Token
- Bei `VERDICT: ux-not-ready` → Label `ux:failed` setzen (fail-safe beim Menschen)
- `ai:spec-ready` **wird NICHT entfernt** -- es gehoert der Spec-Phase und bleibt am Issue kleben

## Charakteristik

- **Beratend, nicht blockierend:** UX-Empfehlungen sind Hinweise, keine harten Blocker
- **Kein Code-Aendern:** Prompt enthaelt explizit KEINE Anweisungen zu Branch/PR/Code
- **Keine Gewaltenteilung wie Spec/Implement:** UX ist eine Beratung, kein Vertrag
- **Optional:** Bei Nicht-UI-Tickets (Triage setzt ux:ready sofort) bleibt die UX-Phase No-op

## Werkzeuge

- **Impeccable Design-Skill** (`.claude/skills/impeccable/`, #828): Die UX-Beratung bei UI-Tickets
  mit `/impeccable critique <ziel-komponente>` stützen — Heuristik-Scores (Nielsen, 0-4),
  Cognitive-Load-Check und Persona-Red-Flags liefern belastbare Punkte für die Blöcke
  Interaktion/Mobile-First/A11y. Browser-Inspektion via Playwright-MCP (375px/1280px Viewport)
  und KoliBri-Component-Verifikation via KoliBri-MCP, wo verfügbar (#823). Die
  Referenz-Dateien des Skills lädt der Agent on demand — keine Token-Kosten ohne Nutzung.

## Modell

- Standard: `vars.CLAUDE_MODEL_SPEC` (default: `sonnet`)
- Provider via `vars.LLM_PROVIDER` (zai|claude)
