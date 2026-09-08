# ADR 0011 — Umsetzung: Worktree-Isolation für parallele Ticket-Läufe

- **Status:** Vorgeschlagen (2026-09-08) — Entscheidung steht aus
- **Datum:** 2026-09-08
- **Kontext:** [ADR 0005](0005-fixup-und-umsetzung-sind-eine-phase.md) (Fixup + Umsetzung = eine Phase), [ADR 0001](0001-github-workflows-bleiben-ungetestet.md), [Pipeline-Flow](../../docs/pipeline-flow.md); Impuls: Research zu Vibe Kanban anlässlich #1281

## Kontext

Die Umsetzungs-Phase (04) läuft heute sequenziell: ein Workflow-Run, ein Checkout,
ein Ticket. Parallele Tickets konkurrieren um dieselbe Phase — sie warten, statt
isoliert zu laufen. Fixup-Runden (ADR 0005) verlängern die Belegung des Checkouts
jeweils um eine ganze Schleife (Ø ~47 Turns je Nacharbeit, `.costs/`).

Vibe Kanban (BloopAI) normalisiert das Gegenteil: **ein git Worktree pro Task**,
je Workspace ein Setup-Script und ein Dev-Server, Merge-Ordnung zum Schluss —
Agenten arbeiten damit selbstverständlich parallel, ohne sich zu behindern
(Research #1281; das Projekt wurde inzwischen eingestellt, das Muster bleibt
tragfähig).

## Optionen

| #   | Option                                                                                   | Nutzen                                                                                                             | Kosten/Risiken                                                                                                                                                             |
| --- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Status quo** (sequenziell, ein Checkout)                                               | null Extra-Komplexität; Artefakt-, Verdict- und Label-Pfade bleiben unverändert                                    | Durchsatz begrenzt durch die langsamste Phase; parallele Tickets stauen sich vor 04                                                                                        |
| 2   | **Worktree je Umsetzungs-/Fixup-Lauf** (04 richtet `git worktree add` pro Run, räumt ab) | Isolation je Run ohne Verhaltenänderung der Phase; mehrere Runs desselben Workflows laufen gefahrlos nebeneinander | Script-Aufwand in `04-implement.yml` (Setup/Teardown, Cleanup bei Crash — vgl. `phase-crash-park.sh`); Runner-Kosten steigen nur, wenn tatsächlich parallel gestartet wird |
| 3   | **Matrix-Parallellisierung mehrerer Issues** (ein Dispatch startet N Ticket-Läufe)       | echter Durchsatzgewinn bei Ticket-Stau                                                                             | höchste Komplexität: Merge-Koordination über konkurrierende PRs, Kostenkontrolle (LLM-Kontingent), Verdict-/Artefakt-Zuordnung je Matrix-Bein                              |

## Empfehlung

**Option 2 als erster Schritt** — sie ist die Voraussetzung für Option 3 und auch
ohne Parallellisierung nützlich (Fixup-Runs kollidieren nicht mehr mit laufenden
Umsetzungen; lokale pi-Sessions nutzen Worktree-Isolation bereits nach demselben
Muster). Option 3 erst, wenn `.costs/` einen belegten Stau vor Phase 04 nachweist.

## Offene Entscheidung

Ob und wann umgestellt wird, entscheidet der Mensch (needs-human-Muster): dieser
ADR ist bewusst eine Entscheidungsvorlage ohne Implementierungsschritte. Bei
Annahme (Status → Accepted) folgt die Umsetzung von Option 2 als eigenes Ticket;
[gemäß ADR 0001](0001-github-workflows-bleiben-ungetestet.md) bleibt die Workflow-Mechanik
selbst ungetestet, verifiziert über einen kontrollierten Testlauf.
