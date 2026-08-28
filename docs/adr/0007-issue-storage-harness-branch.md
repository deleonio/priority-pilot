# ADR 0007 — Issue-Storage reist im Harness-Branch mit (Memory wird committet)

- **Status:** Accepted (2026-08-28) — ersetzt [ADR 0006](0006-issue-storage-state-branch.md)
- **Datum:** 2026-08-28
- **Kontext:** ADR 0006 ([State-Branch](0006-issue-storage-state-branch.md)), ADR 0005 (eine Umsetzungsphase)

## Kontext

ADR 0006 legte den Issue-Storage auf einen eigenen, **nie gemergten** State-Branch
`ai/state/issue-{N}`. Das löste den Transport, hatte aber eine strukturelle Schwäche:
Die Phasen-Notizen (Triage-Analyse, UX-Entscheidungen, Spec-Vertrag, Implementierungs-
Stand, Review-Befunde) **verfallen mit dem Branch**. Der Hygiene-Sweep löscht ihn 7 Tage
nach Issue-Schließung — das Wissen über _warum_ ein Ticket so umgesetzt wurde, ging
verloren, obwohl es beim nächsten, ähnlichen Ticket Gold wert wäre (`.ai-memory/MEMORY.md`
speichert nur einzeilige Learnings, nicht die Entscheidungsketten).

Dazu kam ein zweiter Transport-Ort: Ab der Spec-Phase existierte ein **zweiter** Branch
(`feat/issue-{N}-<slug>`) für Code und PR. Derselbe Ticket-Kontext lebte also auf zwei
Branches mit unterschiedlichen Lebenszyklen.

Die Änderungsidee (Issue-Autor, 28.08.): **ein Branch pro Ticket von Phase 1 an**, der
Memory UND Code trägt — und die konsequenteste Form davon: Die Phasen-Notizen gar nicht
mehr gitignorieren, sondern sie schlicht mitcommitten.

## Entscheidung

**Ein Harness-Branch `ai/harness/{N}` pro Ticket ist Arbeits-Branch, Memory-Storage und
PR-Branch zugleich.** Die Phasen-Notizen sind committeter Repo-Inhalt und reisen mit dem
PR-Merge dauerhaft nach `main`.

Sieben Punkte gehören zur Entscheidung:

**1. Memory wird committet, nicht ignoriert.** `.gitignore` gibt `.ai-memory/issue-*.md`
frei (vorher: flüchtig/gitignored). Triage und UX committieren weiterhin nichts selbst —
für sie legt bzw. fortschreibt der `issue-state-save`-Step den Branch (Temp-Index, der
Workspace-HEAD bleibt unberührt; Erst-Anlage auf Basis `origin/main`, **kein orphan**
mehr — der Branch muss auf `main` aufsetzen, um PR-Head zu werden). Ab der Spec-Phase
committet der Agent seine Phasen-Notiz **selbst mit** in seine regulären Commits; der
Save-Step bleibt als Sicherheitsnetz und wird per Blob-Diff idempotent (bereits committete
Notizen erzeugen keinen Zweit-Commit).

**2. Spec/Impl arbeiten auf dem Harness-Branch.** Der Spec-Prompt checkt
`ai/harness/{N}` aus (statt `feat/issue-{N}-<slug>` neu anzulegen) und committiert Notiz +
rote Tests gemeinsam; der Draft-PR entsteht vom Harness-Branch. Der Implement-Prompt
folgt (Spec Mode: PR-Branch auschecken = Harness-Branch; Direct Mode: Harness-Branch
selbst anlegen). Die Prompt-Snippets und die Skills (ticket-spec, ticket-implementation)
sind entsprechend angepasst.

**3. `state.json` entfällt.** Das Manifest (Phase → sessionId/runId/branch) hatte keinen
Konsumenten (der Continue-Sweep liest es nicht; Stufe 2/Sessions ist nicht aktiv) und wäre
beim Merge als Ticket-Manifest in `main` gelandet. Das Commit-Log des Branches ist das
Phasen-Protokoll (`memory: <phase> (run …)`); braucht Stufe 2 später eine Session-ID,
wird sie neu und außerhalb des Merge-Pfads gespeichert.

**4. Memory-Load mit Legacy-Fallback.** `setup-claude` restoret zuerst `ai/harness/{N}`,
dann den alten `ai/state/issue-{N}` (Bestand vor der Umstellung), sonst fail-open leer.
Mid-Pipeline-Tickets migrieren implizit: Ihre nächste Phase schreibt auf den
Harness-Branch (der Load ließt noch den alten Stand); bereits offene Draft-PRs auf
`feat/*`-Branches werden vom Spec-Wiederverwendungs-Pfad weitergeführt.

**5. Zwei bekannte Silo-Fälle bleiben bewusst.** PRs ohne Closing-Issue (Key = PR-Nummer)
und fremde PR-Branches: Der Save schreibt dort auf `ai/harness/{PR}` — ein separates,
nicht mit dem PR reisendes Silo (identische Semantik zum ADR-0006-Fall, kein Schreiben
auf fremde Branches). Der PR-ohne-Issue-Fall bleibt die dokumentierte Ausnahme mit Warning.

