# ADR 0010 — Issue-Storage: Phasen-Notizen reisen als Workflow-Artefakt

- **Status:** Accepted (2026-09-06) — ersetzt den Storage-Transport aus [ADR 0007](0007-issue-storage-harness-branch.md) (dort: committet im Harness-Branch); [ADR 0009](0009-issue-storage-harness-kommentar.md) (Phasen-Ausgaben im Harness-Kommentar) bleibt unberührt
- **Datum:** 2026-09-06
- **Kontext:** ADR 0006 (Verwerfung von Artefakt/Cache), ADR 0007 (Branch-Transport), `.github/actions/issue-state-save`, `setup-agent` Memory-Load

## Kontext

ADR 0007 ließ jede Phase ihren Issue-Storage (`.ai-memory/issue-{N}-{phase}.md`) als Commit auf
den Harness-Branch `ai/harness/{N}` reisen. Nach einem vollen Betriebsmonat zeigen sich drei
reale Störfaktoren, die das Konzept „Notizen committen" selbst betreffen — nicht seine
Einzelimplementation:

1. **Der Review-Save-Commit landet auf dem PR-Branch** und löst pro Review-/Fixup-Runde einen
   kompletten CI-Neustart (Synchronize) für eine reine Notiz-Änderung aus — Runner-Zeit, und das
   workflow_run-basierte Gate wertet einen CI-Lauf aus, der nichts am Code ändert.
2. **main accumuliert Notiz-Dateien:** ~300 `issue-*.md` liegen im Baum, jede PR-Squash bringt
   neue dazu; `git log`/Baum werden zur Hälfte von Transport-Rauschen dominiert.
3. **Wartungslast der Commit-Mechanik:** Temp-Index-Plumbing, Re-Parenting-Retry bei non-FF,
   Branch-Neuanlage durch Triage/UX (auch für Tickets, die nach der Analyse sterben),
   Documenter-Klonbranch nach `delete_branch_on_merge`, Sonderfälle im Kopf der Action.

Die zentrale Beobachtung: **Der Transport braucht keine Git-Eigenschaften.** Gelesen wird
ausschließlich der aktuelle Dateizustand (`render-memory-context.sh` rendert die restaurierten
Notizen in den Prompt); niemand liest die Commit-Historie der Notizen. Versionierung, Unbefristetheit
und Merge-Fähigkeit — die eigentlichen Argumente für den Branch in ADR 0006/0007 — sind für diesen
Zweig des Storages totes Kapital, das nur noch Kosten verursacht.

## Entscheidung

**Phasen-Notizen reisen als Workflow-Artefakt, nicht als Commit.** Der Harness-Branch
`ai/harness/{N}` bleibt als Arbeits-/PR-Branch ab der Spec-Phase bestehen (dort gehören Commits
hin: Tests, Code, Spec-Doku, `MEMORY.md`) — aber kein Storage-Commit mehr am Phasen-Ende.

Vier Punkte gehören zur Entscheidung:

