# Review PR #1026 (Issue #1025, Prompt-Audit-Umsetzung) — Kreuzverhör Runde 1

## Erledigt
- Modus bestimmt: KREUZVERHÖR (kein `<!-- ai-review -->`-Kommentar vorhanden, geprüft via Issues-API).
- Vollständiger Diff gelesen (/tmp/pr1026.diff); Issue #1025 (Prompt-Audit) gelesen — kein KI-ANALYSE-Block (Alt-Ticket), AKs = Audit-Findings.
- Kreuzverhör abgeschlossen, VERDICT: needs-fixup gepostet (1 Finding F1).

## Relevante Stellen
- .github/prompts/implement.md:36 — F1: `pnpm test:e2e` existiert nicht als Root-Script (nur frontend/package.json:14); CI nutzt `pnpm --filter frontend exec playwright test` (ci.yml:150).
- .ai-knowledge/ticket-triage.md Schritt 4 — Delegationsziel des Triage-Heredocs; enthält vollständig Struktur/Feldsemantik/stand/Erst-vs-Re-Triage. ✓
- .ai-knowledge/ticket-spec.md Schritt 2 — Delegationsziel spec.md; enthält Testebnen/Carve-out/Dedup/Mutations-Probe. ✓
- .github/workflows/01-claude-triage.yml:246–253 — neue 5-Feld-Literal-Struktur; Post-Parser grept `UI-Bezug:`/`Aufwandsklasse:`/`Akzeptanzkriterien|AK n` → erfüllt. ✓
- .github/workflows/03-claude-spec.yml:267–268 — Parser nimmt spec-partial|spec-ready|ready, mappt Alt-Token. `final` nur intern (ready→ai:needs-impl, sonst ai:needs-spec). ✓
- .github/scripts/ensure-labels.sh — beide Aufrufer (01:153 pre, 01:~462 post) haben GH_TOKEN. ✓
- .github/actions/claude-workbench/action.yml:30,46 — install + chromium → `pnpm test`-Gate in CI ausführbar, PR-Body-Behauptung stimmt. ✓

## Annahmen
- docs/ci-architecture.md:315 (`VERDICT: spec-ready`-Beispiel) beschreibt die TRIAGE-Assertion, wo spec-ready weiterhin der korrekte Token ist → kein Stale-Doc-Finding.
- pi-migration-plan.md:232 ist Zukunftsentwurf, Token-Beispiel nicht normativ.

## Verworfen
- F2-Kandidat ci-architecture.md — siehe Annahmen: kein Finding (wäre Pseudo-Finding).
- „Zeile 5"-Hardcode in spec.md Schritt 2 als Finding — akkurat heute (Zeile 5 = {{RESUME_HINT}}), bewusster Dedup-Kompromiss; nur Nebenbemerkung im Sammelkommentar.

## Offen
- F1 wartet auf Fixup: implement.md:36 `pnpm test:e2e` → `pnpm --filter frontend test:e2e`.

## Nächster Schritt
- (Erledigt: Review + Sammelkommentar neu angelegt + Verdict needs-fixup in /tmp/claude-verdict.) Fixup-Runde: nur F1 verifizieren.

## Fallstricke
- Issue #1025 hat KEINEN KI-ANALYSE-Block — AKs sind die Audit-Befunde selbst; nicht nach Marker suchen.
- HEAD der Sandbox = pull/1026/merge (Post-State direkt lesbar, kein zusätzlicher Checkout nötig).
- 01-Triage und 03-Spec nutzen BEIDE einen Token `spec-ready` mit unterschiedlicher Bedeutung — nur der Spec-Token wurde umbenannt; 01:263 bleibt absichtlich.
