# KI-Pipeline: Label-getriebener Ticket-Flow

Dieser Überblick zeigt, wie ein Ticket von der Analyse bis zum Merge durch die GitHub-Actions-
Workflows läuft. **Kanten = Trigger**, **fett = Label-Events**, gestrichelt = `workflow_run`/sonstige
Events. Stand: Gate + Auto-Merge sind zu **einem** Workflow (`pr-gate-merge.yml`)
zusammengelegt; Triage + Re-Triage sind zu **einem** Workflow (`triage.yml`, zwei Trigger:
`issues` + `issue_comment`) zusammengelegt.

```mermaid
flowchart TD
    %% ====== Eintritt ======
    start([Issue geöffnet<br/>OWNER/MEMBER/COLLAB]):::evt
    cmt([Kommentar mit @agent<br/>OWNER/MEMBER/COLLAB]):::evt
    pushmain([Push auf main<br/>z. B. nach Merge]):::evt

    %% ====== Issue-Phase ======
    subgraph ISSUE [Issue-Phase]
        triage[triage.yml<br/>Analyse + Re-Analyse]:::wf
        spec[spec.yml<br/>rote Tests + Draft-PR]:::wf
        ux[ux.yml<br/>UX-Review + 375px-Tests]:::wf
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
    docpr[06-claude-pr-documenter.yml<br/>Phase 6: Titel/Body/Release-Note/Labels<br/>(Facts + LLM doc.json + Render)]:::wf
    docsweep[06b-documenter-sweep.yml<br/>Catch-up: verlorene Läufe nachtriggern]:::wf
    human([⚠️ Mensch<br/>> 10 PR-Commits]):::stop

    %% ---- Issue-Trigger ----
    start -->|issues.opened| triage
    cmt -->|issue_comment| triage
    triage -->|"label: ai:spec-ready 🟢"| spec
    spec -->|"label: ux:ready"| ux
    ux -->|"label: ai:ready"| implement

    %% ---- Übergang Issue -> PR (implement setzt ai:needs-review SELBST als kontrollierten
    %% letzten Schritt — pr-needs-review-label.yml reagiert bewusst NICHT auf bot-erzeugte
    %% Draft→ready-Uebergaenge, nur auf menschliche PR-Erstellung/-Freigabe) ----
    implement -->|"label: ai:needs-review"| review

    %% ---- Push-Reset-Pfad (jeder menschliche Push auf den PR-Branch) + menschlich erstellte PRs ----
    gatemerge -.->|"menschlicher Push<br/>(Reset ai:ready-to-merge)"| autolabel
    fixup -.->|"menschlicher Push<br/>(Reset ai:needs-changes)"| autolabel
    autolabel -->|"label: ai:needs-review<br/>(nur menschliche Aktoren)"| review

    %% ---- Review-Verzweigung ----
    review -->|"label: ai:needs-changes 🔴"| fixup
    review -->|"label: ai:ready-to-merge 🟢"| gatemerge

    %% ---- Fixup-Schleife ----
    fixup -->|"label: ai:needs-review<br/>(erneutes Review)"| review
    fixup -.->|"Stop-Guard"| human

    %% ---- Deterministisches Gate (workflow_run) ----
    review -.->|"CI/Review fertig (workflow_run)"| gatemerge
    fixup -.->|"Push → CI fertig"| gatemerge
    gatemerge -->|"CI/Reviewer 🔴 → label: ai:needs-changes"| fixup
    gatemerge -->|"alle 🟢 + ai:ready-to-merge → merge"| merged

    %% ---- Abschluss ----
    merged -.->|pull_request.closed| cancel
    merged -.->|"pull_request.closed + merged"| docpr
    docsweep -.->|"schedule/dispatch: gemergt ohne ai:documented"| docpr

    %% ---- Merge-getriebenes Unblocking aufeinander aufbauender Issues ----
    merged -.->|"pull_request.closed + merged"| unblock
    unblock -->|"Nachfolger: − ai:analyzed → Re-Triage"| triage

    %% ---- Konflikt-Scan bei Push auf main (z. B. nach Merge) ----
    merged -.->|"pusht nach main"| pushmain
    pushmain -.->|"push: main"| conflictscan
    conflictscan -->|"offener PR mit Merge-Konflikt<br/>→ label: ai:needs-changes"| fixup

    classDef wf fill:#1f6feb,stroke:#0b3d91,color:#fff;
    classDef evt fill:#2da44e,stroke:#116329,color:#fff;
    classDef done fill:#8957e5,stroke:#4c2889,color:#fff;
    classDef stop fill:#cf222e,stroke:#82071e,color:#fff;
```

