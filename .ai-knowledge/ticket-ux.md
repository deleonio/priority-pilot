# Workflow: Ticket-UX (Review zwischen Spec und Umsetzung)

UX/UI-Review als automatisierte **Phase 2b** — nach der Spec (roter Vertrag steht), vor der
Umsetzung (nichts ist gebaut). Genau hier kostet eine UX-Anforderung am wenigsten.

Maßstab ist die Design-Sprache [`ux-design.md`](ux-design.md); Mobile-First-Regeln stehen in
[`conventions.md`](conventions.md).

Tickets = GitHub-Issues von `deleonio/priority-pilot`. Voraussetzung: `gh` ist authentifiziert.

**Auswahlkriterium:** Issues mit Label `ux:ready` (von der Spec-Phase gesetzt) und `ai:analyzed`,
solange `ai:ready` noch **nicht** gesetzt ist. Manueller Start via `workflow_dispatch` möglich.

Label-Kette: `ai:analyzed` → `ai:spec-ready` → (Spec) → **`ux:ready` (dieser Workflow)** →
`ai:ready` (Umsetzung) → PR.

## Trigger

- **Automatisch:** Label `ux:ready` wird gesetzt → GitHub Action `02b-claude-ux.yml` triggert
- **Manuell:** `workflow_dispatch` mit Issue-Nummer als Input

## Output

Zwei Artefakte — Text **und** Code:

1. **KI-UX-Block** im Issue-Body zwischen `<!-- KI-UX:START -->` und `<!-- KI-UX:END -->`, mit
   **prüfbaren** Anforderungen (Abschnitte: Interaktion, Mobile-First, A11y/BITV, KoliBri,
   Design-Sprache, Offene UX-Fragen).
2. **Erweiterter Vertrag im Spec-Branch:** rote e2e-Tests je dauerhafter UX-Anforderung
   (Mobile-Fälle bei 375×812 mit `element.scrollWidth <= window.innerWidth`) plus Fixes gegen die
   Design-Sprache an der vom Ticket berührten UI. Kein neuer Branch, kein neuer PR — es wird in den
   vorhandenen Spec-PR committet.

## Charakteristik

- **Wirksam, nicht nur beratend:** Was dauerhaft gelten soll, wird als Test festgenagelt — eine
  Empfehlung im Issue-Body allein setzt sich nicht durch.
- **Gewaltenteilung bleibt:** Die Tests der Spec-Phase werden **ergänzt**, nicht umgeschrieben.
- **Eng am Ticket:** Fixes nur an der vom Ticket berührten UI. Alles andere wird im KI-UX-Block als
  „außerhalb des Tickets" vermerkt und liegen gelassen (Backlog: `docs/ux-audit-2026-08.md`).
- **Kein Browser in CI:** Der Playwright-MCP bleibt der lokalen Arbeit vorbehalten
  ([docs/browser-mcp.md](../docs/browser-mcp.md)) — zum 2b-Zeitpunkt gibt es die Umsetzung noch nicht
  zu sehen. KoliBri-MCP ist in dieser Phase aktiv (`needs-mcp: true`).

## Verifikation & Label-Setzung

- Workflow prüft die Verdict-Zeile im Output
- Bei `VERDICT: ux-ready` → Label `ai:ready` setzen (gibt die Umsetzung frei); `ux:ready` bleibt
  stehen, weil das Laufzeit-Gate der Umsetzung beide Labels verlangt
- Bei `VERDICT: ux-not-ready` → Label `ux:failed`, `ai:ready` wird **nicht** gesetzt → Umsetzung bleibt blockiert

## Modell

- Standard: `vars.CLAUDE_MODEL_SPEC` (default: `sonnet`)
- Provider via `vars.LLM_PROVIDER` (zai|claude)
