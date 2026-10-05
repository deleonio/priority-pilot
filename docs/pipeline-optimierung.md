# Pipeline-Optimierung: Hebel, Entscheidungen, Messmethoden

Einstiegspunkt für jede Optimierung an der KI-Pipeline: Welche Hebel existieren, was wurde
wann aus welchem Grund entschieden, wie werden Kennzahlen reproduziert, was ist offen.
Mechanik im Detail steht in [ci-architecture.md](./ci-architecture.md) und
[pipeline-flow.md](./pipeline-flow.md); die Datenbasis der Entscheidungen in
[agent-setup-vergleich-2026-10-04.md](./agent-setup-vergleich-2026-10-04.md).

## Die vier Hebel

| Hebel               | Stellschraube                                                                              | Wirkt auf                            | Entscheidung folgt                      |
| ------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------ | --------------------------------------- |
| Provider/Modell     | `vars.LLM_PROVIDER`, `ai-phase-routing`-Tabelle (Harness-Kommentar), `vars.CLAUDE_MODEL_*` | Kosten/Lauf, Qualität                | `[agent-setup-vergleich]` + Kosten-KPIs |
| Agent-Runtime       | `vars.AGENT_RUNTIME` (claude\|pi)                                                          | Kosten/Lauf, Fail-Quoten, Laufzeiten | `[agent-setup-vergleich]`               |
| Concurrency         | Gruppen in `01`–`06` + `team.yml` (jeweils `group:`, `queue: max`)                         | Durchsatz (Issues/Tag)               | Slot-Auslastung, Warte-Lücken           |
| Wiederholungs-Logik | `resolve-escalation.sh`, `fixup-rounds.sh`, `fixup-verdict.sh`, `MAX_FIXUP_ROUNDS`         | Kosten der Nacharbeit, Eskalation    | Fixup-Quote, Runden-Zähler              |

Es gibt genau **eine Quelle je Information**: Modellwahl = Routing-Tabelle (Label-Familie
`ai:model:*` wurde 04.10. abgeschafft, s. u.), Phasen-Trigger = Label-Kette, Durchsatz-Signal =
Runden-Zähler. Zweit-Medien für dieselbe Information werden ignoriert oder verwirren —
die Label-Abschaffung ist das Lehrstück dazu.

## Entscheidungs-Log (chronologisch)

**01.10. — Provider ZAI statt Anthropic.** Tokenpreis macht mehr Turns wett: Kosten/Lauf
$0,72 → $0,65, Tageskosten halbiert bei gleichem Durchsatz. `ai-phase-routing`-Tabelle pinnt
je Phase das Modell; `ai:model:*`-Labels blieben als Zweit-Medium bestehen (später Problem).