## Die Label-Kette in einer Zeile

`ai:spec-ready` → **spec** → `ux:ready` → **ux** → `ai:ready` → **implement** → `ai:needs-review` → **review** →
( `ai:needs-changes` → **fixup** → `ai:needs-review` → **review** )\* → `ai:ready-to-merge` →
**gate-merge** → ✅

## Label-Referenz

| Label               | Gesetzt von                                                  | Entfernt von                                                        | Triggert                                                      |
| ------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------- |
| `ai:analyzed`       | triage (Triage- oder Re-Triage-Pfad)                         | **issue-unblock** (Merge des Blockers), manuell                     | _Setzen:_ Vorbedingung; _Entfernen:_ `triage.yml` (Re-Triage) |
| `ai:spec-ready`     | triage (bei 🟢, Triage- oder Re-Triage-Pfad)                 | _(kein automatisches Entfernen)_                                    | `spec.yml`                                                    |
| `ux:ready`          | spec                                                         | _(kein automatisches Entfernen)_                                    | `ux.yml`                                                      |
| `ai:ready`          | ux                                                           | _(kein automatisches Entfernen)_                                    | `implement.yml`                                               |
| `ux:failed`         | ux (`VERDICT: ux-not-ready`)                                 | ux (beim nächsten Lauf)                                             | _nichts_ — Umsetzung bleibt ohne `ai:ready` blockiert         |
| `ai:needs-review`   | implement, pr-needs-review-label (nur menschlich), **fixup** | review, gate-merge                                                  | `pr-review.yml`                                               |
| `ai:needs-changes`  | review (🔴), **gate-merge**, **conflict-scan**               | **fixup**, **pr-needs-review-label** (bei Push)                     | `pr-fixup.yml`                                                |
| `ai:ready-to-merge` | review (🟢)                                                  | **gate-merge** (rot/Konflikt), **pr-needs-review-label** (bei Push) | `pr-gate-merge.yml`                                           |
| `ai:to-big-issue`   | triage/spec/implement (Timeout oder fehlendes Agent-Secret)  | manuell (nach Aufteilen / Secret-Fix)                               | _Entfernen:_ `triage.yml` (Neu-Analyse)                       |

## Schlüsselmechanik

- **Labels werden mit GitHub-App-Token gesetzt** (nicht `GITHUB_TOKEN`) — nur so lösen sie die
  Folge-Workflows aus. Das ist der Motor der Kette. (Ausnahme: Timeout-Cleanups nutzen
  `GITHUB_TOKEN`, damit das Entfernen von `ai:ready`/`ai:spec-ready` nach einem Timeout **nicht**
  kaskadiert.)
- **`ai:analyzed`** ist Vorbedingung (kein Trigger): triage/retriage setzen es; spec/implement
  prüfen es per `contains(...)`.
- **Push-Reset-Mechanik:** Jeder menschliche Push auf den PR-Branch (`synchronize`-Event) löst
  `pr-needs-review-label.yml` aus. Dieser entfernt die alten Ergebnis-Labels (`ai:needs-changes`,
  `ai:ready-to-merge`) und setzt `ai:needs-review` neu — der PR geht damit bei jedem Push wieder
  in den Review. Bot-Pushes (Fixup, Implement-Spec) werden ignoriert (Actor-Filter), um
  Race-Conditions mit nebenläufigen Label-Switches zu vermeiden. Das bedeutet: **`ai:ready-to-merge`
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
  (> 10 PR-Commits → `ai:needs-changes` bleibt, der PR-Autor wird getaggt). Der Stop-Guard ist ein
  **deterministischer Shell-Step** (zählt PR-Commits via `gh pr view --json commits`; eine
  semantische Trennung nur nach Fixup-Commits ist ohne unzuverlässige `ready_for_review`-Timeline
  nicht robust machbar — daher Heuristik alle PR-Commits, Schwelle > 10). **Hinweis:** ein
  0-Commit-Loop (Fixup findet keine Findings und committet nichts) wird davon nicht gebremst — die
  H1-Post-Assertion im Review alarmiert in dem Fall per PR-Kommentar.
