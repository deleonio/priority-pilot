# KI-Pipeline: Label-getriebener Ticket-Flow

Dieser Überblick zeigt, wie ein Ticket von der Analyse bis zum Merge durch die GitHub-Actions-
Workflows läuft. **Kanten = Trigger**, **fett = Label-Events**, gestrichelt = `workflow_run`/sonstige
Events. Stand: Gate + Auto-Merge sind zu **einem** Workflow (`pr-gate-merge.yml`)
zusammengelegt; Triage + Re-Triage laufen in **einem** Workflow (`01-claude-triage.yml`,
Trigger `issues` [opened/labeled]). Der frühere `@agent`-Kommentar-Trigger ist bewusst
entfernt — Kommentare (insbesondere Bot-Kommentare) dürfen nichts anstoßen.

**Label-Schema (Issue #851):** Jede Phase triggert auf GENAU EIN `ai:needs-*`-Label und
konsumiert es; jede erfolgreiche Phase setzt ihr Done-Label (`ai:analysed`, `ai:ux-reviewed`,
`ai:specified`, `ai:implemented`, `ai:reviewed`, `ai:fixed`, `ai:documented`) **und** den
Trigger der Folgephase. `ai:needs-human` (warum + was der Mensch tun soll) und
`ai:to-big-issue` sind reine Info-Labels ohne Trigger.

```mermaid
flowchart TD
    %% ====== Eintritt ======
    start([Issue geöffnet<br/>OWNER/MEMBER/COLLAB]):::evt
    pushmain([Push auf main<br/>z. B. nach Merge]):::evt

    %% ====== Issue-Phase ======
    subgraph ISSUE [Issue-Phase]
        triage[triage.yml<br/>Analyse + Re-Analyse]:::wf
        spec[spec.yml<br/>rote Tests + Draft-PR]:::wf
        ux[ux.yml<br/>UX-Beratung + Review]:::wf
        implement[implement.yml<br/>Umsetzung + PR ready]:::wf
        unblock[issue-unblock.yml<br/>Nachfolger freigeben]:::wf
    end

    %% ====== PR-Phase ======
    subgraph PR [PR-Phase]
        autolabel[pr-needs-review-label.yml]:::wf
        review[pr-review.yml<br/>Kreuzverhör 🟢/🔴]:::wf
        fixup[pr-fixup.yml<br/>Findings umsetzen]:::wf
        gatemerge[pr-gate-merge.yml<br/>Gate + Auto-Merge]:::wf
        cancel[pr-cancel.yml]:::wf
        conflictscan[pr-conflict-scan.yml<br/>Konflikt-Scan]:::wf
    end

    merged([PR gemergt ✅]):::done
    docpr[07-claude-pr-documenter.yml<br/>Phase 7: Titel/Body/Release-Note/Labels<br/>(Facts + LLM doc.json + Render)]:::wf
    docsweep[06b-documenter-sweep.yml<br/>Catch-up: verlorene Läufe nachtriggern]:::wf
    human([⚠️ Mensch<br/>> 10 PR-Commits]):::stop

    %% ---- Issue-Trigger ----
    start -->|issues.opened| triage
    triage -->|"🟢 UI: label ai:analysed + ai:needs-ux-ui"| ux
    triage -->|"🟢 Nicht-UI: label ai:analysed + ai:needs-spec"| spec
    ux -->|"label: ai:ux-reviewed + ai:needs-spec"| spec
    spec -->|"label: ai:specified + ai:needs-impl"| implement

    %% ---- Übergang Issue -> PR (implement setzt ai:needs-review SELBST als kontrollierten
    %% letzten Schritt — pr-needs-review-label.yml reagiert bewusst NICHT auf bot-erzeugte
    %% Draft→ready-Uebergaenge, nur auf menschliche PR-Erstellung/-Freigabe) ----
    implement -->|"label: ai:implemented (Issue) +<br/>ai:needs-review (PR)"| review

    %% ---- Push-Reset-Pfad (jeder menschliche Push auf den PR-Branch) + menschlich erstellte PRs ----
    gatemerge -.->|"menschlicher Push<br/>(Reset ai:reviewed)"| autolabel
    fixup -.->|"menschlicher Push<br/>(Reset ai:needs-fixup)"| autolabel
    autolabel -->|"label: ai:needs-review<br/>(nur menschliche Aktoren)"| review

    %% ---- Review-Verzweigung ----
    review -->|"🔴: label ai:reviewed + ai:needs-fixup"| fixup
    review -->|"🟢: label ai:reviewed"| gatemerge
    review -->|"⏸️: label ai:reviewed + ai:needs-human"| human

    %% ---- Fixup-Schleife ----
    fixup -->|"label: ai:fixed + ai:needs-review<br/>(erneutes Review)"| review
    fixup -.->|"Stop-Guard"| human

    %% ---- Deterministisches Gate (workflow_run) ----
    review -.->|"CI/Review fertig (workflow_run)"| gatemerge
    fixup -.->|"Push → CI fertig"| gatemerge
    gatemerge -->|"CI/Reviewer 🔴 → label: ai:needs-fixup"| fixup
    gatemerge -->|"alle 🟢 + ai:reviewed → merge"| merged

    %% ---- Abschluss ----
    merged -.->|pull_request.closed| cancel
    merged -.->|"pull_request.closed + merged"| docpr
    docsweep -.->|"schedule/dispatch: gemergt ohne ai:documented"| docpr

    %% ---- Merge-getriebenes Unblocking aufeinander aufbauender Issues ----
    merged -.->|"pull_request.closed + merged"| unblock
    unblock -->|"Nachfolger: + ai:needs-analyse → Re-Triage"| triage

    %% ---- Konflikt-Scan bei Push auf main (z. B. nach Merge) ----
    merged -.->|"pusht nach main"| pushmain
    pushmain -.->|"push: main"| conflictscan
    conflictscan -->|"offener PR mit Merge-Konflikt<br/>→ label: ai:needs-fixup"| fixup

    classDef wf fill:#1f6feb,stroke:#0b3d91,color:#fff;
    classDef evt fill:#2da44e,stroke:#116329,color:#fff;
    classDef done fill:#8957e5,stroke:#4c2889,color:#fff;
    classDef stop fill:#cf222e,stroke:#82071e,color:#fff;
```

## Die Label-Kette in einer Zeile

`ai:needs-analyse` → **analyse** → `ai:analysed` + `ai:needs-ux-ui` → **ux** → `ai:ux-reviewed` +
`ai:needs-spec` → **spec** → `ai:specified` + `ai:needs-impl` → **implement** → `ai:implemented` +
`ai:needs-review` (PR) → **review** → ( `ai:reviewed` + `ai:needs-fixup` → **fixup** →
`ai:fixed` + `ai:needs-review` → **review** )\* → `ai:reviewed` → **gate-merge** → ✅ →
**documenter** → `ai:documented`

## Label-Referenz

**Trigger-Labels (`ai:needs-*`)** — jede Phase reagiert auf genau eines und konsumiert es:

| Label              | Gesetzt von                                                  | Entfernt von (Konsum) | Triggert        |
| ------------------ | ------------------------------------------------------------ | --------------------- | --------------- |
| `ai:needs-analyse` | Mensch (Re-Triage), issue-unblock (Nachfolger-Freigabe)      | triage                | `triage.yml`    |
| `ai:needs-ux-ui`   | triage (bei 🟢 + UI-Bezug)                                   | ux                    | `ux.yml`        |
| `ai:needs-spec`    | triage (bei 🟢 + Nicht-UI), ux (bei Erfolg)                  | spec                  | `spec.yml`      |
| `ai:needs-impl`    | spec (bei Erfolg)                                            | implement             | `implement.yml` |
| `ai:needs-review`  | implement, pr-needs-review-label (nur menschlich), **fixup** | review                | `pr-review.yml` |
| `ai:needs-fixup`   | review (🔴), **gate-merge**, **conflict-scan**               | fixup                 | `pr-fixup.yml`  |

**Done-Labels (`ai:<Vergangenheitsform>`)** — Marker ohne Trigger:

| Label            | Gesetzt von                       | Bedeutung                                   |
| ---------------- | --------------------------------- | ------------------------------------------- |
| `ai:analysed`    | triage                            | Analyse-Phase abgeschlossen                 |
| `ai:ux-reviewed` | ux (bei Erfolg)                   | UX-Beratung abgeschlossen                   |
| `ai:specified`   | spec (bei Erfolg)                 | Spec (rote Tests) abgeschlossen             |
| `ai:implemented` | implement (bei Erfolg)            | Umsetzung abgeschlossen                     |
| `ai:reviewed`    | review (🟢 UND 🔴 — Runde fertig) | Review-Runde abgeschlossen; Gate-Trigger 🟢 |
| `ai:fixed`       | fixup (progress/no-progress)      | Fixup-Runde abgeschlossen                   |
| `ai:documented`  | documenter                        | Dokumentation abgeschlossen (Terminal)      |

**Info-Labels** — kein Trigger, keine automatische Aktion:

| Label                                                                        | Gesetzt von                              | Bedeutung                                                                        |
| ---------------------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------- |
| `ai:needs-human`                                                             | ux, review, fixup (+ PR/Issue-Kommentar) | KI kommt nicht weiter: **Warum** + **was der Mensch beitragen/entscheiden soll** |
| `ai:to-big-issue`                                                            | triage, implement (2. Soft-Abort)        | Aufgabe zu groß für die Pipeline — Signal an den Menschen, löst nichts aus       |
| `ai:continued`                                                               | implement (1. Soft-Abort)                | Fortsetzungs-Marker für den Folgelauf                                            |
| `ai:spec-ready`/`ux:ready`/`ai:ready`/`ai:needs-changes`/`ai:ready-to-merge` | —                                        | **Entfallen** (Issue #851): ersetzt durch `ai:needs-*`/`ai:<past>`-Schema        |

## Schlüsselmechanik

- **Labels werden mit GitHub-App-Token gesetzt** (nicht `GITHUB_TOKEN`) — nur so lösen sie die
  Folge-Workflows aus. Das ist der Motor der Kette. (Ausnahme: Timeout-Cleanups nutzen
  `GITHUB_TOKEN`, damit das Entfernen der Phasen-Trigger nach einem Timeout **nicht**
  kaskadiert.)
- **`ai:analysed`** ist Done-Marker der Analyse (kein Trigger): triage/retriage setzen es; der
  Erst-Triage-Pre-Check nutzt es als Abwesenheits-Guard (schützt vorgelabelte Sub-Issues).
- **Push-Reset-Mechanik:** Jeder menschliche Push auf den PR-Branch (`synchronize`-Event) löst
  `pr-needs-review-label.yml` aus. Dieser entfernt die alten Ergebnis-Labels (`ai:needs-fixup`,
  `ai:reviewed`, `ai:needs-human`) und setzt `ai:needs-review` neu — der PR geht damit bei jedem
  Push wieder in den Review. Bot-Pushes (Fixup, Implement-Spec) werden ignoriert (Actor-Filter),
  um Race-Conditions mit nebenläufigen Label-Switches zu vermeiden. Das bedeutet: **`ai:reviewed`
  ist nicht terminal** — ein menschlicher Push nach grünem Review setzt den PR zurück in den
  Review-Zustand. Soll ein PR mergen bleiben, muss er ohne weitere Pushes grün bleiben.
- **`pr-needs-review-label.yml` labelt NUR menschliche Aktoren** — für alle drei Event-Typen
  (`opened`/`ready_for_review`/`synchronize`), nicht nur bei `synchronize` wie ursprünglich.
  Grund: `implement.yml` macht seine PRs per App-Bot-Token review-bereit und setzt
  `ai:needs-review` danach **selbst** als expliziten letzten Schritt (erst nachdem Beschreibung
  - Testergebnisse vollständig sind) — der Autolabeler darf dem nicht zuvorkommen, sonst startet
    der Review auf einem noch unfertigen PR. Echte menschlich erstellte/freigegebene PRs labelt
    `pr-needs-review-label.yml` weiterhin sofort (sein eigentlicher Zweck, Ticket #116).
- **review ↔ fixup** ist die einzige beabsichtigte Schleife, gedeckelt durch den Stop-Guard
  (> 10 PR-Commits → `ai:needs-fixup` bleibt, der PR-Autor wird getaggt). Der Stop-Guard ist ein
  **deterministischer Shell-Step** (zählt PR-Commits via `gh pr view --json commits`; eine
  semantische Trennung nur nach Fixup-Commits ist ohne unzuverlässige `ready_for_review`-Timeline
  nicht robust machbar — daher Heuristik alle PR-Commits, Schwelle > 10). **Hinweis:** ein
  0-Commit-Loop (Fixup findet keine Findings und committet nichts) wird davon nicht gebremst — die
  No-Progress-Erkennung im Fixup (HEAD unverändert → `ai:fixed` + `ai:needs-human`) kappt ihn.
- **gate-merge** wacht zusätzlich deterministisch per `workflow_run` (Allowlist `['CI', '5/7 Review']`, `completed`) **und** per `pull_request` `labeled` (nur `ai:reviewed`):
  ist mind. ein Allowlist-Check (CI / Reviewer) rot → `ai:needs-fixup` (stößt fixup an); ist der PR
  wegen Merge-Konflikt nicht mergebar (`mergeStateStatus == DIRTY`) → ebenfalls `ai:needs-fixup`;
  sind beide grün und `ai:reviewed` gesetzt UND keines der Labels `ai:needs-fixup`/`ai:needs-review`/
  `ai:needs-human` mehr vorhanden und der PR sauber mergebar → Merge (`gh pr merge --merge`).
  Die Abwesenheits-Checks sind der Rename-Härtung geschuldet: `ai:reviewed` klebt auch nach einer
  🔴-Review-Runde (Done-Marker) — ohne sie mergte das Gate auf dem Stale-Label, während Fixup oder
  Re-Review noch läuft. Der `workflow_run`-Trigger wird nur aus dem Default-Branch (main) gelesen
  und schließt `head_branch == 'main'`-Läufe aus. Dieser eine Workflow ersetzt die früheren zwei
  (Gate + Auto-Merge).
- **conflict-scan** (`pr-conflict-scan.yml`) läuft bei jedem **Push auf main** (typischerweise
  nach einem Merge), prüft **alle** offenen Nicht-Draft-same-repo-PRs auf Mergebarkeit und setzt bei
  Merge-Konflikt (`DIRTY`/`CONFLICTING`) **per App-Token** `ai:needs-fixup` → das stößt
  `pr-fixup.yml` an, der den Konflikt auflöst (conflict-scan löst selbst NICHT auf). Guards:
  `UNKNOWN`/`MERGEABLE` → No-op; trägt der PR bereits `ai:needs-fixup`, wird idempotent
  übersprungen. Kein LLM, kein Checkout, kein Agent-Secret-Check.
- **cancel** beendet laufende review/fixup-Runs beim PR-Close (`pull_request.closed`) — reiner
  `gh`-Aufruf mit `GITHUB_TOKEN` (kein App-Token nötig: bricht nur Runs ab, setzt keine Labels).
- **unblock** (`issue-unblock.yml`) reagiert auf den **Merge** eines PRs (`pull_request.closed`
  - `merged == true`): Blockt das gemergte Issue nativ (GitHub-Issue-Dependencies) Nachfolge-Issues
    und sind dadurch **alle** deren Blocker geschlossen (Fan-in-Gate, autoritativ per Blocker-`state`),
    setzt der Workflow deren `ai:needs-analyse` **per App-Token** → das re-triggert `triage.yml`,
    die den Nachfolger gegen den nun gemergten Code-Stand **neu analysiert** (🟢 → `ai:needs-ux-ui`
    bzw. `ai:needs-spec`, 🟡/🔴 → nur `ai:analysed` + Hinweise). So laufen aufeinander aufbauende
    Sub-Issues Glied für Glied. Bewusst **kein** direkter Folge-Trigger — die erneute
    Machbarkeitsprüfung ist der Kern des Ansatzes. Guards: nur offene Kandidaten mit `ai:analysed`,
    ohne Phasen-Trigger (`ai:needs-ux-ui`/`ai:needs-spec`/`ai:needs-impl`/`ai:needs-analyse`),
    Sammelknoten (`ai:to-big-issue`) übersprungen.
- **Deterministische Gates statt LLM-Vertrauen:** Kritische Zustandsübergänge sind deterministisch
  erzwungen, nicht dem LLM anvertraut (Prinzip „Gate statt Erinnerung"). Früher waren die
  still-ausfallenden Gates (label-schreibende Steps unter dem App-Token, Fan-in-Gate vor der
  Freigabe) testgespiegelt; mit [ADR 0001](./adr/0001-github-workflows-bleiben-ungetestet.md) entfallen diese `.github`-Tests. Alle
  Gates fallen beim ersten Lauf laut auf und sind bewusst nicht zusätzlich abgesichert:
  - **Agent-Secret-Pre-Flight** (alle 7 KI-Workflows): fehlt `AGENT_SECRET`, bricht der
    Lauf deterministisch mit `::error::` ab — kein stiller Skip (AGENTS.md: „bewusstes Opt-in"). Bei
    triage/retriage/spec/implement wird zusätzlich `ai:to-big-issue` gesetzt (Issue-Signal); bei
    review/fixup (die kein `ai:to-big-issue` vergeben, s. u.) stattdessen ein PR-Kommentar.
  - **Phasen-Label-Pre-Check** (alle 7 Phasen): Jede Phase serialisiert global über eine statische
    `concurrency`-Gruppe (`claude-triage`, `claude-spec`, … — genau EIN Lauf je Phase). Das
    Stapeln leistet **`queue: max`**: Ohne diesen Schlüssel hält GitHub pro Gruppe nur EINEN
    wartenden Lauf und verwirft ihn still, sobald ein neuer eintrifft (`queue: single` ist der
    Default, und `cancel-in-progress: false` schützt nur den _laufenden_). Mit `max` warten bis
    zu 100 Läufe in FIFO-Reihenfolge — ohne ihn hätte ein Label-Burst über mehrere Tickets
    Trigger stumm verschluckt. Weil zwischen Trigger und Job-Start Minuten liegen können, prüft ein
    vorgelagerter `precheck`-Job den Label-**IST**-Zustand zur Laufzeit statt den Event-Payload vom
    Trigger-Zeitpunkt (Soll-Werte zentral in `.github/scripts/check-phase-label.sh`, aufgerufen über
    die Action `.github/actions/check-phase-label`). Ist das Trigger-Label inzwischen von einem
    anderen Lauf konsumiert, endet der Lauf ohne Fehler (Hauptjob wird übersprungen) — sonst würde
    eine Phase pro Issue mehrfach laufen.
  - **Stop-Guard** (fixup): > 10 PR-Commits → Loop stoppt hart (s. o.).
  - **Label-Post-Assertion** (review): vergisst der Agent die Label-Umschaltung, setzt der Step
    den Safe-Default `ai:needs-fixup` (statt stiller PR-Stalle).
  - **Doppel-Run-Guard** (spec/implement): existiert schon ein PR/ready-PR mit `Closes #N`, wird
    kein zweiter Branch erzeugt (Race bei schnell aufeinanderfolgenden Label-Events).
  - **Timeout-Alarm** (review/fixup): PR-Workflows vergeben kein `ai:to-big-issue` (AGENTS.md) —
    stattdessen postet dieser Step bei Timeout einen sichtbaren PR-Kommentar, sonst staute der PR
    unsichtbar.
- **Label-Reihenfolge-Prinzip:** Labels sind der Trigger für Folge-Workflows (App-Token-Events lösen
  sofort den nächsten Lauf aus). Sie werden daher IMMER erst als allerletzter Schritt einer Rolle
  gesetzt/entfernt — NIE bevor Issue-Beschreibung, Kommentar, Commit/Push oder PR vollständig
  geschrieben sind. Nachtrag nach einem beobachteten Vorfall (2026-07-01): der Analyse-Workflow
  hatte den Folge-Trigger gesetzt, bevor die Issue-Beschreibung aktualisiert war — der Folge-Workflow
  startete daraufhin mit veraltetem Ticket-Inhalt. Alle sieben Prompt-Flows (triage/retriage/ux/spec/
  implement/fixup/review) instruieren die Label-Umschaltung jetzt explizit als "ALLERLETZTEN
  Schritt, NIE davor". Da dies eine Prompt-Anweisung bleibt (kein
  Shell-Gate möglich, da der Analyseinhalt vom LLM selbst erzeugt wird), ist es defense-in-depth,
  keine harte Garantie — sollte das Problem erneut auftreten, ist ein deterministischer
  Post-Schritt (Label wird von einem separaten Workflow-Step nach Verifikation der Beschreibung
  gesetzt, analog zur Label-Post-Assertion im Review) der nächste Härtungsschritt.

## Eintrittspunkte

- **Neues Issue** (`issues.opened`) von OWNER/MEMBER/COLLABORATOR und ohne `ai:analysed` →
  `triage.yml`.
- **Setzen von `ai:needs-analyse`** (`issues.labeled`) → `triage.yml` (erzwungene Neu-Analyse;
  gesetzt von Mensch oder `issue-unblock.yml` beim Merge des Blockers).
- **Push auf main** (`push` auf `main`, z. B. nach einem Merge) → `pr-conflict-scan.yml`
  (scannt alle offenen PRs auf Merge-Konflikte).
