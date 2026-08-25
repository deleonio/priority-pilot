# ADR 0006 — Issue-Storage: ein State-Branch pro Issue (statt Artefakt und Cache)

- **Status:** Accepted (2026-08-23) — umgesetzt am 2026-08-23 (`issue-state-save`-Action,
  Memory-Load via `git fetch`/`git restore`, Documenter-Teardown + Hygiene-Sweep).
  Laufzeit-Verifikation am ersten vollständigen Ticket steht aus
  ([ADR 0001](0001-github-workflows-bleiben-ungetestet.md)).
- **Datum:** 2026-08-23
- **Kontext:** [ADR 0001](0001-github-workflows-bleiben-ungetestet.md) (ungetestete Workflows),
  [ADR 0005](0005-fixup-und-umsetzung-sind-eine-phase.md) (eine Umsetzungsphase, zwei Eingänge)

## Kontext

Die Label-getriebene Pipeline trägt Zustand pro Issue über sechs Workflows hinweg (Triage → UX →
Spec → Umsetzung → Review → Documenter): Phasen-Notizen für den Soft-Abort-Resume, optional
Session-Kontext für `ai:continued`-Folgelläufe. Anforderung: **ein einziger, durchgehender Storage
pro Issue-Nummer**, den jede Phase liest und schreibt — nicht ein Transportmittel pro Schicht.

Drei Kandidaten standen im Raum:

| Kandidat                 | Verdict                                                                                                                                                                                                                                                                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GitHub Actions-Cache** | ❌ Für Issue-/Label-/PR-Trigger **und** daraus kaskadierte `workflow_run`-Läufe vergibt GitHub nur **read-only Cache-Token** (Richtlinie 2026-06-26). Der frühere Companion-Workflow `claude-memory-save.yml` scheiterte in jedem Lauf still mit „cache write denied". Restore-only nützt nichts, wenn kein Save möglich ist. |
| **Workflow-Artefakte**   | ⚠️ Funktional, aber befristet (Retention-Tuning zwischen Ticket-Lebenszyklus und Storage-Quote), ohne Historie (jede Phase erzeugt ein neues Artefakt desselben Namens) und ohne Versionsstand: nur der letzte Stand, nicht wie er entstand.                                                                                  |
| **Git-Branch**           | ✅ Unbefristet, versioniert, repo-intern sichtbar; Push via App-Token ist in der Pipeline längst Alltag (Umsetzung, Spec-Sync, Guide-Sync).                                                                                                                                                                                   |

Zwei Randbedingungen machen den Branch gefahrlos: `ci.yml` und `deploy.yml` triggern ausschließlich
auf `push: branches: [main]` — ein State-Branch feuert also weder CI noch Deploy. Und die Branch-
Namen sind maschinell vorhersagbar (`ai/state/issue-{N}`), sodass Restore, Teardown und
Verwaisungs-Sweep deterministisch arbeiten können.

## Entscheidung

**Ein State-Branch `ai/state/issue-{N}` ist der Issue-Storage.** Er löst das Artefakt
`claude-memory-issue-{N}` vollständig ab und wird **nie gemergt**. Inhalt:

```
ai/state/issue-{N}              (eigene Wurzel — orphan; enthält NUR die Storage-Pfade)
├── .ai-memory/issue-*.md       # Phasen-Notizen (Claude schreibt nativ dorthin)
├── .ai-memory/state.json       # Phase → { sessionId, runId, branch, timestamp }
└── .claude/sessions/           # [Stufe 2] Session-JSONLs, gefiltert (s. u.)
```

Die **eigene Wurzel** ist bewusst: Der Branch teilt keine Historie mit `main` und trägt keine
Repo-Dateien — nur die Storage-Pfade. Damit ist `MEMORY.md` (in `main` eingecheckt) **strukturell**
außerhalb, nicht nur per Exclude-Regel.

