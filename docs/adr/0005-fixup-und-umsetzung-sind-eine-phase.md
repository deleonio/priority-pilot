# ADR 0005 — Fixup und Umsetzung sind eine Phase (Pipeline auf 6 Phasen)

- **Status:** Accepted (2026-08-20)
- **Datum:** 2026-08-20
- **Kontext:** [ADR 0002](0002-pipeline-7-phasen-ux-vor-spec.md) (Phasenzahl), [ADR 0004](0004-analyse-getriebenes-routing.md) (führte diesen Punkt als _explizit nicht entschieden_), [ADR 0001](0001-github-workflows-bleiben-ungetestet.md) (Testbarkeit von Workflows)
- **Supersedes:** die Phasenzahl aus ADR 0002 (7 → 6). Die dortige Begründung für die _strikte
  Serialisierung_ und für _UX vor Spec_ bleibt unberührt.

## Kontext

Bis hierher schrieben ZWEI Workflows Code:

|                           | Trigger          | Objekt | Aufgabe                                                   |
| ------------------------- | ---------------- | ------ | --------------------------------------------------------- |
| `04-claude-implement.yml` | `ai:needs-impl`  | Issue  | Erstumsetzung                                             |
| `06-claude-pr-fixup.yml`  | `ai:needs-fixup` | PR     | Nacharbeit an Review-Findings, roter CI, Merge-Konflikten |

Beide taten dasselbe: Arbeitskopie herstellen, Code ändern, Tests grün bekommen, committen, an
den Review übergeben. Was sie unterschied, war der Einstieg — nicht die Arbeit.

Der Preis dieser Trennung war Duplikation an genau den Stellen, die man beim Ändern übersieht:

- **acht identische Setup-Schritte** (pnpm, Node, Install, lefthook, Playwright-Cache, Chromium,
  Server-Build, Inspect-Readiness) — Wort für Wort zweimal, inklusive Cache-Key und
  120-s-Schwelle;
- der Memory-Upload-Block mitsamt seiner langen Begründung, zweimal;
- der Fair-Usage-Check, zweimal;
- die Modellwahl-Verdrahtung samt Literal-Default, zweimal.

ADR 0004 hat diesen Umbau bewusst NICHT entschieden, mit der Begründung: er spart keine Token
und liegt laut ADR 0001 in einem ungetesteten Bereich. Diese Einschätzung gilt weiterhin — die
Entscheidung fällt hier trotzdem, und zwar aus Wartbarkeits-, nicht aus Kostengründen.

## Entscheidung

**Eine Phase „4/6 Umsetzung" mit zwei Eingängen**, in einer Workflow-Datei
(`04-claude-implement.yml`), unter EINER `concurrency`-Gruppe (`claude-implement`):

```
Issue + ai:needs-impl   →  Job `implement`  (Erstumsetzung)
PR    + ai:needs-fixup  →  Job `fixup`      (Nacharbeit)
```

Die Pipeline hat damit sechs Phasen: Analyse (01) — UX (02) — Spec (03) — Umsetzung (04) —
Review (05) — Dokumentation (06).

Vier Punkte gehören zur Entscheidung dazu:

**1. Zwei Jobs, nicht einer.** Die Eingänge unterscheiden sich in allem, was einen Job ausmacht:
Checkout-Ref (Merge-Ref vs. `head.ref`), Fork-Guard, Vor-Guards (Doppel-Run-Guard vs.
Target-Merge + Start-Konsum + Stop-Guard), Fortschrittsmessung (fertiger PR vs. HEAD-Bewegung)
und Ergebnis-Labels. In einen Job gepresst wäre jeder zweite Step ein `if` auf den Event-Typ.
Geteilt wird, was tatsächlich geteilt gehört: Datei, Concurrency-Gruppe, Precheck, Modellwahl.

**2. Das gemeinsame Setup wandert in eine Composite-Action** (`.github/actions/claude-workbench`).
Sonst stünden die acht Schritte zweimal in _derselben_ Datei — die Duplikation wäre nur näher
zusammengerückt, nicht beseitigt.

**3. Die Prompts bleiben getrennt.** `.claude/skills/ticket-implementation/CI.md` (Umsetzung,
neu ausgelagert aus dem
Inline-Heredoc) und `.claude/skills/ticket-implementation/FIXUP.md` (Fixup) liegen nebeneinander
im selben Skill-Verzeichnis, werden aber NICHT
zusammengeklebt. Ein gemeinsamer Prompt trüge in jedem Lauf die Anweisungen des jeweils anderen
Eingangs mit — das kostet Token in jedem einzelnen Lauf und widerspricht dem Ziel, das den
gesamten Umbau trägt. Die Ablage wird vereinheitlicht, der Inhalt nicht.

**4. `check-phase-label.sh` kennt zwei Eingänge derselben Phase**: `implement` (Issue,
`ai:needs-impl`) und `implement-pr` (PR, `ai:needs-fixup`). Der frühere Phasen-Name `fixup` ist
entfallen — er benannte einen Workflow, den es nicht mehr gibt. Ein Aufrufer, der beim Umbau
übersehen wurde, scheitert hart (`exit 2`), nicht still.

