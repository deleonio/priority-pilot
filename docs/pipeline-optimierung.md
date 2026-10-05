# Pipeline-Optimierung: Hebel, Entscheidungen, Messmethoden

Einstiegspunkt für jede Optimierung an der KI-Pipeline: Welche Hebel existieren, was wurde
wann aus welchem Grund entschieden, wie werden Kennzahlen reproduziert, was ist offen.
Mechanik im Detail steht in [ci-architecture.md](./ci-architecture.md) und
[pipeline-flow.md](./pipeline-flow.md); die Datenbasis der Entscheidungen in
[agent-setup-vergleich-2026-10-04.md](./agent-setup-vergleich-2026-10-04.md).

## Die vier Hebel

| Hebel               | Stellschraube                                                                              | Wirkt auf                            | Entscheidung folgt                                                          |
| ------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------ | --------------------------------------------------------------------------- |
| Provider/Modell     | `vars.LLM_PROVIDER`, `ai-phase-routing`-Tabelle (Harness-Kommentar), `vars.CLAUDE_MODEL_*` | Kosten/Lauf, Qualität                | `[agent-setup-vergleich]` + Kosten-KPIs — Abrechnungsmodell beachten, s. u. |
| Agent-Runtime       | `vars.AGENT_RUNTIME` (claude\|pi)                                                          | Kosten/Lauf, Fail-Quoten, Laufzeiten | `[agent-setup-vergleich]`                                                   |
| Concurrency         | Gruppen in `01`–`06` + `team.yml` (jeweils `group:`, `queue: max`)                         | Durchsatz (Issues/Tag)               | Slot-Auslastung, Warte-Lücken                                               |
| Wiederholungs-Logik | `resolve-escalation.sh`, `fixup-rounds.sh`, `fixup-verdict.sh`, `MAX_FIXUP_ROUNDS`         | Kosten der Nacharbeit, Eskalation    | Fixup-Quote, Runden-Zähler                                                  |

## Abrechnungsmodell — valueCost ist nicht Kasse