**6. Review-Phase schreibt auf den PR-Branch.** Bei Issue-getriebenen Tickets IST der
PR-Head der Harness-Branch — der Review-Save-Commit landet also im PR und reist mit.
Der Commit feuert einen PR-Synchronize-Event; `pr-needs-review-label` filtert
Bot-Akteure explizit (kein Label-Loop), `ci.yml` läuft als normaler PR-CI über die
Memory-Änderung (`.prettierignore` nimmt `.ai-memory/` aus).

**7. Abbau.** `delete_branch_on_merge` (Repo-Fakt) löscht den Harness-Branch beim Merge —
der Memory ist da schon in `main`. Der Hygiene-Sweep in `cache-cleanup.yml` fängt Verwaiste
(abgebrochene Tickets, nie gemergt) mit derselben Regel wie zuvor: Issue/PR geschlossen und
letzter Commit älter als 7 Tage. Der Sweep läuft über beide Prefixe (`ai/state/`, `ai/harness/`).

## Begründung

- **Ein Transport-Ort statt zweier.** Memory und Code leben auf demselben Branch mit
  derselben Historie; `git log` auf dem gemergten PR zeigt Entscheidungskette UND Umsetzung.
- **Wissen wird dauerhaft.** Die Phasen-Notizen sind nach dem Merge in `main` nachlesbar —
  das „Warum" eines Tickets überlebt das Ticket. Kosten: ~1–5 KB je Ticket, ignorable.
- **Weniger Mechanik.** Kein gitignore-Sonderweg für Storage-Dateien (Update-index-Trick
  entfällt für die Notizen), keine orphan-Wurzel, kein `MEMORY.md`-Exclude-Konflikt auf
  dem Branch — der Exclude im Restore bleibt als Schutz, ist aber strukturell entschärft.
- **Muster-treu:** PR-Branch, Draft-Wiederverwendung, Label-Kette und Soft-Abort-Resume
  bleiben unangetastet; nur der Branch-Name und das Commit-Verhalten ändern sich.

## Konsequenzen

**Erkauft:**

- **Branch-Anlage ab Phase 1:** Auch Tickets, die nach der Triage sterben (🔴/🟡, kein
  Spec), hinterlassen einen `ai/harness/{N}`-Branch — der Sweep räumt ihn nach Schließung
  - 7 Tagen ab.
- **PR-Diffs enthalten Memory-Dateien.** Reviewer sehen Phasen-Notizen im Diff (Feature,
  nicht Bug: Entscheidungen werden reviewbar); wer sie ignorieren will, filtert den Pfad.
- **Merge-Konflikte bei parallelen Notizen** sind theoretisch möglich (zwei Läufe
  committeten dieselbe Notiz), praktisch durch die Phasen-Serialisierung
  (Concurrency-Gruppe je Issue) ausgeschlossen.

**Abgesichert:**

- Kein CI-/Deploy-Trigger vom Branch: `ci.yml`/`deploy.yml` hören auf `push: [main]`;
  PR-Synchronize-Events vom Save-Commit laufen durch die etablierten Bot-Filter.
- Kein Doppelspeichern: Blob-Diff hält den Save-Step idempotent; die eigene
  Phasen-Notiz-Prüfung warnt weiterhin, wenn eine Phase gar keinen Checkpoint schrieb.
- Agenten-Commits können Storage-Dateien nicht „versehentlich" einschleusen — sie sollen
  es jetzt bewusst tun (Prompt-Instruktion); ein Vergessen fängt der Save-Step ab.
- Der Save-Step committet nur Phasen-Notizen (`issue-{N}-<phase>.md`), nicht die
  Body-/PR-Roundtrip-Fragmente (`-body.md`, `-block.md`, `-pr-body*.md`), die Phasen als
  Write-Workaround anlegen — sie verfallen mit dem Runner.

**Bekannte Kanten, bewusst in Kauf genommen:**

- **Documenter-Klon:** Der Documenter läuft nach dem Merge — der Harness-Branch wurde von
  `delete_branch_on_merge` bereits gelöscht. Sein Save-Step legt `ai/harness/{N}` neu auf
  Basis von `origin/main` an (voller main-Baum + Documenter-Notiz); der Sweep räumt nach
  7 Tagen. Kein zweiter Mechanismus für eine einmalige Notiz.
- **Restore-Fallback-Kante:** Scheitert der Restore von `ai/harness/{N}` kontrollechnisch
  (defekter Branch) und greift der Legacy-Fallback mit abweichendem Stand, kann der
  `git switch` des Spec-Agenten auf untracked Dateien abbrechen. Die git-Fehlermeldung ist
  eindeutig; der Agent löst das lokal (Dateien entfernen, erneut restaurieren).

**Offen und ausdrücklich nicht behauptet:**

- Wie bei ADR 0001 bleiben die Workflows ungetestet bis zum ersten echten Lauf; der
  Nachweis folgt mit dem ersten Ticket, das den neuen Weg komplett durchläuft.