Das Label `ai:needs-fixup` **bleibt unverändert bestehen**. Es startet nur jetzt Phase 4 statt
einer eigenen Phase 6. Damit bleibt auch der ABSENT-Guard der Review-Phase („bei Doppel-Armung
gewinnt die Nacharbeit", PR #890) inhaltlich unangetastet — er ist weiterhin nötig, weil der
Review in einer eigenen Concurrency-Gruppe läuft und die gemeinsame Gruppe ihn nicht abdeckt.

## Begründung

- **Eine Stelle statt zwei.** Jeder Fix an der Arbeitsumgebung, am Memory-Transport oder an der
  Modellwahl wirkt ab jetzt für beide Eingänge. Der bisherige Zustand war eine stehende
  Einladung, nur die Hälfte zu ändern.
- **Kein zweiter Schreiber am selben Ticket.** Getrennte Gruppen erlaubten grundsätzlich, dass
  Umsetzung am Issue und Nacharbeit am zugehörigen PR gleichzeitig liefen. Der Doppel-Run-Guard
  fing das ab; jetzt ist es eine Invariante statt eines Guards, der greifen muss.
- **Die Phasenzahl stimmt wieder mit der Realität überein.** Namen wie `5/7 Review` bei sechs
  Phasen sind schlicht falsch — und die Zahl im Namen ist die einzige Stelle, an der ein Mensch
  die Pipeline-Länge abliest.

## Konsequenzen

**Erkauft:**

- **Der Durchsatz sinkt unter Last.** Umsetzung und Nacharbeit stapeln sich jetzt in EINER
  FIFO-Queue (`queue: max`). Wo vorher zwei Läufe parallel liefen, läuft jetzt einer nach dem
  anderen. Das ist der bewusst gezahlte Preis für Punkt 2 der Begründung.
- **Kein Token-Gewinn.** Beide Eingänge starten weiterhin je eine eigene Claude-Session; es wird
  kein Kontext geteilt. Wer hier Ersparnis erwartet, erwartet das Falsche.
- **Die Actions-Lauf-Historie des Documenters beginnt neu**, weil `07-claude-pr-documenter.yml`
  zu `06-claude-pr-documenter.yml` wurde. GitHub schlüsselt Workflows über den Dateipfad.

**Abgesichert:**

- Der Workflow-**Name** `5/6 Review` ist in `claude-pr-gate-merge.yml` hart verdrahtet
  (`workflow_run`-Allowlist + zwei jq-Filter). Ein Umbenennen ohne Nachziehen schaltet das
  Merge-Gate lautlos ab — kein roter Lauf, der PR bleibt einfach für immer liegen. Diese Gefahr
  war bisher nur ein Kommentar; sie ist jetzt ein Test
  (`.github/scripts/workflow-name-contract.test.ts`), der zusätzlich die lückenlose
  0..6-Nummerierung prüft.
- Beide Eingänge sind im Continue-Sweep einzeln registriert. Die Sweep-Tabelle war vorher über
  den Dateinamen geschlüsselt; unverändert übernommen wäre einer der beiden Eingänge still
  herausgefallen und klebende Trigger dort nie wieder aufgeweckt worden.

**Offen und ausdrücklich nicht behauptet:**

- **Nichts davon war bei der Entscheidung auf einem echten Runner erprobt.** Verifiziert waren
  Schema (action-validator), YAML-Syntax, die Skript-Tests und der neue Namensvertrag — nicht
  das Laufzeitverhalten. Das ist exakt die Lage, die ADR 0001 beschreibt, und sie galt hier für
  einen Umbau, der die code-schreibende Phase betrifft.

  > **Nachtrag 2026-08-20, nach dem Merge:** Beide Eingänge sind inzwischen produktiv gelaufen
  > und grün:
  >
  > - PR-Eingang — [Lauf 32333104609](https://github.com/deleonio/priority-pilot/actions/runs/32333104609)
  >   (`feat/issue-902-axe-core-e2e`): Job `fixup` grün über alle Steps, Job `implement` korrekt
  >   übersprungen. Damit ist auch der Start-Konsum belegt, der
  >   `check-phase-label.sh --phase implement-pr` aufruft — die Stelle, an der ein Branch mit
  >   altem Skript hätte scheitern können (der Target-Merge davor greift wie vorgesehen).
  > - Issue-Eingang — [Lauf 32347325911](https://github.com/deleonio/priority-pilot/actions/runs/32347325911):
  >   Job `implement` grün, Job `fixup` korrekt übersprungen.
  >
  > Die Composite-Action `claude-workbench` lief in beiden Jobs sauber. Die Event-Trennung, der
  > neue Phasenname und die ausgelagerte Arbeitsumgebung sind damit produktiv belegt.
  > Unverändert **nicht** belegt sind die selteneren Pfade: Fork-Guard, Stop-Guard,
  > Crash-Parken und der Merge-Konflikt-Zweig.
