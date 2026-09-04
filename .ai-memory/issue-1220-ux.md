# Issue 1220 — UX-Phase (advisory), Stand 2026-09-04

**ERGEBNIS: VERDICT ux-ready.** KI-UX-Block in den Harness-Marker-Kommentar (ID `IC_kwDONloM188AAAABSnYc1w`) geschrieben — zwischen KI-ANALYSE:END und ai-phase-routing:START, Read-Modify-Write per GraphQL-Mutation, Analyse + Routing byte-for-byte erhalten, alle 6 Marker je 1× verifiziert. Keine Labels angefasst, Issue-Body unangetastet (ADR 0009), kein Ping-Kommentar.

## Erledigt
- SKILL.md gelesen, Issue-Body + Harness-Kommentar geladen (Analyse stand=2026-09-04T17:33:22Z, Ampel 🟢, ux=ja/sonnet/medium).
- Regelquellen statisch geprüft: `.ai-knowledge/ux-design.md` (Rollen/Skalen/Komponentenwahl/Craft Floor) + `docs/mobile-ui-rules.md` (10 Regeln, Repo-Abstimmung 375px/44px).
- KI-UX-Block geschrieben: Interaktion (Switch-Muster App.tsx ~646-690, Sofort-Feedback <100ms, keine Bestätigung nötig, virtuelles P-Badge über Text/Icon unterscheidbar), Mobile-First (375px kein Überlauf, wrap statt scroll, ≥44px), A11y (Switch-Label, aria-live=polite bei Re-Sortierung WCAG 4.1.3, nie nur Farbe 1.4.1, Fokus bleibt auf Switch), KoliBri (KolInputCheckbox switch, KolButton secondary — Primary bleibt Dashboard, KolBadge bleibt), Design-Sprache (nur --pp-*-Tokens, keine neue Farbe, 200ms/reduced-motion oder keine Animation), keine blockierenden offenen Fragen.

## Relevante Stellen
- `frontend/src/App.tsx` ~646-690 — Filterleiste mit Switch-Vorbild „Erledigte Aufgaben anzeigen“; hier kommt Schalter + Button rein (AK1/AK2/AK5).
- `frontend/src/components/TaskTree.tsx:80-129` — `priorityBadge`/P-Badge; virtuelle Prio muss per Text/Icon (nicht nur Farbe) vom echten unterscheidbar bleiben (AK3).
- `frontend/src/lib/balancePriority.ts` (neu, geplant) — reine Rechen-Lib, kein UX-Anteil.

## Annahmen
- File:line-Angaben stammen aus dem Analyse-Block der Triage (nicht selbst geöffnet — Zeitbudget); UX-Empfehlungen sind davon nicht abhängig (Regel-basiert).
- Virtuelles P-Badge unterscheidbar zu machen ist advisory an die Spec adressiert, kein Blocker → ux-ready trotz offem Entscheidungspunkt.

## Verworfen
- Live-Inspection/Browser — laut Prompt verboten (rein statisch).
- KoliBri-MCP-Konsultation — Switch/Button/Badge sind etablierte Repo-Muster mit dokumentierter Prop-Wahl, kein Rätselpotential; Zeit gespart.
- Zweite Primäraktion („Ausbalancieren“ als Primary) — verstoße gegen ux-design.md §4 (primary nur 1× je Sicht) → secondary empfohlen.
- MEMORY.md-Eintrag — kein neuer Fehler/Kriterium nicht erfüllt.

## Offen
- Wegwerf-Artefakte in `.ai-memory/`, NICHT committen: `issue-1220-harness.md`, `issue-1220-ux-block.md`, `issue-1220-new.md`, `splice1220.py` (wurde nie ausgeführt — python war blockiert), `mutation1220.graphql`. Nur diese Datei hier ist die Phasen-Notiz.

## Nächster Schritt
- Spec-Phase (Label `ai:needs-spec` setzt der Workflow): rote Tests TF1–TF3 (Unit) + TF4/TF5 (E2E) anlegen; dabei UX-Entscheidung „virtuelles Badge-Marker (~Präfix oder Badge-Typ) + aria-live bei Re-Sortierung“ festnageln.

## Fallstricke
- Harness-Kommentar-Update: `gh api graphql` mit Inline-Mutation scheitert an Brace-Expansion-Sandbox → Mutation-Query in Datei, `-F query=@datei` (nicht `-f`!) und `-F b=@body-datei`.
- python3 in dieser Sandbox blockiert — Splicing via Read+Write-Tool erledigen.
- Redirect nur in Arbeitsverzeichnis erlaubt (/tmp blockiert).
- E2E-Layout-Assertions: Bounding-Box statt scrollWidth (App-Shell clippt overflow-x:hidden, MEMORY 2026-08-24).