**02./03.10. — Runtime PI v0 → PI v1.** PI v0 (gepinnt 0.87.1): günstigster Lauf ($0,54),
aber 16–23 % Fail-Quoten in Review/Documenter/Implement → teuer über Fixup-Schleifen. PI v1
(`@latest`, [#2108](https://github.com/deleonio/priority-pilot/issues/2108)): $0,68 ≈ CC+ZAI,
beste Fail-Quoten, aber ~2× Turns und 60 min Implement-Median. KPI-gesteuerte Beobachtung
statt Festlegung (s. u.). Seit [#2090](https://github.com/deleonio/priority-pilot/issues/2090)
trägt jeder `.costs`-Satz `runtime` + `configuredModel` — Grundlage jeder Runtime-Auswertung.

**04.10. — Concurrency entkoppelt ([#2171](https://github.com/deleonio/priority-pilot/pull/2171)).**
Die gemeinsame Gruppe `llm` serialisierte Spec+Implement+team auf ~1,5 h/Issue (Limit
~16–20 Issues/Tag) bei 12–35 % Slot-Auslastung — die Pipeline war **flusslimitiert, nicht
rechenlimitiert**. Jetzt: Spec in `llm-spec`, Implement/Fixup+team in `llm-impl`; Obergrenze
7 gleichzeitige Läufe. Sicherheitsinvarianten: Implement↔Fixup serialisiert weiter über
`llm-impl` (ADR 0005); **Job-Ende-Barriere** — die Label-Übergabe passiert mitten im Job,
deshalb setzt 03 das Folge-Label als allerletzten Job-Step (`label-final`) und 04→05 ist
über den Review-CI-Wait gepuffert. Issue-granulare Keys bleiben verworfen (PR→Issue-Normalisierung
beim Fixup-Eingang = Überhol-Falle).

**04.10. — Label-Familie `ai:model:*` abgeschafft ([#2182](https://github.com/deleonio/priority-pilot/pull/2182)).**
Das Label war ein Zweit-Medium der Routing-Tabelle und wurde vom Vorrang „Tabelle > Label"
in implement/fixup **wirkungslos überstimmt** — ein manuelles `ai:model:opus`-Upgrade
(#1970/#1968) änderte nichts, die Läufe fuhren mit `sonnet` aus der Tabelle. Konfiguration,
die ohne Warnung ignoriert wird, ist schlimmer als keine. Seitdem: Tabelle = einzige
Modellquelle; ohne Tabelle fail-open der Phasen-Default (statt Abbruch + Parken).
`resolve-model-label.sh` + Action gelöscht; manuelle Overrides über Body-Edit der Tabelle
oder `vars.CLAUDE_MODEL_*`.

**04./05.10. — ZAI-Aliase korrigiert ([#2198](https://github.com/deleonio/priority-pilot/pull/2198)).**
`pi` mappte `sonnet` seit dem Pilot (#1184) auf **glm-5-turbo** statt glm-5.3-flash — das
~4× teurere Modell ($1,20/$4,00 vs. $0,32/$1,14 pro MTok) lief seit dem Voll-Rollout in
allen sonnet-Phasen. Aligniert auf das Claude-Code-Mapping (sonnet+haiku = glm-5.3-flash);
openrouter zeigt auf die Free-Models-Collection. Lehrstück: dieselbe Information (Alias→ID)
lebte in zwei Quellen (Vars + Datei) und driftete auseinander.

**04.10. — Wiederholungs-Eskalation.** Die alte Auto-Eskalation hing am Label-Pfad und fiel
mit der Abschaffung weg — sie zieht in den Tabellen-Pfad: ab **Fixup-Runde 2** stuft
`resolve-escalation.sh` (`--rounds` aus `fixup-rounds.sh count`) Modell und Effort des
Tabellen-Modells je eine Stufe hoch (`sonnet→opus`, `medium→high`; ab `opus` nur Effort).
Runde 1 = normaler Review→Fixup-Zyklus ohne Signal; Zählfehler fail-open. `ai:continued`
(Soft-Abort) bleibt das zweite Signal. Die in ADR 0004 dokumentierte Lücke ist geschlossen.

## Wie messen (Reproduktion)

- **Kosten je Lauf:** `.costs/<issueId>.json` — Felder siehe [.costs/SCHEMA.md](../.costs/SCHEMA.md);
  `provider`, `runtime`, `configuredModel` je Satz. Erst nach Merge versiegelt (Documenter) —
  für laufende PRs die Workflow-Artefakte nutzen, nicht den Checkout.
- **Aggregation:** [`report-pipeline.yml`](../.github/workflows/report-pipeline.yml) /
  `tokens-report.ts`, `audit-basis.ts`; Fokus-Modus `--issues`.
- **Durchsatz:** Issues geschlossen / PRs gemergt je Fenster (04:00–04:00 MESZ) via
  `gh api` (`closed_at`, `mergedAt` filtern); gegen die Baseline 24–30 PRs/Tag.
- **Laufzeiten:** Runs-API je Phase; **skipped Runs ausklammern** und beachten:
  `run_started_at` setzt bei concurrency-gequeuoten Runs schon beim Einreihen an —
  echte Parallelität ist aus den Run-Feldern allein **nicht** beweisbar (Job-Logs nötig).
- **Wiederholungen:** `fixup-rounds.sh count --repo … --pr …` (count = aktuelle Runde);
  Review-Fail-Quote aus den `05-review`-Run-Conclusionen.

**05.10. — Concurrency pro Ticket.** Nach dem Phasen-Split (#2171) der zweite Schritt:
Der Key ist jetzt das Ticket, nicht die Phase — Lane A `harness-<Issue-Nr.>` (Triage/UX/
Spec/Implement), Lane B `harness-<Head-Branch>` (Review/Fixup). Beliebig viele Tickets
laufen voll parallel; der Koordinator steuert den Durchsatz allein über den Zulauf. Puffer
an der A→B-Grenze: Review-CI-Wait. Residual-Risiko B→A (Re-Triage während Review/Fixup)
ist dokumentiert (01-triage.yml); der Documenter bleibt bewusst statisch (.costs-Seals).

## Offene Hebel und KPIs (Stand 05.10.)

1. **PI v1 KPIs** (sonst Rückwechsel auf CC+ZAI per `gh variable set`): Review-Fail < 10 %,
   Implement-Median < 40 min, Turns/Lauf < 25, Fixup < $0,70.
2. **Slot-Grenzen hosted:** Pro-Ticket-Lanes heben die künstliche Obergrenze, aber der
   GitHub-Hosted-Job-Limit (Free: 20 parallel) und das z.ai-Kontingent werden zur neuen
   Decke — llm-limit-detect (#1954) und Peak-Vertagen (#2100) sind jetzt die wirksamen
   Bremsen.
3. **Fixup-Budget vs. Workbench-Setup:** Playwright-Browser (~180 MB) und Builds werden je
   Lauf frisch aufgebaut und fraßen das Fixup-Budget — Auslöser: #1970 starb an der harten
   Frist (`exit 143` = SIGTERM). Hebel: Warm-Cache nach dem #2092/#2134-Muster (schedule-
   Warm-Lauf schreibt, Läufe lesen) oder Budget erhöhen.
4. **Mechanische Triage-Fails** ([#2138](https://github.com/deleonio/priority-pilot/issues/2138),
   Container-Step) — verzerren die Fail-Statistiken und kosten Retries.
5. **zai-Peak 08–12 MESZ:** Vertagen (#2100) auf Wirkung prüfen; es hat die Analyse→Spec-Lücken
   von 14–16 h mitverursacht.

## Fallstricke (aus dieser Optimierungswelle)

- **Job-Ende-Barriere:** Jede Gruppen-Grenze braucht einen Puffer (CI-Wait) oder Label-am-Ende.
  Neuer Split ohne einen der beiden Mechanismen reißt die Barriere still auf — die
  pro-Ticket-Lanes nutzen den Review-CI-Wait als Puffer zur Lane A.
- **Re-Triage während Review/Fixup (Lane B→A):** kann seit den pro-Ticket-Lanes überholen,
  wo früher die globale Gruppe blockierte — Re-Armierung in laufenden Review/Fixup-Phasen
  ist Koordinator-Disziplin; der fixup-verdict-HEAD-Guard erkennt Fremd-Commits.
- **Zweit-Medien vermeiden:** Wo dieselbe Information zwei Kanäle hat (Tabelle + Label),
  gewinnt einer stumm — Overrides wirken dann nicht. Eine Quelle pro Information.
- **Queued-Runs verfälschen Zeitstempel** (s. o. Messmethoden) — Parallelläufe nie aus
  `run_started_at`-Überlappungen „beweisen".
- **`changelog-render.sh`-Tests sind lokal (macOS, Bash 3.2 ohne `mapfile`) rot**, CI grün —
  kein Regressionssignal.
- **Geteilter Checkout:** Parallele Sessions wechseln Branches im selben Verzeichnis — vor
  Commit `git branch --show-current`, WIP per stash transportieren.
- **Confounds beim Setup-Vergleich:** Issue-Mix, Peak-Vertagen (#2100) und #2090-Deployment
  lagen zeitgleich mit den Umschaltungen — A/B-Aussagen nur mit Tagesfenstern und
  Phasen-Aufteilung, nie aus Stundenslices.