- **gate-merge** wacht zusätzlich deterministisch per `workflow_run` (Allowlist `['CI', '4/6 Review']`, `completed`) **und** per `pull_request` `labeled` (nur `ai:ready-to-merge`):
  ist mind. ein Allowlist-Check (CI / Reviewer) rot → `ai:needs-changes` (stößt fixup an); ist der PR
  wegen Merge-Konflikt nicht mergebar (`mergeStateStatus == DIRTY`) → ebenfalls `ai:needs-changes`;
  sind beide grün und `ai:ready-to-merge` gesetzt und der PR sauber mergebar → Merge
  (`gh pr merge --merge`). Der `workflow_run`-Trigger wird nur aus dem Default-Branch (main) gelesen
  und schließt `head_branch == 'main'`-Läufe aus. Dieser eine Workflow ersetzt die früheren zwei
  (Gate + Auto-Merge).
- **conflict-scan** (`pr-conflict-scan.yml`) läuft bei jedem **Push auf main** (typischerweise
  nach einem Merge), prüft **alle** offenen Nicht-Draft-same-repo-PRs auf Mergebarkeit und setzt bei
  Merge-Konflikt (`DIRTY`/`CONFLICTING`) **per App-Token** `ai:needs-changes` → das stößt
  `pr-fixup.yml` an, der den Konflikt auflöst (conflict-scan löst selbst NICHT auf). Guards:
  `UNKNOWN`/`MERGEABLE` → No-op; trägt der PR bereits `ai:needs-changes`, wird idempotent
  übersprungen. Kein LLM, kein Checkout, kein Agent-Secret-Check.
- **cancel** beendet laufende review/fixup-Runs beim PR-Close (`pull_request.closed`) — reiner
  `gh`-Aufruf mit `GITHUB_TOKEN` (kein App-Token nötig: bricht nur Runs ab, setzt keine Labels).
- **unblock** (`issue-unblock.yml`) reagiert auf den **Merge** eines PRs (`pull_request.closed`
  - `merged == true`): Blockt das gemergte Issue nativ (GitHub-Issue-Dependencies) Nachfolge-Issues
    und sind dadurch **alle** deren Blocker geschlossen (Fan-in-Gate, autoritativ per Blocker-`state`),
    entfernt der Workflow deren `ai:analyzed` **per App-Token** → das re-triggert `triage.yml`,
    die den Nachfolger gegen den nun gemergten Code-Stand **neu analysiert** (🟢 → `ai:spec-ready`,
    🟡/🔴 → nur `ai:analyzed` + Hinweise). So laufen aufeinander aufbauende Sub-Issues Glied für Glied.
    Bewusst **kein** direktes `ai:spec-ready` — die erneute Machbarkeitsprüfung ist der Kern des
    Ansatzes. Guards: nur offene Kandidaten mit `ai:analyzed`, ohne `ai:spec-ready`/`ai:ready`,
    Sammelknoten (`ai:to-big-issue`) übersprungen.