Der Anthropic-Zugang läuft über ein **Abo** (Flat), nicht per-Use-Token; ZAI und OpenRouter
sind echte Pay-per-Use-APIs. `cost`/`valueCost` in `.costs/` ist deshalb eine
**Vergleichswährung** (Token-Attribution zu Listenpreisen), die alle Setups vergleichbar
macht — echtes Geld kostet nur, was über ZAI/OpenRouter läuft. Unter Abo-Betrachtung ist
CC+Anthropic der reale Kostensieger, begrenzt durch das **Abo-Limit** (Rate-Limits/
Usage-Fenster) statt durch den Tokenpreis — `llm-limit-detect` (#1954) ist dafür der
Sensor, ZAI dient als Overflow. Beim Lesen der Auswertungen immer trennen: valueCost =
Verbrauch vergleichend, Kasse = nur Pay-per-Use-Provider.

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

**04./05.10. — ZAI-Aliase: pi kennt glm-5.3-flash nicht (Korrektur,
[#2198](https://github.com/deleonio/priority-pilot/pull/2198)).**
`pi` mappte `sonnet` seit dem Pilot (#1184) auf **glm-5-turbo** — belegt durch 192 der
289 pi+zai-Läufe in den `.costs` (die sauberen `glm-5.3-flash`-Einträge stammen aus der
CC+ZAI-Ära am 02.10.-Morgen). Der manuelle Datei-Edit auf `glm-5.3-flash` (04.10.) wirkte
**nicht**: pi kennt nur die drei eingebauten zai-Modelle (`glm-5.3`, `glm-5-turbo`,
`glm-4.7`, s. `pi --list-models`) und fiel bei der unbekannten ID **still** auf den
Default zurück — 35 weitere turbo-Läufe bis zum Runtime-Wechsel, kein Fehler, kein Log.
Lehren: (1) pi-Ziele in `models.json` dürfen nur IDs aus `pi --list-models` tragen;
(2) der glm-5.3-flash-Wunsch wirkt nur in der cc-Form (Claude Code); (3) ein stiller
Fallback ist schlimmer als ein lauter Abbruch — der Katalog-Guard im `model-adapter.sh`
setzt das inzwischen durch. openrouter zeigt auf die Free-Models-Collection.

**04.10. — Wiederholungs-Eskalation.** Die alte Auto-Eskalation hing am Label-Pfad und fiel
mit der Abschaffung weg — sie zieht in den Tabellen-Pfad: ab **Fixup-Runde 2** stuft
`resolve-escalation.sh` (`--rounds` aus `fixup-rounds.sh count`) Modell und Effort des
Tabellen-Modells je eine Stufe hoch (`sonnet→opus`, `medium→high`; ab `opus` nur Effort).
Runde 1 = normaler Review→Fixup-Zyklus ohne Signal; Zählfehler fail-open. `ai:continued`
(Soft-Abort) bleibt das zweite Signal. Die in ADR 0004 dokumentierte Lücke ist geschlossen.

**05.10. — Concurrency pro Ticket ([#2199](https://github.com/deleonio/priority-pilot/pull/2199)).**
Nach dem Phasen-Split (#2171) der zweite Schritt: Der Key ist das Ticket, nicht die Phase —
Lane A `harness-<Issue-Nr.>` (Triage/UX/Spec/Implement), Lane B `harness-pr-<Head-Branch>`
(Review/Fixup; lokale PRs ohne Issue laufen über ihren Feature-Branch). Beliebig viele
Tickets laufen voll parallel; der Koordinator steuert den Durchsatz allein über den Zulauf.
Puffer an der A→B-Grenze: Review-CI-Wait. Residual-Risiko B→A (Re-Triage während Review/
Fixup) dokumentiert in `01-triage.yml`; der Documenter bleibt statisch (.costs-Seals).

**05.10. — Eine kanonische Modell-Definition + Adapter + pi ohne Anthropic
([#2203](https://github.com/deleonio/priority-pilot/pull/2203)).** Die drei bisherigen
Quellen (`.github/model-ids.json`, `.github/pi/model-aliases.json`, Vars
`CLAUDE_CODE_SETTINGS_LOCAL_*` / `PI_MODEL_ALIASES`) sind in **`.github/models.json`**
aufgegangen — runtime-FREI: Modell-Identität, Kontext, **Preis** (EUR/USD) und
Tier-Bindung. Die Formatierung je Runtime liegt im Adapter **`model-adapter.sh`**
(cc-`[1m]`-Regel, pi-`provider/id`-Präfix, deklarierte Ersatz-Modelle, **pi-Katalog-Guard**
— der stille-Fallback-Vorfall ist damit strukturell geschlossen). `cost-from-transcript.ts`
liest die Preise aus derselben Datei — Identität und Preis können nicht mehr driften.
Matrix: **Claude Code ↔ alle 3 Provider, pi ↔ nur zai|openrouter** (Guards in setup-agent,
set-agent-config und Adapter). Die drei alten Vars (`CLAUDE_CODE_SETTINGS_LOCAL_ZAI`/`_OPENROUTER`, `PI_MODEL_ALIASES`)
sind am 05.10. gelöscht — models.json ist die einzige Instanz.

**05.10. (Nacht) — Runtime-Schalter auf Claude Code + Anthropic.** Der Koordinator hat
`AGENT_RUNTIME=claude` und `LLM_PROVIDER=claude` gesetzt (Abo-Flat statt ZAI per-use). Die
ZAI/pi-Erkenntnisse bleiben dokumentiert und wirken bei Rückkehr von pi.

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

**05.10. (Nacht) — Runtime-Schalter zurück auf Claude Code + Anthropic.** Der
Koordinator hat `AGENT_RUNTIME=claude` und `LLM_PROVIDER=claude` gesetzt: Die Messreihe
läuft aktuell auf CC+Anthropic (Opus/Sonnet 5.5 nativ). Beachte beim Lesen der laufenden
`.costs`-Sätze: Die ZAI/pi-Erkenntnisse (Aliase, Eskalation, Lanes) bleiben dokumentiert
und wirken, sobald zurückgeschaltet wird — der Alias-Fix #2198 wirkt erst wieder unter pi.

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