**1. Upload am Phasen-Ende (`issue-state-save`, umgebaut).** Die Composite-Action lädt die volle
Notizenmenge des Workspaces (restaurierte + eigene neue) als `ai-memory-issue-<N>-<phase>-<run>`
hoch — Standard-Retention 90 Tage, wie die Kosten-Artefakte (`claude-costs-*`). Das neueste
Artefakt ist in sich vollständig; kein Merge über mehrere Artefakte nötig. Der sha256-Diff gegen
eine Load-Baseline liefert `new-notes` (die Documenter-Post-Assertion #1010 AK2 bleibt funktional).

**2. Restore am Laufbeginn (`setup-agent`, Memory-Load).** Liste der nicht-abgelaufenen Artefakte
mit Prefix `ai-memory-issue-<N>-` per API, neuestes nach `created_at`, entpacken nach `.ai-memory/`.
Der read-seitige Vertrag ändert sich nicht: gleiche Dateien, gleicher Pfad, derselbe
Prompt-Block aus `render-memory-context.sh`. **Übergangs-Fallback:** fehlt ein Artefakt, wird
einmalig der alte Branch-Stand (`ai/harness/{N}`, dann `ai/state/issue-{N}`) restauriert —
mid-Pipeline-Tickets aus der ADR-0007-Ära laufen damit verlustfrei durch. Der Fallback entfällt,
sobald kein vor-0010-Ticket mehr in der Pipeline ist.

**3. Warum Artefakt und nicht `actions/cache`** (Antwort auf die naheliegende Frage „wir cachen
doch auch Claude/pi/pnpm"): Cache-Writes sind für Issue-/Label-/PR-Trigger und daraus kaskadierte
`workflow_run`-Läufe platformseitig auf read-only Tokens begrenzt (belegt durch gescheiterte
Läufe des früheren `claude-memory-save.yml`, s. ADR 0006) — genau die Trigger, auf denen die
Pipeline läuft. Artefakte haben diese Sperre nicht, sind repo-weit über die API lesbar (Muster:
`seal-costs.sh` lädt Kosten-Artefakte cross-Run) und haben eine definierte Retention statt
LRU-Verdrängung.

**4. Notizen wieder gitignored.** `.gitignore` nimmt `.ai-memory/issue-*.md` wieder auf;
`MEMORY.md` bleibt versioniert. Die bisher committeten Notizen (~300 Dateien) werden einmalig aus
dem Baum entfernt — die Historie behält sie. Prompt-/Skill-Anweisungen („Notiz im selben Commit")
entfallen; die Notiz bleibt reine Workspace-Datei, deren Transport der Workflow übernimmt.

## Neubewertung der ADR-0006-Verdikte

| ADR-0006-Einwand                        | Heute                                                                                                                                  |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Retention-Abwägung (14 Tage Kompromiss) | 90-Tage-Standard-Retention ist seit Monaten für `claude-costs-*` im Betrieb; Notizen sind KB-groß, Ticket-Lebenszyklus ≪ 90 Tage.      |
| „ohne Historie"                         | Historie war nur für den Branch-Transport ein Argument; kein Leser der Notizen liest Historie. Das Phasen-Protokoll bleibt im Run-Log. |
| Cache read-only-Tokens                  | Weiterhin gültig — genau deshalb Artefakt, nicht Cache.                                                                                |

## Konsequenzen

**Entfallen:** Review-Save-Commit auf dem PR-Branch (→ keine CI-Restarts für Notizen, der
Stop-Guard zählt nur noch echte Arbeits-Commits), Branch-Anlage durch Triage/UX für Tickets ohne
Spec-Phase (→ weniger Orphan-Branches für den Sweep), Documenter-Klonbranch, Temp-Index- und
Re-Parenting-Mechanik, Notiz-Dateien in PR-Diffs und in `main`.

**Gewinnen:** Der Documenter sieht erstmals die Vor-Phasen-Notizen (der Branch wurde beim Merge
gelöscht; Artefakte überleben ihn); PR-Diffs enthalten nur noch Arbeit; `git log` auf PR-Branches
zählt nur Arbeits-Commits.

**Bewusst in Kauf genommen:** Notizen sind nach 90 Tagen weg (Resume-Kontext, kein Archiv — das
dauerhafte „Warum" eines Tickets lebt in Spec-Doku, PR-Beschreibung und `MEMORY.md`, nicht in
Checkpoint-Notizen); Last-Wins ohne Historie (Reader nutzen ohnehin nur den aktuellen Stand);
Artefakt-Liste je Lauf ein API-Call (paginiert, wie `seal-costs.sh`).

**Offen:** Abbau des Übergangs-Fallbacks (Branch-Restore im Memory-Load), sobald die letzte
mid-Pipeline aus der 0007-Ära durch ist — kleiner Folge-PR, kein Datum, kein Scheduler.