**Der Memory liegt in `.ai-memory/` und nicht unter `.claude/`** (Korrektur vom 2026-08-25).
Claude Code sperrt alles unterhalb von `.claude/` als „sensitive file", und zwar **bevor** die
`--allowedTools`-Allowlist ausgewertet wird — eine `Edit(path)`-Allow-Regel kann die Sperre nicht
wieder öffnen. Im alten Layout `.claude/memory/` konnten deshalb ausgerechnet die Phasen mit
`tools-tier` `restricted`/`review` (Triage, UX, Review, Documenter) ihre Phasen-Notiz **nie**
schreiben; Write-Tool und Bash-Heredoc wurden beide abgelehnt (Runs `32747085777`, `32741816829`).
Durchgekommen sind nur die `full`-Phasen, weil `--dangerously-skip-permissions` die Prüfung
überspringt — von sechs Übergaben je Ticket funktionierte damit genau eine (Spec → Umsetzung).

Acht Punkte gehören zur Entscheidung:

**1. Stufe 1 ohne Sessions, Stufe 2 evidence-gated.** Committet werden zunächst nur Phasen-Notizen
und `state.json` (~KB). Session-JSONLs sind MB-schwer (Playwright-Screenshots als Base64) und
bleiben **für immer in der Objekt-Historie**, auch nach Branch-Löschung — deshalb kommt
`.claude/sessions/` nur dazu, wenn `ai:continued`-Resumes messbar Wiederarbeit erzeugen
(`record-cost`/Kosten-Baseline), und dann gefiltert: nur die **jüngste Session je Phase**, harte
Obergrenze **~5 MB pro Ticket** — bei Überschreitung automatisch auf Stufe 1 degradieren.
`state.json` trägt die Session-ID bereits jetzt als Manifest-Eintrag, damit Stufe 2 den Save-Step
nicht ändern muss.

**2. `--resume` nur intra-Phase.** Ein Session-Resume ist ausschließlich beim `ai:continued`-
Folgelauf **derselben Phase** erlaubt (Soft-Abort-Selbstretrigger: gleicher Task, Minuten später).
Phasenübergreifend bleibt das kuratierte Memory der Kanal — ein Spec-Transkript in der Umsetzung
wäre teurer, veralteter Ballast als die Phasen-Notizen.

**3. Fetch-then-commit, kein Force-Push.** Der Save-Step (Composite-Action `issue-state-save`,
Temp-Index — der Workspace-Index bleibt unberührt, Storage-Dateien können nie in ein Phasen-Commit
des Agenten rutschen) fetcht den Branch-Stand, schreibt den neuen Zustand als Commit darauf und
pushed mit App-Token (origin ist dafür von `setup-claude` bereits auf das App-Token umgestellt).
Ein blindes Force-Push würde einem versetzt laufenden Continue-Sweep den Zustand zertrampeln; bei
non-FF wird dreimal frisch gefetcht und der Baum auf den neuen HEAD re-parentet.

**4. `MEMORY.md` bleibt außen vor.** Das Dauergedächtnis ist eingecheckt und reist in den
normalen Phasen-Commits — es kommt nie in den State-Branch (durch die orphan-Wurzel plus
Exclude im Restore), sonst überschriebe ein alter Stand die frisch committete Datei.

**5. Restore fail-open.** Fehlt der Branch (Erst-Triage) oder ist er leer, startet die Phase frisch
— Notice statt Fehler, wie zuvor beim Artefakt-Miss. Die `expect-memory`-Warnung ab Phase 2 bleibt
bestehen.

**6. Abbau nur durch den Hygiene-Sweep.** _(Geändert 2026-08-25 — vorher löschte der
Documenter den Branch am Ticket-Ende.)_ Der Sweep in `cache-cleanup.yml` entfernt
`ai/state/issue-*`-Branches, deren Issue GESCHLOSSEN ist und deren letzter Commit älter als
7 Tage ist. Das ist ab sofort der einzige Abbau-Pfad. Grund für die Änderung: Der Documenter
schreibt seit 2026-08-25 selbst eine Phasen-Notiz — den Speicher im selben Lauf anzulegen und
wegzuräumen ist widersprüchlich. Und ein Ticket ist mit dem Merge nicht zwingend erledigt:
Re-Open, Nachtrags-PR oder ein Documenter-Re-Run fänden nach dem Löschen nichts mehr vor.
Das 7-Tage-Fenster deckt Nacharbeit ab, und es räumt genau eine Stelle auf statt zweier.