- **Deterministische Gates statt LLM-Vertrauen:** Kritische Zustandsübergänge sind deterministisch
  erzwungen, nicht dem LLM anvertraut (Prinzip „Gate statt Erinnerung"). Früher waren die
  still-ausfallenden Gates (label-schreibende Steps unter dem App-Token, Fan-in-Gate vor der
  Freigabe) testgespiegelt; mit [ADR 0001](./adr/0001-github-workflows-bleiben-ungetestet.md) entfallen diese `.github`-Tests. Alle
  Gates fallen beim ersten Lauf laut auf und sind bewusst nicht zusätzlich abgesichert:
  - **Agent-Secret-Pre-Flight** (alle 6 KI-Workflows): fehlt `AGENT_SECRET`, bricht der
    Lauf deterministisch mit `::error::` ab — kein stiller Skip (AGENTS.md: „bewusstes Opt-in"). Bei
    triage/retriage/spec/implement wird zusätzlich `ai:to-big-issue` gesetzt (Issue-Signal); bei
    review/fixup (die kein `ai:to-big-issue` vergeben, s. u.) stattdessen ein PR-Kommentar.
  - **Phasen-Label-Pre-Check** (alle 6 Phasen): Jede Phase serialisiert global über eine statische
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
    den Safe-Default `ai:needs-changes` (statt stiller PR-Stalle).
  - **Doppel-Run-Guard** (spec/implement): existiert schon ein PR/ready-PR mit `Closes #N`, wird
    kein zweiter Branch erzeugt (Race bei schnell aufeinanderfolgenden Label-Events).
  - **Timeout-Alarm** (review/fixup): PR-Workflows vergeben kein `ai:to-big-issue` (AGENTS.md) —
    stattdessen postet dieser Step bei Timeout einen sichtbaren PR-Kommentar, sonst staute der PR
    unsichtbar.
- **Label-Reihenfolge-Prinzip:** Labels sind der Trigger für Folge-Workflows (App-Token-Events lösen
  sofort den nächsten Lauf aus). Sie werden daher IMMER erst als allerletzter Schritt einer Rolle
  gesetzt/entfernt — NIE bevor Issue-Beschreibung, Kommentar, Commit/Push oder PR vollständig
  geschrieben sind. Nachtrag nach einem beobachteten Vorfall (2026-07-01): der Analyse-Workflow
  hatte `ai:spec-ready` gesetzt, bevor die Issue-Beschreibung aktualisiert war — der Spec-Workflow
  startete daraufhin mit veraltetem Ticket-Inhalt. Alle sechs Prompt-Flows (triage/retriage/spec/
  implement/fixup/review) instruieren die Label-Umschaltung jetzt explizit als "ALLERLETZTEN
  Schritt, NIE davor". Da dies eine Prompt-Anweisung bleibt (kein
  Shell-Gate möglich, da der Analyseinhalt vom LLM selbst erzeugt wird), ist es defense-in-depth,
  keine harte Garantie — sollte das Problem erneut auftreten, ist ein deterministischer
  Post-Schritt (Label wird von einem separaten Workflow-Step nach Verifikation der Beschreibung
  gesetzt, analog zur Label-Post-Assertion im Review) der nächste Härtungsschritt.

## Eintrittspunkte

- **Neues Issue** (`issues.opened`) von OWNER/MEMBER/COLLABORATOR und ohne `ai:analyzed` →
  `triage.yml`.
- **Entfernen von `ai:analyzed` oder `ai:to-big-issue`** (`issues.unlabeled`) → `triage.yml`
  (erzwungene Neu-Analyse; das Entfernen setzt bereits Schreibzugriff voraus). Über diesen Pfad
  triggern auch `issue-unblock.yml` (App-Token entfernt `ai:analyzed` beim Merge des Blockers)
  und ein Mensch, der ein aufgeteiltes/behobenes `ai:to-big-issue` entfernt.
- **`@agent`-Kommentar** an einem Issue (`issue_comment.created`, NICHT `edited`) von
  OWNER/MEMBER/COLLABORATOR → `triage.yml` (Re-Triage-Pfad, zweiter Trigger desselben
  Workflows seit M8). (Der einzige `@agent`-gesteuerte Trigger; die PR-Seite wird ausschließlich
  über Labels gesteuert, um Event-Kaskaden zu vermeiden.)
- **Push auf main** (`push` auf `main`, z. B. nach einem Merge) → `pr-conflict-scan.yml`
  (scannt alle offenen PRs auf Merge-Konflikte).
