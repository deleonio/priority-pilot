# Phasen-Notizen wohnen im Harness-Kommentar — keine Memory-Commits mehr

## Zusammenfassung

Die `memory: <phase>`-Commits am Ende jeder Phase entfallen vollständig. Phasen-Notizen (`.ai-memory/issue-{N}-{phase}.md`, Inhalt unverändert: die 7 Abschnitte Erledigt/Fallstricke/…) reisen künftig als markierte Abschnitte im Harness-Kommentar (`<!-- ai-harness -->`, ADR 0009) statt als Commits auf `ai/harness/{N}`. Effekte: kein CI-Neustart pro Review-/Fixup-Runde (Review schreibt nie mehr auf den PR-Branch), keine Documenter-Branch-Neuanlage nach Merge, keine `.ai-memory/issue-*.md`-Ablagerungen mehr in main, deutlich weniger Save-Mechanik (Temp-Index/Re-Parenting/Retries entfallen). `chore(release)`/`chore(costs)` auf main bleiben unberührt (Out of scope).

## Verhalten ändert sich

**1. Schreiben (Workflow-Seite, deterministisch):**

- Action `.github/actions/issue-state-save/` wird zu `issue-memory-sync` umgebaut (gleiche 7 Aufrufstellen: 01/02/03/04×2/05/06; Inputs `issue-number`, `phase` identisch, Umbenennung + neue Implementierung).
- Statt Fetch-then-Commit auf den Branch: liest `.ai-memory/issue-{N}-{phase}.md` aus dem Workspace und upsertet NUR den eigenen Abschnitt per Read-Modify-Write in den Harness-Kommentar (Kommentar-Body per REST laden, eigenen Abschnitt ersetzen, per `PATCH /issues/{n}/comments/{id}` zurückschreiben; existiert kein Marker-Kommentar, per POST anlegen). App-Token wie bisher.
- Abschnittsformat (ASCII, maschinenlesbar): `<!-- ai-memory-{phase}:START -->` … `<!-- ai-memory-{phase}:END -->` mit dem Notiz-Inhalt dazwischen, Phase ∈ triage|ux|spec|implement|fixup|review|documenter.
- Deckel: Abschnitt > 10.000 Zeichen wird sichtbar gekappt (Render-Limit liest eh nur 8k/Datei, 20k gesamt — Kommentar bleibt unter 64k-Grenze).
- Output `new-notes` bleibt semantisch erhalten (1 = eigener Abschnitt neu/geändert) — die Notiz-Post-Assertion in `06-document.yml:303` funktioniert weiter.
- Fehlerverhalten wie heute: Upsert-Fehlschlag = sichtbarer `::error` + Job rot (kein stiller Speicher-Schein).

**2. Lesen (setup-agent):**