**7. Der Vor-Phasen-Kontext wird in den Prompt einmontiert, nicht angefragt.**
_(Neu 2026-08-25.)_ `render-memory-context.sh` rendert die restaurierten Phasen-Notizen als
Block direkt in `/tmp/claude-prompt.txt`, chronologisch nach Pipeline-Reihenfolge, mit Deckel
(48 000 Zeichen gesamt, 12 000 je Datei). Vorher lag der Memory zwar im Workspace, gelesen wurde
er aber nur, WEIL `memory-read.md` darum bat — das hing an Gehorsam. Damit ist „initial laden"
eine Eigenschaft des Prompt-Baus, keine Bitte an das Modell. Die Dateien bleiben zusätzlich auf
Platte, falls der Agent das Original braucht.

**8. Jede Phase speichert, ohne Ausnahme.** _(Geändert 2026-08-25 — der Documenter war vorher
als terminale Phase vom Schreiben ausgenommen.)_ Auch die letzte Phase legt ihren Checkpoint an,
damit ein Re-Run nach Teilerfolg nicht bei null beginnt.

Helper-Workflows (spec-sync, guide-sync, cost-baseline, Sweeps) bleiben bewusst **stateless** und
greifen nicht auf Issue-Storages zu.

## Begründung

- **Ein Storage statt zweier Systeme.** Zuvor war der Zustand auf Artefakt (Phasen-Notizen) und
  reguläre Commits (`MEMORY.md`) verteilt; der Branch zentralisiert den flüchtigen Anteil an einem
  adressierbaren Ort — `git log` auf dem Branch ist das Phasen-Protokoll des Tickets.
- **Kein Ablaufen, keine Retention-Abwägung.** Die 14-Tage-Retention war ein Kompromiss zwischen
  Ticket-Lebenszyklus und Storage-Quote; ein Branch hat dieses Dilemma nicht.
- **Cache ist kein Kandidat.** Die read-only-Cache-Token-Restriktion ist platformseitig, hängt am
  Trust-Level des Triggers und ist durch gescheiterte Läufe belegt — nicht durch Konfiguration
  heilbar.

## Konsequenzen

**Erkauft:**

- **Repo-Wachstum durch Sessions** — der Preis von Stufe 2 und der Grund, warum sie nicht default
  ist. Die Objekt-Historie behält gelöschte Inhalte; der 5-MB-Cap begrenzt, verhindert aber kein
  Wachstum über viele Tickets. Stufe 1 kostet praktisch nichts (~KB je Phase).
- **Ein Branch mehr pro Ticket im Repo** (`git branch -a`-Rauschen). Teardown + Sweep halten das
  begrenzt.
- **Umstellung ohne Mischbetrieb:** Tickets, die zum Merge-Zeitpunkt mid-pipeline stehen, verlieren
  ihre Phasen-Notizen und starten die betroffene Phase mit leerem Resume-Kontext (fail-open).
  Alt-Artefakte `claude-memory-issue-{N}` laufen über ihre 14-Tage-Retention selbst ab.

**Abgesichert:**

- Kein CI-/Deploy-Trigger: beide Workflows hören nur auf `push: [main]` — ein Versehen am Branch
  feuert nichts. Ein versehentlicher Merge müsste manuell erfolgen.
- Storage-Dateien erreichen den Workspace-Index nie: Restore per `git restore` (ohne `--staged`),
  Save per Temp-Index, `.gitignore` hält `.ai-memory/state.json` zusätzlich zurück.

**Offen und ausdrücklich nicht behauptet:**

- **Nichts davon lief auf einem echten Runner.** Wie bei ADR 0005 gilt ADR 0001: verifiziert wird
  die Umstellung erst produktiv (ein volles Ticket von der Triage bis zum Teardown); der Nachtrag
  folgt nach dem Merge.
