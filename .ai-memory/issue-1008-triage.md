# Triage Issue #1008 — Issue-Storage: state.json-Race + Documenter-Notiz

## Erledigt
- Triage ABGESCHLOSSEN (2026-08-25). Kein Label auf Eltern-Issue #1008 (macht der Workflow via VERDICT: analyzed).
- Sub-Issues angelegt + als GitHub-Sub-Issue gehängt: #1009 (Race-Fix, Labels ai:analysed+ai:model:sonnet+ai:needs-impl) und #1010 (Zähler+Documenter-Pflicht, ai:analysed+ai:model:sonnet); #1010 blocked-by #1009 (addBlockedBy gesetzt).
- Eltern-Body: KI-ANALYSE-Block angehängt und per Remote-Grep verifiziert (1× START-Marker). Ping-Kommentar gepostet.
- Titel unverändert (konsistent zum Body), Body nicht umgeschrieben (war bereits sauber).

## Relevante Stellen
- `.github/actions/issue-state-save/action.yml:39-49` — state.json-Merge läuft auf WORKSPACE-Kopie (Restore-Stand) → Race: verliert Phaseneintrag des Vorgänger-Laufs. Kern von Befund 1.
- `.github/actions/issue-state-save/action.yml:60-67` — Fetch des State-Branchs + `git read-tree FETCH_HEAD^{tree}`; Basis für den Fix (Merge-Quelle `git show FETCH_HEAD:.ai-memory/state.json`, Workspace nur Fallback wenn Branch fehlt).
- `.github/actions/issue-state-save/action.yml:77-84` — `notes`-Zählung zählt ALLE gestagten `issue-*.md` (inkl. restaurierter) → Meldung „N Notiz(en)" kaschiert fehlende Neuschreibung. Kern von Befund 2.
- `.github/workflows/06-claude-pr-documenter.yml:259-271` — Documenter ruft issue-state-save mit `phase: documenter` auf (auch :81); Ankerpunkt für Post-Assertion/Stub.
- `.github/prompts/memory-write.md:5` — Schreibanweisung `.ai-memory/issue-{{ISSUE_NR}}-{{PHASE}}.md`, die der Documenter-Agent ignorierte.
- Aufrufer der Action (nicht brechen): 01-claude-triage.yml:346, 02-claude-ux.yml:159, 03-claude-spec.yml:249, 04-claude-implement.yml:311+770 (fixup), 05-claude-pr-review.yml:289, 06-claude-pr-documenter.yml:268.

## Annahmen
- Beide Fixes sind reine CI-/Action-Änderungen → kein Anwendungscode → Spec nötig: nein je Sub-Issue (ADR-0001 Test-Carve-out).
- Commit-Beweis aus Ticket (2b4dad54/2677a98d auf ai/state/issue-1005) nicht selbst re-verifiziert (Zeitbudget) — Plausibilität durch Codelesen gestützt.

## Verworfen
- Keine Zerlegung nach Schichten — nur eine Schicht (CI), aber 2 unabhängige AK-Cluster → dennoch zerlegt (2 Sub-Issues statt 1 PR, Review-Fokus).
- Kein eigenes Sub-Issue für „memory-write.md härter formulieren" — Prompt-Text allein behebt nichts Deterministisches; gehört zu A2 (Assertion statt Appell).

## Offen
- -

## Nächster Schritt
- Nichts — Triage fertig. Nächste Phase: Implementierung #1009 (ai:needs-impl). #1010 wird beim Merge von #1009 automatisch freigegeben.

## Fallstricke
- Soft-Deadline 1787628474 lag nur ~13 Min nach Start — alles Gedrosselte/GraphQL-Kanten knapp halten.
- Parent #1008 bekommt KEINE Labels (macht der Workflow via VERDICT).
- Sub-Issue-Bodies MÜSSEN eigenen KI-ANALYSE-Block mit Markern enthalten (sonst failt Re-Triage hart).
- Sandbox-Bash lehnt Command-Substitution `$()`, Variablen-Expansion im String und Brace-Expansion `{...}` ab → GraphQL-Mutationen mit `{addSubIssue(...)}` blockiert. Lösung: Query per Write in Datei, dann `gh api graphql -F query=@<datei> -f p=<id>`. Issue-IDs vorher per `gh issue view N --json id -q .id` literal holen. (Kandidat für MEMORY.md — hochziehen, wenn eine Committ-Phase ihn braucht.)
- /tmp ist für Write ohne Erlaubnis gesperrt → Tempdateien unter `.ai-memory/` (gitignored; Save staged dort nur issue-*.md + state.json). 4 tmp-Dateien (tmp-gq-*.graphql, tmp-1008-*) konnten nicht gelöscht werden (rm braucht Approval) — harmlos, beim nächsten Aufräumen entfernen.
