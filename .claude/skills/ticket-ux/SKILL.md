---
name: ticket-ux
description: "Ticket-UX — beratende UX-Prüfung für UI-Tickets (Interaktion, Mobile-First, A11y/BITV, KoliBri) vor der Spec; schreibt den KI-UX-Block in den Issue-Body. Nutzen bei ‚ux-beratung‘, CI-Phase 2."
---

# Workflow: Ticket-UX (Beratung vor Spec)

Nutzen bei UI-Tickets nach der Triage — analysiert aus UX-Sicht (Interaktion, Mobile-First, A11y/BITV, KoliBri) und schreibt Empfehlungen in den Issue-Body zwischen `<!-- KI-UX:START -->` und `<!-- KI-UX:END -->`.

Verbindliche Quellen: [docs/mobile-ui-rules.md](../../../docs/mobile-ui-rules.md) für Mobile-First/A11y und [ux-design.md](../../../.ai-knowledge/ux-design.md) für die Design-Sprache „Cockpit" — Farbrollen, Skalen-Tokens, Komponentenwahl.

**Auswahlkriterium:** Issues mit Label `ai:needs-ux-ui` (von der Analyse-Phase gesetzt), für die **noch kein** UX-Input existiert (KI-UX-Block fehlt im Body). Nicht-UI-Tickets bekommen das Label nie.

## Trigger

- **Automatisch:** Label `ai:needs-ux-ui` wird gesetzt → GitHub Action `02-claude-ux.yml` triggert.
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

### Design-Sprache

[Geltende Rollen-Tokens und Skalen-Stufen — Maßstab: .ai-knowledge/ux-design.md]

### Offene UX-Fragen

[Unklare Punkte, Entscheidungsbedarf]

<!-- KI-UX:END -->
```

Die `VERDICT:`-Zeile gehört **nicht** in den Block: Der Workflow parst sie aus dem Agenten-Output (`/tmp/claude-output.log`).

## Verifikation & Label-Setzung

- Workflow prueft Verdict-Line im Output
- Bei `VERDICT: ux-ready` → Label `ai:needs-spec` setzen (`ai:needs-ux-ui` wird konsumiert = entfernt)
- Bei `VERDICT: ux-not-ready` → Label `ai:needs-human` setzen (fail-safe) plus Kommentar mit **Warum** und **konkreten Optionen** (Fragen klären + `ai:needs-ux-ui` neu setzen, oder bei unerheblichem Blocker `ai:needs-spec` manuell setzen)

## Charakteristik

- **Beratend, nicht blockierend:** UX-Empfehlungen sind Hinweise, keine harten Blocker
- **Kein Code-Ändern:** Prompt enthaelt explizit KEINE Anweisungen zu Branch/PR/Code
- **Keine Gewaltenteilung wie Spec/Implement:** UX ist eine Beratung, kein Vertrag
- **Optional:** Bei Nicht-UI-Tickets (Analyse setzt `ai:needs-spec` direkt) laeuft die UX-Phase nie

## Werkzeuge

- **Impeccable Design-Skill** (`.claude/skills/impeccable/`, #828): UX-Beratung mit `/impeccable critique <ziel-komponente>` stützen — Heuristik-Scores (Nielsen, 0-4), Cognitive-Load-Check und Persona-Red-Flags liefern belastbare Punkte.
- **KoliBri-MCP** (`mcp__kolibri-mcp__search/fetch`): Component-Dokumentation lesen, um Component-Wahl zu prüfen.
- **Browser-Inspektion (375px/1280px Viewport) via Playwright-MCP nur LOKAL/per Command** (#823). **In CI läuft diese Phase rein statisch:** `02-claude-ux.yml` startet keine App — dort gilt allein die Regel-Prüfung gegen Design-System. Dynamische Inspektion ist Sache der Umsetzungsphase.

## Modell

- Standard: `vars.CLAUDE_MODEL_SPEC` (default: `sonnet`)
- Provider via `vars.LLM_PROVIDER` (zai|claude)