- `memory-load`-Step: statt `git restore` vom Branch → Harness-Kommentar per `harness-comment.sh` holen, alle `ai-memory-{phase}`-Abschnitte in Phasen-Reihenfolge extrahieren und als `.ai-memory/issue-{N}-{phase}.md` **unter unveränderten Dateinamen** in den Workspace materialisieren. `render-memory-context.sh` und `memory-read.md` bleiben byteidentisch — der Agenten-Vertrag (Dateien + Prompt-Block „KONTEXT AUS DEN VORHERIGEN PHASEN") ändert sich nicht.
- `memory-verify`/`expect-memory`-Warnung: Logik unverändert (zählt materialisierte `issue-*.md`).
- PR-ohne-Closing-Issue-Fallback (`ISSUE_NR` = PR-Nummer): Kommentar wird von/über `repos/{repo}/issues/{pr}/comments` gelesen/geschrieben (= PR-Konversation) — Silo-Semantik bleibt, ist aber wenigstens sichtbar am PR.

**3. Branches:**

- Triage/UX legen keinen Branch mehr an; Review/Documenter committen nichts mehr.
- Spec legt `ai/harness/{N}` selbst an, falls nicht vorhanden (Prompt/Skill beherrschen Create-vs-Checkout bereits — prüfen, dass keine Vor-Existenz angenommen wird; Implement-Direct-Mode legt ohnehin selbst an). Draft-Re-Use- und Doppel-Run-Guard-Pfade unberührt.
- `cron.cache-cleanup.yml`-Sweep bleibt (räumt Spec-or-later-Waisen); die Documenter-Klonbranches laufen aus.

**4. Agenten-Instruktionen & Repo-Hygiene:**

- `memory-write.md`: unverändert (lokale Datei an Checkpoints schreiben — der Sync-Step transportiert am Lauf-Ende, wie bisher der Save-Step).
- Spec/Impl committen die Notiz nicht mehr mit: Anweisungen aus `.github/prompts/spec.md`/`implement.md`, `ticket-spec`/`ticket-implementation` SKILLs und AGENTS.md-Memory-Absatz streichen; AGENTS.md-Tabelle: „reist im Harness-Kommentar".
- `.gitignore`: `.ai-memory/issue-*.md` wieder ignorieren (`MEMORY.md` bleibt versioniert); einmaliger Cleanup-Commit entfernt bereits nach main gemergte `issue-*.md` aus dem Baum (Historie behält sie).
- ADR neu (0010 „Phasen-Notizen wohnen im Harness-Kommentar"), 0007-Status → teilweise superseded (Branch-als-Arbeits-Branch bleibt), 0009-Tabelle um KI-MEMORY-Abschnitte erweitert; `docs/ci-architecture.md`, `docs/pipeline-flow.md` synchronisieren; Knowledge-Graph-Index aktualisieren.

## Randfälle

- **Mid-Pipeline-Tickets** (Notizen nur auf dem Branch, nicht im Kommentar): transitionaler Fallback im `memory-load` — liefert der Kommentar keine Memory-Abschnitte, greift der bestehende Branch-Restore (`ai/harness/{N}`, dann Legacy `ai/state/`). Im ADR als Übergang dokumentiert; Entfernungs-PR folgt, sobald keine offenen Tickets mehr auf dem alten Weg sind.
- **Konkurrierende Schreiber:** Phasen sind je Issue serialisiert (Concurrency-Gruppen); Read-Modify-Write fremder Abschnitte bleibt bytegleich (Upsert-Muster wie KI-ANALYSE).
- **Soft-Abort/Resume:** unverändert stark — Follow-up-Lauf materialisiert den eigenen Phasen-Abschnitt als Datei und lädt ihn in den Prompt. Runner-Tod verliert wie heute den nicht finalisierten Checkpoint.
- **Stop-Guard (>10 PR-Commits):** zählt künftig nur echte Arbeits-Commits — Memory-Commits blähen ihn nicht mehr auf.

## Tests & Abnahme

- Fixture-Tests (Muster `harness-comment.test.ts`, gh-Stubs): Abschnitts-Extraktion (Reihenfolge, mehrere Phasen, fehlende Marker), Upsert ersetzt nur den eigenen Abschnitt byte-exakt, Neuanlage bei fehlendem Kommentar, 10k-Deckel, `new-notes`-Zählung. Keine Workflow-Tests (ADR 0001).
- Abnahme am nächsten echten Ticket: kein `memory:`-Commit auf irgendeinem Branch; Review hinterlässt keinen PR-Commit/keinen CI-Re-Run; Triage-🟡-Ticket erzeugt keinen Branch; Resume liest Kommentar-Abschnitte; `chore(release)`/`chore(costs)` unverändert.
- `pnpm format`, `pnpm lint`, `pnpm test` grün, Ergebnisse in die PR-Beschreibung.

## Annahmen (niedrigriskante Defaults)

- Übergangs-Fallback für Mid-Pipeline-Tickets bleibt bis zur Ausdünnung aktiv (Entfernung als eigener Folgeweg im ADR vermerkt).
- Der einmalige main-Cleanup (git rm der bereits gemergten Notizen) ist Teil des Rollout-PRs — deckt den genannten Historien-Noise ohne Anfassen von release/costs.
- Alles in einem PR; Call-Site-Umbenennung der Action per Rename + 7 Stellen in einem Rutsch.
